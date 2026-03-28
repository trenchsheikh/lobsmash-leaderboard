-- Clerk third-party JWT: RLS uses JWT `sub` (text), not Supabase Auth UUIDs.
-- Drops auth.users linkage; migrates user id columns to text.

-- 1) Drop RLS policies (depend on columns/functions)
drop policy if exists users_select_own on public.users;
drop policy if exists users_select_same_league on public.users;
drop policy if exists users_update_own on public.users;

drop policy if exists players_select on public.players;
drop policy if exists players_insert_own on public.players;
drop policy if exists players_update_own on public.players;

drop policy if exists leagues_select_member on public.leagues;
drop policy if exists leagues_insert on public.leagues;
drop policy if exists leagues_update_admin on public.leagues;
drop policy if exists leagues_delete_owner on public.leagues;

drop policy if exists league_members_select on public.league_members;
drop policy if exists league_members_insert_admin on public.league_members;
drop policy if exists league_members_insert_as_league_owner on public.league_members;
drop policy if exists league_members_update_admin on public.league_members;
drop policy if exists league_members_delete_self on public.league_members;
drop policy if exists league_members_delete_admin on public.league_members;

drop policy if exists league_players_select on public.league_players;
drop policy if exists league_players_write_admin on public.league_players;
drop policy if exists league_players_insert_own_player on public.league_players;
drop policy if exists league_players_update_admin on public.league_players;
drop policy if exists league_players_delete_admin on public.league_players;

drop policy if exists sessions_select on public.sessions;
drop policy if exists sessions_insert on public.sessions;
drop policy if exists sessions_update on public.sessions;
drop policy if exists sessions_delete on public.sessions;

drop policy if exists games_select on public.games;
drop policy if exists games_insert on public.games;
drop policy if exists games_update on public.games;
drop policy if exists games_delete on public.games;

drop policy if exists player_stats_select on public.player_stats;

-- 2) Remove Supabase Auth bootstrap (Clerk does not insert into auth.users)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 3) JWT sub helper (Clerk user id, e.g. user_...)
create or replace function private.request_uid()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select auth.jwt() ->> 'sub';
$$;

grant execute on function private.request_uid() to authenticated;

-- 4) Drop FKs referencing public.users before type change
alter table public.players drop constraint if exists players_user_id_fkey;
alter table public.leagues drop constraint if exists leagues_owner_id_fkey;
alter table public.league_members drop constraint if exists league_members_user_id_fkey;
alter table public.sessions drop constraint if exists sessions_created_by_fkey;
alter table public.users drop constraint if exists users_id_fkey;

-- 6) Primary key on users.id then alter types
alter table public.users alter column id type text using id::text;
alter table public.players alter column user_id type text using user_id::text;
alter table public.leagues alter column owner_id type text using owner_id::text;
alter table public.league_members alter column user_id type text using user_id::text;
alter table public.sessions alter column created_by type text using created_by::text;

alter table public.players
  add constraint players_user_id_fkey
  foreign key (user_id) references public.users (id) on delete set null;

alter table public.leagues
  add constraint leagues_owner_id_fkey
  foreign key (owner_id) references public.users (id);

alter table public.league_members
  add constraint league_members_user_id_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

alter table public.sessions
  add constraint sessions_created_by_fkey
  foreign key (created_by) references public.users (id);

-- 5) Member helpers (after user_id columns are text; uuid = text would fail earlier)
create or replace function private.is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = private.request_uid()
  );
$$;

create or replace function private.league_role(p_league_id uuid)
returns public.league_member_role
language sql
stable
security definer
set search_path = public
as $$
  select lm.role
  from public.league_members lm
  where lm.league_id = p_league_id
    and lm.user_id = private.request_uid()
  limit 1;
$$;

-- 6) join_league_by_code
create or replace function public.join_league_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  pid uuid;
  uid text := private.request_uid();
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

  select id
  into pid
  from public.players
  where user_id = uid
  limit 1;

  if pid is null then
    raise exception 'complete onboarding first';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (lid, uid, 'player');

  insert into public.league_players (league_id, player_id)
  values (lid, pid)
  on conflict do nothing;

  return lid;
end;
$$;

-- 8) RLS policies (private.request_uid() instead of auth.uid())
create policy users_select_own on public.users
  for select to authenticated using (id = private.request_uid());

create policy users_select_same_league on public.users
  for select to authenticated using (
    exists (
      select 1
      from public.league_members lm_self
      join public.league_members lm_other
        on lm_self.league_id = lm_other.league_id
      where lm_self.user_id = private.request_uid()
        and lm_other.user_id = users.id
    )
  );

