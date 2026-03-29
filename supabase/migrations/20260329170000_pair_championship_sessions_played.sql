-- Sessions per fixed pair (completed champ sessions where the pair has court-1 win rows).

alter table public.pair_championship_stats
  add column if not exists sessions_played int not null default 0 check (sessions_played >= 0);

create or replace function public.recalculate_pair_championship_stats_for_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.pair_championship_stats where league_id = p_league_id;

  insert into public.pair_championship_stats (
    league_id,
    player_low,
    player_high,
    championship_wins,
    sessions_played
  )
  select
    s.league_id,
    sc.player_low,
    sc.player_high,
    sum(sc.wins)::int as championship_wins,
    count(distinct sc.session_id)::int as sessions_played
  from public.session_court1_pair_wins sc
  join public.sessions s on s.id = sc.session_id
  where s.league_id = p_league_id
    and s.status = 'completed'
    and s.input_mode = 'champ_court_only'
  group by s.league_id, sc.player_low, sc.player_high;
end;
$$;

do $$
declare
  lid uuid;
begin
  for lid in
    select id from public.leagues
  loop
    perform public.recalculate_pair_championship_stats_for_league(lid);
  end loop;
end;
$$;
