-- Open friendly sessions: matchmaking outside league sessions (no global rating impact).

create table public.friendly_sessions (
  id uuid primary key default gen_random_uuid(),
  creator_user_id text not null references public.users (id) on delete cascade,
  invite_token uuid not null unique default gen_random_uuid(),
  capacity int not null check (capacity in (4, 6, 8)),
  title text,
  starts_at timestamptz,
  status text not null default 'open' check (status in ('open', 'cancelled')),
  created_at timestamptz not null default now()
);

create index friendly_sessions_creator_user_id_idx on public.friendly_sessions (creator_user_id);
create index friendly_sessions_invite_token_idx on public.friendly_sessions (invite_token);

create table public.friendly_session_join_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.friendly_sessions (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index friendly_session_join_requests_session_id_idx
  on public.friendly_session_join_requests (session_id);

create table public.friendly_session_roster (
  session_id uuid not null references public.friendly_sessions (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  slot_index int not null check (slot_index >= 0),
  primary key (session_id, slot_index),
  unique (session_id, user_id)
);

create index friendly_session_roster_user_id_idx on public.friendly_session_roster (user_id);

-- Optional friendly-only results (no linkage to public.sessions or skill rating triggers).
create table public.friendly_session_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.friendly_sessions (id) on delete cascade,
  recorded_by text not null references public.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index friendly_session_results_session_id_idx on public.friendly_session_results (session_id);

alter table public.friendly_sessions enable row level security;
alter table public.friendly_session_join_requests enable row level security;
alter table public.friendly_session_roster enable row level security;
alter table public.friendly_session_results enable row level security;

-- friendly_sessions: visible to creator, roster members, and users with a join request row.
create policy friendly_sessions_select on public.friendly_sessions
  for select to authenticated
  using (
    creator_user_id = private.request_uid()
    or exists (
      select 1 from public.friendly_session_roster r
      where r.session_id = friendly_sessions.id and r.user_id = private.request_uid()
    )
    or exists (
      select 1 from public.friendly_session_join_requests q
      where q.session_id = friendly_sessions.id and q.user_id = private.request_uid()
    )
  );

create policy friendly_sessions_insert on public.friendly_sessions
  for insert to authenticated
  with check (creator_user_id = private.request_uid());

create policy friendly_sessions_update on public.friendly_sessions
  for update to authenticated
  using (creator_user_id = private.request_uid())
  with check (creator_user_id = private.request_uid());

-- Join requests: requester or session creator.
create policy friendly_join_requests_select on public.friendly_session_join_requests
  for select to authenticated
  using (
    user_id = private.request_uid()
    or exists (
      select 1 from public.friendly_sessions s
      where s.id = friendly_session_join_requests.session_id
        and s.creator_user_id = private.request_uid()
    )
  );

-- Roster: creator or anyone on the roster.
create policy friendly_roster_select on public.friendly_session_roster
  for select to authenticated
  using (
    exists (
      select 1 from public.friendly_sessions s
      where s.id = friendly_session_roster.session_id
        and s.creator_user_id = private.request_uid()
    )
    or exists (
      select 1 from public.friendly_session_roster r2
      where r2.session_id = friendly_session_roster.session_id
        and r2.user_id = private.request_uid()
    )
  );

-- Results: roster or creator (read); insert via RPC later — for now creator + roster select only.
create policy friendly_results_select on public.friendly_session_results
  for select to authenticated
  using (
    exists (
      select 1 from public.friendly_sessions s
      where s.id = friendly_session_results.session_id
        and s.creator_user_id = private.request_uid()
    )
    or exists (
      select 1 from public.friendly_session_roster r
      where r.session_id = friendly_session_results.session_id
        and r.user_id = private.request_uid()
    )
  );

grant select on public.friendly_sessions to authenticated;
grant select on public.friendly_session_join_requests to authenticated;
grant select on public.friendly_session_roster to authenticated;
grant select on public.friendly_session_results to authenticated;

-- Extend player_ratings visibility: same friendly session roster as viewer.
drop policy if exists player_ratings_select on public.player_ratings;

create policy player_ratings_select on public.player_ratings
  for select to authenticated
  using (
    exists (
      select 1
      from public.players p
      where p.id = player_ratings.player_id
        and (
          p.user_id = private.request_uid()
          or exists (
            select 1
            from public.league_players lp
            join public.league_members lm on lm.league_id = lp.league_id
            where lp.player_id = p.id
              and lm.user_id = private.request_uid()
          )
        )
    )
    or exists (
      select 1
      from public.players p
      where p.id = player_ratings.player_id
        and p.user_id is not null
        and private.friend_accepted_with(private.request_uid(), p.user_id)
    )
    or exists (
      select 1
      from public.friendly_session_roster fsr_me
      join public.friendly_session_roster fsr_other
        on fsr_other.session_id = fsr_me.session_id
      join public.players p on p.id = player_ratings.player_id
      where fsr_me.user_id = private.request_uid()
        and fsr_other.user_id = p.user_id
        and p.user_id is not null
    )
  );

-- Public invite preview (anon + authenticated).
create or replace function public.get_friendly_invite_preview(p_invite_token uuid)
returns table (
  session_id uuid,
  title text,
  capacity int,
  starts_at timestamptz,
  status text,
  creator_name text,
  creator_username text,
  filled_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.title,
    s.capacity,
    s.starts_at,
    s.status,
    coalesce(u.name, ''),
    u.username,
    (select count(*)::bigint from public.friendly_session_roster r where r.session_id = s.id)
  from public.friendly_sessions s
  join public.users u on u.id = s.creator_user_id
  where s.invite_token = p_invite_token
  limit 1;
$$;

grant execute on function public.get_friendly_invite_preview(uuid) to anon, authenticated;

create or replace function public.create_friendly_session(
  p_capacity int,
  p_title text default null,
  p_starts_at timestamptz default null
)
returns table (session_id uuid, invite_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := private.request_uid();
  sid uuid;
  tok uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_capacity is null or p_capacity not in (4, 6, 8) then
    raise exception 'invalid capacity';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = uid
      and u.username is not null
      and length(trim(u.username)) > 0
  ) then
    raise exception 'username required';
  end if;

  if not exists (select 1 from public.players p where p.user_id = uid) then
    raise exception 'complete onboarding first';
  end if;

  -- Qualify RETURNING columns: RETURNS TABLE defines an `invite_token` output param that
  -- would otherwise make `invite_token` ambiguous vs friendly_sessions.invite_token.
  insert into public.friendly_sessions as fs (creator_user_id, capacity, title, starts_at)
  values (uid, p_capacity, nullif(trim(p_title), ''), p_starts_at)
  returning fs.id, fs.invite_token into sid, tok;

  insert into public.friendly_session_roster (session_id, user_id, slot_index)
  values (sid, uid, 0);

  return query select sid, tok;
end;
$$;

grant execute on function public.create_friendly_session(int, text, timestamptz) to authenticated;

create or replace function public.request_join_friendly_session(p_invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  cap int;
  st text;
  cre text;
  uid text := private.request_uid();
  prev_status text;
  roster_count int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select id, capacity, status, creator_user_id
  into sid, cap, st, cre
  from public.friendly_sessions
  where invite_token = p_invite_token
  limit 1;

  if sid is null then
    raise exception 'invalid invite';
  end if;

  if st is distinct from 'open' then
    raise exception 'session not open';
  end if;

  if cre = uid then
    raise exception 'already in session';
  end if;

  select count(*)::int into roster_count from public.friendly_session_roster where session_id = sid;
  if roster_count >= cap then
    raise exception 'session full';
  end if;

  if exists (
    select 1 from public.friendly_session_roster r where r.session_id = sid and r.user_id = uid
  ) then
    raise exception 'already in session';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = uid
      and u.username is not null
      and length(trim(u.username)) > 0
  ) then
    raise exception 'username required';
  end if;

  if not exists (select 1 from public.players p where p.user_id = uid) then
    raise exception 'complete onboarding first';
  end if;

  select r.status
  into prev_status
  from public.friendly_session_join_requests r
  where r.session_id = sid and r.user_id = uid;

  if prev_status = 'pending' then
    raise exception 'request already pending';
  end if;

  if prev_status = 'declined' then
    update public.friendly_session_join_requests
    set status = 'pending', updated_at = now()
    where session_id = sid and user_id = uid;
  else
    insert into public.friendly_session_join_requests (session_id, user_id, status)
    values (sid, uid, 'pending');
  end if;

  return sid;
end;
$$;

grant execute on function public.request_join_friendly_session(uuid) to authenticated;

create or replace function public.accept_friendly_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  req_uid text;
  cap int;
  st text;
  cre text;
  roster_count int;
  next_slot int;
  i int;
begin
  select r.session_id, r.user_id
  into sid, req_uid
  from public.friendly_session_join_requests r
  where r.id = p_request_id
    and r.status = 'pending';

  if sid is null then
    raise exception 'request not found';
  end if;

  select capacity, status, creator_user_id
  into cap, st, cre
  from public.friendly_sessions
  where id = sid
  for update;

  if st is distinct from 'open' then
    raise exception 'session not open';
  end if;

  if cre is distinct from private.request_uid() then
    raise exception 'not allowed';
  end if;

  select count(*)::int into roster_count from public.friendly_session_roster where session_id = sid;
  if roster_count >= cap then
    raise exception 'session full';
  end if;

  next_slot := null;
  for i in 0..cap - 1 loop
    if not exists (
      select 1 from public.friendly_session_roster r
      where r.session_id = sid and r.slot_index = i
    ) then
      next_slot := i;
      exit;
    end if;
  end loop;

  if next_slot is null then
    raise exception 'no free slot';
  end if;

  insert into public.friendly_session_roster (session_id, user_id, slot_index)
  values (sid, req_uid, next_slot);

  delete from public.friendly_session_join_requests where id = p_request_id;
end;
$$;

grant execute on function public.accept_friendly_join_request(uuid) to authenticated;

create or replace function public.decline_friendly_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  cre text;
begin
  select r.session_id
  into sid
  from public.friendly_session_join_requests r
  where r.id = p_request_id
    and r.status = 'pending';

  if sid is null then
    raise exception 'request not found';
  end if;

  select creator_user_id into cre from public.friendly_sessions where id = sid;

  if cre is distinct from private.request_uid() then
    raise exception 'not allowed';
  end if;

  update public.friendly_session_join_requests
  set status = 'declined', updated_at = now()
  where id = p_request_id;
end;
$$;

grant execute on function public.decline_friendly_join_request(uuid) to authenticated;

create or replace function public.swap_friendly_roster_slots(
  p_session_id uuid,
  p_slot_a int,
  p_slot_b int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := private.request_uid();
  st text;
  cap int;
  ua text;
  ub text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_slot_a = p_slot_b then
    raise exception 'same slot';
  end if;

  select status, capacity into st, cap
  from public.friendly_sessions
  where id = p_session_id;

  if st is null then
    raise exception 'session not found';
  end if;

  if st is distinct from 'open' then
    raise exception 'session not open';
  end if;

  if p_slot_a < 0 or p_slot_a >= cap or p_slot_b < 0 or p_slot_b >= cap then
    raise exception 'invalid slot';
  end if;

  if not exists (
    select 1 from public.friendly_session_roster r
    where r.session_id = p_session_id and r.user_id = uid
  ) then
    raise exception 'not allowed';
  end if;

  select user_id into ua
  from public.friendly_session_roster
  where session_id = p_session_id and slot_index = p_slot_a;

  select user_id into ub
  from public.friendly_session_roster
  where session_id = p_session_id and slot_index = p_slot_b;

  if ua is null or ub is null then
    raise exception 'empty slot';
  end if;

  update public.friendly_session_roster set user_id = ub where session_id = p_session_id and slot_index = p_slot_a;
  update public.friendly_session_roster set user_id = ua where session_id = p_session_id and slot_index = p_slot_b;
end;
$$;

grant execute on function public.swap_friendly_roster_slots(uuid, int, int) to authenticated;

create or replace function public.cancel_friendly_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cre text;
begin
  select creator_user_id into cre from public.friendly_sessions where id = p_session_id;
  if cre is null then
    raise exception 'session not found';
  end if;
  if cre is distinct from private.request_uid() then
    raise exception 'not allowed';
  end if;
  update public.friendly_sessions set status = 'cancelled' where id = p_session_id;
end;
$$;

grant execute on function public.cancel_friendly_session(uuid) to authenticated;
