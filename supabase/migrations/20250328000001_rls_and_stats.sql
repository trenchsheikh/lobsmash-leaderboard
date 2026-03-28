-- Helper functions (avoid recursive RLS)
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
      and lm.user_id = auth.uid()
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
    and lm.user_id = auth.uid()
  limit 1;
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_league_member(uuid) to authenticated;
grant execute on function private.league_role(uuid) to authenticated;

-- Stats recompute (SECURITY DEFINER; called from triggers)
create or replace function public.recalculate_player_stats_for_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  tg int;
  tw int;
  c1 int;
  tp int;
begin
  delete from public.player_stats where league_id = p_league_id;

  for pid in
    select lp.player_id
    from public.league_players lp
    where lp.league_id = p_league_id
  loop
    select
      coalesce(count(*), 0)::int,
      coalesce(sum(case when won then 1 else 0 end), 0)::int,
      coalesce(sum(case when won and cn = 1 then 1 else 0 end), 0)::int,
      coalesce(sum(pts), 0)::int
    into tg, tw, c1, tp
    from (
      select
        g.court_number as cn,
        case
          when g.winner = 'team_a' and pid = any (g.team_a_players) then true
          when g.winner = 'team_b' and pid = any (g.team_b_players) then true
          else false
        end as won,
        case
          when pid = any (g.team_a_players) then g.team_a_score
          when pid = any (g.team_b_players) then g.team_b_score
          else 0
        end as pts
      from public.games g
      join public.sessions s on s.id = g.session_id
      where s.league_id = p_league_id
        and (pid = any (g.team_a_players) or pid = any (g.team_b_players))
    ) x;

    insert into public.player_stats (
      player_id,
      league_id,
      total_games,
      total_wins,
      court1_wins,
      total_points
    )
    values (pid, p_league_id, tg, tw, c1, tp);
  end loop;
end;
$$;

create or replace function public.trg_games_recalc_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  if tg_op = 'DELETE' then
    select s.league_id into lid from public.sessions s where s.id = old.session_id;
  else
    select s.league_id into lid from public.sessions s where s.id = new.session_id;
  end if;
  if lid is not null then
    perform public.recalculate_player_stats_for_league(lid);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger games_recalc_stats
  after insert or update or delete on public.games
  for each row execute function public.trg_games_recalc_stats();

-- Guest player creation (RLS-safe)
create or replace function public.create_guest_player(
  p_league_id uuid,
  p_name text,
  p_playstyle text,
  p_strengths text[],
  p_weaknesses text[],
  p_preferred_side text,
  p_experience_level text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.league_member_role;
  v_player_id uuid;
begin
  select private.league_role(p_league_id) into r;
  if r is null or r not in ('owner', 'admin') then
    raise exception 'not allowed';
  end if;

  insert into public.players (
    user_id,
    name,
    playstyle,
    strengths,
    weaknesses,
    preferred_side,
    experience_level
  )
  values (
    null,
    trim(p_name),
    p_playstyle,
    coalesce(p_strengths, '{}'),
    coalesce(p_weaknesses, '{}'),
    p_preferred_side,
    p_experience_level
  )
  returning id into v_player_id;

  insert into public.league_players (league_id, player_id)
  values (p_league_id, v_player_id);

  perform public.recalculate_player_stats_for_league(p_league_id);
  return v_player_id;
end;
$$;

grant execute on function public.create_guest_player(
  uuid, text, text, text[], text[], text, text
) to authenticated;

-- Join league by code (validates membership + onboarding; bypasses unsafe self-insert on league_members)
create or replace function public.join_league_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  pid uuid;
begin
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
      and lm.user_id = auth.uid()
  ) then
    raise exception 'already joined';
  end if;

  select id
  into pid
  from public.players
  where user_id = auth.uid()
  limit 1;

  if pid is null then
    raise exception 'complete onboarding first';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (lid, auth.uid(), 'player');

  insert into public.league_players (league_id, player_id)
  values (lid, pid)
  on conflict do nothing;

  return lid;
