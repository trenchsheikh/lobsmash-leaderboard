-- Invite links (opaque token), join requests (approve/decline), preview RPC for anon.

-- 1) invite_token on leagues
alter table public.leagues
  add column if not exists invite_token uuid;

update public.leagues
set invite_token = gen_random_uuid()
where invite_token is null;

alter table public.leagues
  alter column invite_token set not null;

alter table public.leagues
  alter column invite_token set default gen_random_uuid();

create unique index if not exists leagues_invite_token_key
  on public.leagues (invite_token);

-- 2) join requests
create table if not exists public.league_join_requests (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create index if not exists league_join_requests_league_id_idx
  on public.league_join_requests (league_id);

create index if not exists league_join_requests_user_id_idx
  on public.league_join_requests (user_id);

alter table public.league_join_requests enable row level security;

drop policy if exists league_join_requests_select_own on public.league_join_requests;
drop policy if exists league_join_requests_select_admin on public.league_join_requests;

create policy league_join_requests_select_own on public.league_join_requests
  for select to authenticated
  using (user_id = private.request_uid());

create policy league_join_requests_select_admin on public.league_join_requests
  for select to authenticated
  using (private.league_role(league_id) in ('owner', 'admin'));

-- 3) Public preview (anon + authenticated)
create or replace function public.get_league_invite_preview(p_invite_token uuid)
returns table (
  league_id uuid,
  league_name text,
  format public.league_format,
  member_count bigint,
  owner_name text,
  owner_username text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.name,
    l.format,
    (select count(*)::bigint from public.league_members lm where lm.league_id = l.id),
    coalesce(ou.name, ''),
    ou.username
  from public.leagues l
  join public.users ou on ou.id = l.owner_id
  where l.invite_token = p_invite_token
  limit 1;
$$;

grant execute on function public.get_league_invite_preview(uuid) to anon, authenticated;

-- 4) Shared request logic: replace join_league_by_code with request-only
create or replace function public.join_league_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  uid text := private.request_uid();
  prev_status text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select id
  into lid
  from public.leagues
  where code = upper(trim(p_code))
  limit 1;

  if lid is null then
    raise exception 'invalid code';
  end if;

  if exists (
    select 1
    from public.league_members lm
    where lm.league_id = lid
      and lm.user_id = uid
  ) then
    raise exception 'already joined';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = uid
      and u.username is not null
      and length(trim(u.username)) > 0
  ) then
    raise exception 'username required for league';
  end if;

  if not exists (
    select 1
    from public.players p
    where p.user_id = uid
  ) then
    raise exception 'complete onboarding first';
  end if;

  select r.status
  into prev_status
  from public.league_join_requests r
  where r.league_id = lid
    and r.user_id = uid;

  if prev_status = 'pending' then
    raise exception 'request already pending';
  end if;

  if prev_status = 'declined' then
    update public.league_join_requests
    set status = 'pending', updated_at = now()
    where league_id = lid
      and user_id = uid;
  else
    insert into public.league_join_requests (league_id, user_id, status)
    values (lid, uid, 'pending');
  end if;

  return lid;
end;
$$;

grant execute on function public.join_league_by_code(text) to authenticated;

create or replace function public.request_join_league_by_invite_token(p_invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  uid text := private.request_uid();
  prev_status text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select id
  into lid
  from public.leagues
  where invite_token = p_invite_token
  limit 1;

  if lid is null then
    raise exception 'invalid invite';
  end if;

  if exists (
    select 1
    from public.league_members lm
    where lm.league_id = lid
      and lm.user_id = uid
  ) then
    raise exception 'already joined';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = uid
      and u.username is not null
      and length(trim(u.username)) > 0
  ) then
    raise exception 'username required for league';
  end if;

  if not exists (
    select 1
    from public.players p
    where p.user_id = uid
  ) then
    raise exception 'complete onboarding first';
  end if;

  select r.status
  into prev_status
  from public.league_join_requests r
  where r.league_id = lid
    and r.user_id = uid;

  if prev_status = 'pending' then
    raise exception 'request already pending';
  end if;

  if prev_status = 'declined' then
    update public.league_join_requests
    set status = 'pending', updated_at = now()
    where league_id = lid
      and user_id = uid;
  else
    insert into public.league_join_requests (league_id, user_id, status)
    values (lid, uid, 'pending');
  end if;

  return lid;
end;
$$;

grant execute on function public.request_join_league_by_invite_token(uuid) to authenticated;

-- 5) Accept / decline (owner or admin)
create or replace function public.accept_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  req_uid text;
  pid uuid;
  admin_role public.league_member_role;
begin
  select r.league_id, r.user_id
  into lid, req_uid
  from public.league_join_requests r
  where r.id = p_request_id
    and r.status = 'pending';

  if lid is null then
    raise exception 'request not found';
  end if;

  admin_role := private.league_role(lid);
  if admin_role is null or admin_role not in ('owner', 'admin') then
    raise exception 'not allowed';
  end if;

  select p.id
  into pid
  from public.players p
  where p.user_id = req_uid
  limit 1;

  if pid is null then
    raise exception 'player profile missing';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (lid, req_uid, 'player')
  on conflict do nothing;

  insert into public.league_players (league_id, player_id)
  values (lid, pid)
  on conflict do nothing;

  delete from public.league_join_requests
  where id = p_request_id;
end;
$$;

grant execute on function public.accept_join_request(uuid) to authenticated;

create or replace function public.decline_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  admin_role public.league_member_role;
begin
  select r.league_id
  into lid
  from public.league_join_requests r
  where r.id = p_request_id
    and r.status = 'pending';

  if lid is null then
    raise exception 'request not found';
  end if;

  admin_role := private.league_role(lid);
  if admin_role is null or admin_role not in ('owner', 'admin') then
    raise exception 'not allowed';
  end if;

  update public.league_join_requests
  set status = 'declined', updated_at = now()
  where id = p_request_id;
end;
$$;

grant execute on function public.decline_join_request(uuid) to authenticated;
