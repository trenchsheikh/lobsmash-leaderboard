-- Bookable verification sessions: venue, time, duration, coach; players book → verification request.

create type public.coach_verification_slot_status as enum ('open', 'booked', 'cancelled');

create table public.coach_verification_slots (
  id uuid primary key default gen_random_uuid(),
  coach_user_id text not null references public.users (id) on delete cascade,
  venue text not null,
  starts_at timestamptz not null,
  duration_minutes int not null check (duration_minutes >= 15 and duration_minutes <= 480),
  notes text,
  status public.coach_verification_slot_status not null default 'open',
  booked_verification_request_id uuid references public.player_verification_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_verification_slots_venue_len check (char_length(trim(venue)) >= 2)
);

create index coach_verification_slots_open_upcoming_idx
  on public.coach_verification_slots (starts_at asc)
  where status = 'open';

create index coach_verification_slots_coach_idx
  on public.coach_verification_slots (coach_user_id, created_at desc);

alter table public.player_verification_requests
  add column if not exists slot_id uuid references public.coach_verification_slots (id) on delete set null;

-- ---------------------------------------------------------------------------
-- book_verification_slot: atomic book + request
-- ---------------------------------------------------------------------------

create or replace function public.book_verification_slot(p_slot_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := private.request_uid();
  v_player_id uuid;
  v_coach text;
  v_st public.coach_verification_slot_status;
  v_req_id uuid;
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

  select s.coach_user_id, s.status
  into v_coach, v_st
  from public.coach_verification_slots s
  where s.id = p_slot_id
  for update;

  if v_coach is null then
    raise exception 'slot not found';
  end if;

  if v_st <> 'open' then
    raise exception 'slot is not available';
  end if;

  if v_coach = v_uid then
    raise exception 'cannot book your own slot';
  end if;

  if not exists (
    select 1 from public.coach_profiles cp
    where cp.user_id = v_coach
      and cp.approved_at is not null
  ) then
    raise exception 'coach is not approved';
  end if;

  if not exists (
    select 1 from public.coach_verification_slots s2
    where s2.id = p_slot_id
      and s2.starts_at > now()
  ) then
    raise exception 'slot has already started or ended';
  end if;

  insert into public.player_verification_requests (player_id, coach_user_id, status, slot_id)
  values (v_player_id, v_coach, 'pending', p_slot_id)
  returning id into v_req_id;

  update public.coach_verification_slots s
  set
    status = 'booked',
    booked_verification_request_id = v_req_id,
    updated_at = now()
  where s.id = p_slot_id;

  return v_req_id;
exception
  when unique_violation then
    raise exception 'a pending request already exists for this coach';
end;
$$;

grant execute on function public.book_verification_slot(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.coach_verification_slots enable row level security;

create policy coach_slots_select_open on public.coach_verification_slots
  for select to authenticated
  using (
    status = 'open'
    and starts_at > now()
  );

create policy coach_slots_select_own on public.coach_verification_slots
  for select to authenticated
  using (coach_user_id = private.request_uid());

create policy coach_slots_insert on public.coach_verification_slots
  for insert to authenticated
  with check (
    coach_user_id = private.request_uid()
    and exists (
      select 1 from public.coach_profiles cp
      where cp.user_id = private.request_uid()
        and cp.approved_at is not null
    )
  );

create policy coach_slots_update_own on public.coach_verification_slots
  for update to authenticated
  using (coach_user_id = private.request_uid())
  with check (coach_user_id = private.request_uid());

grant select, insert, update on public.coach_verification_slots to authenticated;
