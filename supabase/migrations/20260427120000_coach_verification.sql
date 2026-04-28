-- Coach verification: approved coaches, player requests, assessments, player coach_* snapshot.

create type public.verification_request_status as enum ('pending', 'submitted', 'cancelled');

create table public.coach_profiles (
  user_id text not null primary key references public.users (id) on delete cascade,
  bio text,
  evidence_note text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coach_profiles_approved_idx
  on public.coach_profiles (approved_at)
  where approved_at is not null;

create table public.player_verification_requests (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  coach_user_id text not null references public.users (id) on delete cascade,
  status public.verification_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open pending request per player+coach pair.
create unique index player_verification_one_pending
  on public.player_verification_requests (player_id, coach_user_id)
  where status = 'pending';

create index player_verification_coach_idx
  on public.player_verification_requests (coach_user_id, status, created_at desc);

create index player_verification_player_idx
  on public.player_verification_requests (player_id, created_at desc);

create table public.coach_assessments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.player_verification_requests (id) on delete cascade,
  coach_user_id text not null references public.users (id) on delete cascade,
  attribute_scores jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (request_id)
);

alter table public.players
  add column if not exists coach_verified_attributes jsonb,
  add column if not exists coach_verified_at timestamptz,
  add column if not exists coach_verified_by_user_id text references public.users (id) on delete set null;

-- Preserve approved_at from API updates (admin sets via SQL dashboard / service role without JWT).
create or replace function public.coach_profiles_guard_approved_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.approved_at is distinct from old.approved_at then
    if auth.jwt() is not null then
      raise exception 'approved_at cannot be changed from the app';
    end if;
  end if;
  return new;
end;
$$;

create trigger coach_profiles_guard_approved_at_trg
  before update of approved_at on public.coach_profiles
  for each row
  execute function public.coach_profiles_guard_approved_at();

create or replace function public.touch_coach_profiles_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger coach_profiles_touch_updated_at
  before update on public.coach_profiles
  for each row
  execute function public.touch_coach_profiles_updated_at();

-- ---------------------------------------------------------------------------
-- RPCs (mutations; RLS stays tight on direct writes)
-- ---------------------------------------------------------------------------

create or replace function public.create_verification_request(p_coach_user_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := private.request_uid();
  v_player_id uuid;
  v_req_id uuid;
begin
  if v_uid is null or length(trim(v_uid)) = 0 then
    raise exception 'not authenticated';
  end if;

  if p_coach_user_id is null or p_coach_user_id = v_uid then
    raise exception 'invalid coach';
  end if;

  if not exists (
    select 1 from public.coach_profiles cp
    where cp.user_id = p_coach_user_id
      and cp.approved_at is not null
  ) then
    raise exception 'coach is not approved';
  end if;

  select p.id into v_player_id
  from public.players p
  where p.user_id = v_uid
  limit 1;

  if v_player_id is null then
    raise exception 'player profile missing';
  end if;

  insert into public.player_verification_requests (player_id, coach_user_id, status)
  values (v_player_id, p_coach_user_id, 'pending')
  returning id into v_req_id;

  return v_req_id;
exception
  when unique_violation then
    raise exception 'a pending request already exists for this coach';
end;
$$;

grant execute on function public.create_verification_request(text) to authenticated;

create or replace function public.cancel_verification_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := private.request_uid();
  v_player_id uuid;
  v_row_count int;
begin
  if v_uid is null or length(trim(v_uid)) = 0 then
    raise exception 'not authenticated';
  end if;

  select p.id into v_player_id
  from public.players p
  where p.user_id = v_uid
  limit 1;

  if v_player_id is null then
    raise exception 'player profile missing';
  end if;

  update public.player_verification_requests r
  set status = 'cancelled', updated_at = now()
  where r.id = p_request_id
    and r.player_id = v_player_id
    and r.status = 'pending';

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'request not found or not cancellable';
  end if;
end;
$$;

grant execute on function public.cancel_verification_request(uuid) to authenticated;

create or replace function public.submit_coach_assessment(
  p_request_id uuid,
  p_attribute_scores jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := private.request_uid();
  v_player_id uuid;
  v_coach text;
  v_st public.verification_request_status;
  required_keys text[] := array[
    'serve_return', 'net_game', 'power', 'consistency', 'movement', 'tactical_iq'
  ];
  k text;
  v_num numeric;
  v_assessment_id uuid;
begin
  if v_uid is null or length(trim(v_uid)) = 0 then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.coach_profiles cp
    where cp.user_id = v_uid
      and cp.approved_at is not null
  ) then
    raise exception 'not an approved coach';
  end if;

  select r.player_id, r.coach_user_id, r.status
  into v_player_id, v_coach, v_st
  from public.player_verification_requests r
  where r.id = p_request_id
  for update;

  if v_player_id is null then
    raise exception 'request not found';
  end if;

  if v_coach <> v_uid then
    raise exception 'not assigned to this request';
  end if;

  if v_st <> 'pending' then
    raise exception 'request is not pending';
  end if;

  if (select count(*) from jsonb_object_keys(p_attribute_scores)) <> 6 then
    raise exception 'attribute_scores must contain exactly six keys';
  end if;

  foreach k in array required_keys loop
    v_num := (p_attribute_scores ->> k)::numeric;
    if v_num is null or v_num <> floor(v_num) or v_num < 1 or v_num > 8 then
      raise exception 'invalid attribute score for %', k;
    end if;
  end loop;

  -- Reject unknown top-level keys (strict shape).
  if exists (
    select 1
    from jsonb_object_keys(p_attribute_scores) as ek(key)
    where ek.key <> all (required_keys)
  ) then
    raise exception 'unknown attribute keys in payload';
  end if;

  insert into public.coach_assessments (request_id, coach_user_id, attribute_scores)
  values (p_request_id, v_uid, p_attribute_scores)
  returning id into v_assessment_id;

  update public.players pl
  set
    coach_verified_attributes = p_attribute_scores,
    coach_verified_at = now(),
    coach_verified_by_user_id = v_uid
  where pl.id = v_player_id;

  update public.player_verification_requests r
  set status = 'submitted', updated_at = now()
  where r.id = p_request_id;

  return v_assessment_id;
end;
$$;

grant execute on function public.submit_coach_assessment(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.coach_profiles enable row level security;
alter table public.player_verification_requests enable row level security;
alter table public.coach_assessments enable row level security;

-- coach_profiles
create policy coach_profiles_select on public.coach_profiles
  for select to authenticated
  using (approved_at is not null or user_id = private.request_uid());

create policy coach_profiles_insert_own on public.coach_profiles
  for insert to authenticated
  with check (user_id = private.request_uid());

create policy coach_profiles_update_own on public.coach_profiles
  for update to authenticated
  using (user_id = private.request_uid())
  with check (user_id = private.request_uid());

-- player_verification_requests (reads only; writes via RPC)
create policy pvr_select_player on public.player_verification_requests
  for select to authenticated
  using (
    exists (
      select 1 from public.players p
      where p.id = player_id
        and p.user_id = private.request_uid()
    )
  );

create policy pvr_select_coach on public.player_verification_requests
  for select to authenticated
  using (coach_user_id = private.request_uid());

-- coach_assessments
create policy ca_select_player on public.coach_assessments
  for select to authenticated
  using (
    exists (
      select 1
      from public.player_verification_requests r
      join public.players p on p.id = r.player_id
      where r.id = coach_assessments.request_id
        and p.user_id = private.request_uid()
    )
  );

create policy ca_select_coach on public.coach_assessments
  for select to authenticated
  using (coach_user_id = private.request_uid());

-- Assigned coach may read the player row for verification (directory flow).
create policy players_select_verification_coach on public.players
  for select to authenticated
  using (
    exists (
      select 1 from public.player_verification_requests r
      where r.player_id = players.id
        and r.coach_user_id = private.request_uid()
    )
  );

-- Coach may read counterparty user row for an assigned request.
create policy users_select_verification_subject on public.users
  for select to authenticated
  using (
    exists (
      select 1
      from public.player_verification_requests r
      join public.players p on p.id = r.player_id
      where p.user_id = users.id
        and r.coach_user_id = private.request_uid()
    )
  );

grant select, insert, update on public.coach_profiles to authenticated;
grant select on public.player_verification_requests to authenticated;
grant select on public.coach_assessments to authenticated;