create policy users_insert_own on public.users
  for insert to authenticated
  with check (id = private.request_uid());

create policy users_update_own on public.users
  for update to authenticated
  using (id = private.request_uid())
  with check (id = private.request_uid());

create policy players_select on public.players
  for select to authenticated using (
    user_id = private.request_uid()
    or exists (
      select 1
      from public.league_players lp
      join public.league_members lm
        on lm.league_id = lp.league_id
      where lp.player_id = players.id
        and lm.user_id = private.request_uid()
    )
  );

create policy players_insert_own on public.players
  for insert to authenticated
  with check (user_id = private.request_uid());

create policy players_update_own on public.players
  for update to authenticated
  using (user_id = private.request_uid())
  with check (user_id = private.request_uid());

create policy leagues_select_member on public.leagues
  for select to authenticated
  using (
    owner_id = private.request_uid()
    or private.is_league_member(id)
  );

create policy leagues_insert on public.leagues
  for insert to authenticated
  with check (owner_id = private.request_uid());

create policy leagues_update_admin on public.leagues
  for update to authenticated
  using (private.league_role(id) in ('owner', 'admin'))
  with check (private.league_role(id) in ('owner', 'admin'));

create policy leagues_delete_owner on public.leagues
  for delete to authenticated
  using (private.league_role(id) = 'owner');

create policy league_members_select on public.league_members
  for select to authenticated
  using (private.is_league_member(league_id));

create policy league_members_insert_admin on public.league_members
  for insert to authenticated
  with check (private.league_role(league_id) in ('owner', 'admin'));

create policy league_members_insert_as_league_owner on public.league_members
  for insert to authenticated
  with check (
    user_id = private.request_uid()
    and role = 'owner'
    and exists (
      select 1
      from public.leagues l
      where l.id = league_id
        and l.owner_id = private.request_uid()
    )
  );

create policy league_members_update_admin on public.league_members
  for update to authenticated
  using (private.league_role(league_id) in ('owner', 'admin'))
  with check (private.league_role(league_id) in ('owner', 'admin'));

create policy league_members_delete_self on public.league_members
  for delete to authenticated
  using (user_id = private.request_uid());

create policy league_members_delete_admin on public.league_members
  for delete to authenticated
  using (private.league_role(league_id) in ('owner', 'admin'));

create policy league_players_select on public.league_players
  for select to authenticated
  using (private.is_league_member(league_id));

create policy league_players_write_admin on public.league_players
  for insert to authenticated
  with check (private.league_role(league_id) in ('owner', 'admin'));

create policy league_players_insert_own_player on public.league_players
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.league_members lm
      where lm.league_id = league_players.league_id
        and lm.user_id = private.request_uid()
    )
    and exists (
      select 1
      from public.players p
      where p.id = league_players.player_id
        and p.user_id = private.request_uid()
    )
  );

create policy league_players_update_admin on public.league_players
  for update to authenticated
  using (private.league_role(league_id) in ('owner', 'admin'))
  with check (private.league_role(league_id) in ('owner', 'admin'));

create policy league_players_delete_admin on public.league_players
  for delete to authenticated
  using (private.league_role(league_id) in ('owner', 'admin'));

create policy sessions_select on public.sessions
  for select to authenticated
  using (private.is_league_member(league_id));

create policy sessions_insert on public.sessions
  for insert to authenticated
  with check (
    private.league_role(league_id) in ('owner', 'admin')
    and created_by = private.request_uid()
  );

create policy sessions_update on public.sessions
  for update to authenticated
  using (private.league_role(league_id) in ('owner', 'admin'))
  with check (private.league_role(league_id) in ('owner', 'admin'));

create policy sessions_delete on public.sessions
  for delete to authenticated
  using (private.league_role(league_id) in ('owner', 'admin'));

create policy games_select on public.games
  for select to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = games.session_id
        and private.is_league_member(s.league_id)
    )
  );

create policy games_insert on public.games
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = games.session_id
        and private.league_role(s.league_id) in ('owner', 'admin')
    )
  );

create policy games_update on public.games
  for update to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = games.session_id
        and private.league_role(s.league_id) in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = games.session_id
        and private.league_role(s.league_id) in ('owner', 'admin')
    )
  );

create policy games_delete on public.games
  for delete to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = games.session_id
        and private.league_role(s.league_id) in ('owner', 'admin')
    )
  );

create policy player_stats_select on public.player_stats
  for select to authenticated
  using (private.is_league_member(league_id));
