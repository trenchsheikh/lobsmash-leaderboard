-- Stats: only count games from completed sessions
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
        and s.status = 'completed'
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

-- Recalc when session status (or league) changes so completing a session updates stats
create or replace function public.trg_sessions_recalc_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  old_lid uuid;
begin
  if tg_op = 'DELETE' then
    lid := old.league_id;
    perform public.recalculate_player_stats_for_league(lid);
    return old;
  end if;

  if tg_op = 'INSERT' then
    perform public.recalculate_player_stats_for_league(new.league_id);
    return new;
  end if;

  -- UPDATE
  old_lid := old.league_id;
  lid := new.league_id;
  if old_lid is distinct from lid then
    perform public.recalculate_player_stats_for_league(old_lid);
    perform public.recalculate_player_stats_for_league(lid);
  else
    perform public.recalculate_player_stats_for_league(lid);
  end if;
  return new;
end;
$$;

drop trigger if exists sessions_recalc_stats on public.sessions;

create trigger sessions_recalc_stats
  after insert or update of status, league_id or delete on public.sessions
  for each row execute function public.trg_sessions_recalc_stats();

-- League default court count for UI
alter table public.leagues add column if not exists last_court_count int
  check (last_court_count is null or (last_court_count >= 1 and last_court_count <= 12));

-- Session metadata
alter table public.sessions add column if not exists num_courts int
  not null default 1 check (num_courts between 1 and 12);
alter table public.sessions add column if not exists input_mode text
  not null default 'full' check (input_mode in ('full', 'champ_court_only'));

-- Team pool per session
create table public.session_teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  sort_order int not null default 0,
  player_a uuid not null references public.players (id) on delete cascade,
  player_b uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint session_teams_distinct_players check (player_a <> player_b)
);

create unique index session_teams_session_pair_unique on public.session_teams (
  session_id,
  least(player_a::text, player_b::text),
  greatest(player_a::text, player_b::text)
);

create index session_teams_session_id_idx on public.session_teams (session_id);

alter table public.session_teams enable row level security;

create policy session_teams_select on public.session_teams
  for select to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_teams.session_id
        and private.is_league_member(s.league_id)
    )
  );

create policy session_teams_insert on public.session_teams
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = session_teams.session_id
        and private.league_role(s.league_id) in ('owner', 'admin')
    )
  );

create policy session_teams_update on public.session_teams
  for update to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_teams.session_id
        and private.league_role(s.league_id) in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = session_teams.session_id
        and private.league_role(s.league_id) in ('owner', 'admin')
    )
  );

create policy session_teams_delete on public.session_teams
  for delete to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_teams.session_id
        and private.league_role(s.league_id) in ('owner', 'admin')
    )
  );
