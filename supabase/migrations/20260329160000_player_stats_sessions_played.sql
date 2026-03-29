-- Distinct completed sessions per player (full scoring vs champ court) for leaderboard "Sessions" column.

alter table public.player_stats
  add column if not exists sessions_played int not null default 0 check (sessions_played >= 0);

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
  champ_w int;
  sp int;
  sp_full int;
  sp_champ int;
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
        and s.input_mode is distinct from 'champ_court_only'
        and (pid = any (g.team_a_players) or pid = any (g.team_b_players))
    ) x;

    select coalesce(count(distinct g.session_id), 0)::int
    into sp_full
    from public.games g
    join public.sessions s on s.id = g.session_id
    where s.league_id = p_league_id
      and s.status = 'completed'
      and s.input_mode is distinct from 'champ_court_only'
      and (pid = any (g.team_a_players) or pid = any (g.team_b_players));

    select coalesce(sum(sc.wins), 0)::int
    into champ_w
    from public.session_court1_pair_wins sc
    join public.sessions s on s.id = sc.session_id
    where s.league_id = p_league_id
      and s.status = 'completed'
      and s.input_mode = 'champ_court_only'
      and (pid = sc.player_low or pid = sc.player_high);

    select coalesce(count(distinct sc.session_id), 0)::int
    into sp_champ
    from public.session_court1_pair_wins sc
    join public.sessions s on s.id = sc.session_id
    where s.league_id = p_league_id
      and s.status = 'completed'
      and s.input_mode = 'champ_court_only'
      and (pid = sc.player_low or pid = sc.player_high);

    sp := sp_full + sp_champ;

    tg := tg + champ_w;
    tw := tw + champ_w;
    c1 := c1 + champ_w;

    insert into public.player_stats (
      player_id,
      league_id,
      total_games,
      total_wins,
      court1_wins,
      total_points,
      sessions_played
    )
    values (pid, p_league_id, tg, tw, c1, tp, sp);
  end loop;
end;
$$;

do $$
declare
  lid uuid;
begin
  for lid in
    select id from public.leagues
  loop
    perform public.recalculate_all_league_stats(lid);
  end loop;
end;
$$;