end;
$$;

grant execute on function public.join_league_by_code(text) to authenticated;

-- RLS
alter table public.users enable row level security;
alter table public.players enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_players enable row level security;
alter table public.sessions enable row level security;
alter table public.games enable row level security;
alter table public.player_stats enable row level security;

-- users
create policy users_select_own on public.users
  for select to authenticated using (id = auth.uid());

create policy users_select_same_league on public.users
  for select to authenticated using (
    exists (
      select 1
      from public.league_members lm_self
      join public.league_members lm_other
        on lm_self.league_id = lm_other.league_id
      where lm_self.user_id = auth.uid()
        and lm_other.user_id = users.id
    )
  );

create policy users_update_own on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- players
create policy players_select on public.players
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.league_players lp
      join public.league_members lm
        on lm.league_id = lp.league_id
      where lp.player_id = players.id
        and lm.user_id = auth.uid()
    )
  );

create policy players_insert_own on public.players
  for insert to authenticated
  with check (user_id = auth.uid());

create policy players_update_own on public.players
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- leagues
create policy leagues_select_member on public.leagues
  for select to authenticated
  using (private.is_league_member(id));

create policy leagues_insert on public.leagues
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy leagues_update_admin on public.leagues
  for update to authenticated
  using (private.league_role(id) in ('owner', 'admin'))
  with check (private.league_role(id) in ('owner', 'admin'));

create policy leagues_delete_owner on public.leagues
  for delete to authenticated
  using (private.league_role(id) = 'owner');

-- league_members
create policy league_members_select on public.league_members
  for select to authenticated
  using (private.is_league_member(league_id));

create policy league_members_insert_admin on public.league_members
  for insert to authenticated
  with check (private.league_role(league_id) in ('owner', 'admin'));

create policy league_members_update_admin on public.league_members
  for update to authenticated
  using (private.league_role(league_id) in ('owner', 'admin'))
  with check (private.league_role(league_id) in ('owner', 'admin'));

create policy league_members_delete_self on public.league_members
  for delete to authenticated
  using (user_id = auth.uid());

create policy league_members_delete_admin on public.league_members
  for delete to authenticated
  using (private.league_role(league_id) in ('owner', 'admin'));

-- league_players
create policy league_players_select on public.league_players
  for select to authenticated
  using (private.is_league_member(league_id));

create policy league_players_write_admin on public.league_players
  for insert to authenticated
  with check (private.league_role(league_id) in ('owner', 'admin'));

-- Member links their own player profile to a league they already belong to
create policy league_players_insert_own_player on public.league_players
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.league_members lm
      where lm.league_id = league_players.league_id
        and lm.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.players p
      where p.id = league_players.player_id
        and p.user_id = auth.uid()
    )
  );

create policy league_players_update_admin on public.league_players
  for update to authenticated
  using (private.league_role(league_id) in ('owner', 'admin'))
  with check (private.league_role(league_id) in ('owner', 'admin'));

create policy league_players_delete_admin on public.league_players
  for delete to authenticated
  using (private.league_role(league_id) in ('owner', 'admin'));

-- sessions
create policy sessions_select on public.sessions
  for select to authenticated
  using (private.is_league_member(league_id));

create policy sessions_insert on public.sessions
  for insert to authenticated
  with check (
    private.league_role(league_id) in ('owner', 'admin')
    and created_by = auth.uid()
  );

create policy sessions_update on public.sessions
  for update to authenticated
  using (private.league_role(league_id) in ('owner', 'admin'))
  with check (private.league_role(league_id) in ('owner', 'admin'));

create policy sessions_delete on public.sessions
  for delete to authenticated
  using (private.league_role(league_id) in ('owner', 'admin'));

-- games
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

-- player_stats: read for members; writes only via trigger / definer function
create policy player_stats_select on public.player_stats
  for select to authenticated
  using (private.is_league_member(league_id));
