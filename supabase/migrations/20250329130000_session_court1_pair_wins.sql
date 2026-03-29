-- Per-session court-1 win counts per pair (Championship court only mode; no scores)

create table public.session_court1_pair_wins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  player_low uuid not null references public.players (id) on delete cascade,
  player_high uuid not null references public.players (id) on delete cascade,
  wins int not null default 0 check (wins >= 0 and wins <= 999),
  constraint session_court1_pair_order check (player_low < player_high),
  unique (session_id, player_low, player_high)
);

create index session_court1_pair_wins_session_id_idx on public.session_court1_pair_wins (session_id);

alter table public.session_court1_pair_wins enable row level security;

create policy session_court1_pair_wins_select on public.session_court1_pair_wins
  for select to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_court1_pair_wins.session_id
        and private.is_league_member(s.league_id)
    )
  );

create policy session_court1_pair_wins_insert on public.session_court1_pair_wins
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = session_court1_pair_wins.session_id
        and private.league_role(s.league_id) in ('owner', 'admin')
    )
  );

create policy session_court1_pair_wins_update on public.session_court1_pair_wins
  for update to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_court1_pair_wins.session_id
        and private.league_role(s.league_id) in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = session_court1_pair_wins.session_id
        and private.league_role(s.league_id) in ('owner', 'admin')
    )
  );

create policy session_court1_pair_wins_delete on public.session_court1_pair_wins
  for delete to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_court1_pair_wins.session_id
        and private.league_role(s.league_id) in ('owner', 'admin')
    )
  );

-- Player stats: exclude games from champ_court_only sessions; add session_court1_pair_wins
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

    select coalesce(sum(sc.wins), 0)::int
    into champ_w
    from public.session_court1_pair_wins sc
    join public.sessions s on s.id = sc.session_id
    where s.league_id = p_league_id
      and s.status = 'completed'
      and s.input_mode = 'champ_court_only'
      and (pid = sc.player_low or pid = sc.player_high);

    tg := tg + champ_w;
    tw := tw + champ_w;
    c1 := c1 + champ_w;

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

-- Pair championship: sum logged court-1 wins per pair (not games rows)
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
    championship_wins
  )
  select
    s.league_id,
    sc.player_low,
    sc.player_high,
    sum(sc.wins)::int as championship_wins
  from public.session_court1_pair_wins sc
  join public.sessions s on s.id = sc.session_id
  where s.league_id = p_league_id
    and s.status = 'completed'
    and s.input_mode = 'champ_court_only'
  group by s.league_id, sc.player_low, sc.player_high;
end;
$$;

create or replace function public.trg_session_court1_pair_wins_recalc_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  lid uuid;
begin
  if tg_op = 'DELETE' then
    sid := old.session_id;
  else
    sid := new.session_id;
  end if;

  select s.league_id into lid from public.sessions s where s.id = sid;
  if lid is not null then
    perform public.recalculate_all_league_stats(lid);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists session_court1_pair_wins_recalc_stats on public.session_court1_pair_wins;

create trigger session_court1_pair_wins_recalc_stats
  after insert or update or delete on public.session_court1_pair_wins
  for each row execute function public.trg_session_court1_pair_wins_recalc_stats();

-- Backfill: legacy champ sessions that used games on court 1 only (suppress row trigger batch noise)
alter table public.session_court1_pair_wins disable trigger session_court1_pair_wins_recalc_stats;

insert into public.session_court1_pair_wins (session_id, player_low, player_high, wins)
select
  agg.session_id,
  agg.player_low,
  agg.player_high,
  agg.win_count::int
from (
  select
    g.session_id,
    case
      when g.winner = 'team_a' then least(g.team_a_players[1], g.team_a_players[2])
      else least(g.team_b_players[1], g.team_b_players[2])
    end as player_low,
    case
      when g.winner = 'team_a' then greatest(g.team_a_players[1], g.team_a_players[2])
      else greatest(g.team_b_players[1], g.team_b_players[2])
    end as player_high,
    count(*)::bigint as win_count
  from public.games g
  join public.sessions s on s.id = g.session_id
  where s.input_mode = 'champ_court_only'
    and s.status = 'completed'
    and g.court_number = 1
    and not exists (
      select 1
      from public.session_court1_pair_wins x
      where x.session_id = g.session_id
    )
  group by
    g.session_id,
    case
      when g.winner = 'team_a' then least(g.team_a_players[1], g.team_a_players[2])
      else least(g.team_b_players[1], g.team_b_players[2])
    end,
    case
      when g.winner = 'team_a' then greatest(g.team_a_players[1], g.team_a_players[2])
      else greatest(g.team_b_players[1], g.team_b_players[2])
    end
) agg
where agg.win_count > 0;

alter table public.session_court1_pair_wins enable trigger session_court1_pair_wins_recalc_stats;

do $$
declare
  lid uuid;
begin
  for lid in
    select distinct s.league_id
    from public.session_court1_pair_wins sc
    join public.sessions s on s.id = sc.session_id
  loop
    perform public.recalculate_all_league_stats(lid);
  end loop;
end;
$$;
