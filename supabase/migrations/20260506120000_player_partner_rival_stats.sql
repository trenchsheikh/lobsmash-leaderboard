-- Persisted partner & rival aggregates for the profile "Overview" tab
-- (Best Partner, Active Rival, Chemistry inputs) plus a thin recent-form view.
-- Scope: GLOBAL across competitive league sessions and competitive pickup sessions.
-- Friendly play is excluded by design.
--
-- Data flow:
--   league session completes -> apply_skill_rating_for_session
--   pickup session completes -> apply_skill_rating_for_pickup_session
-- Both already run on the same trigger / RPC paths; we extend them to also call
-- recalculate_partner_rival_stats_for_player(player_id) for each participant.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.player_partner_stats (
  player_id uuid not null references public.players (id) on delete cascade,
  partner_id uuid not null references public.players (id) on delete cascade,
  wins int not null default 0 check (wins >= 0),
  losses int not null default 0 check (losses >= 0),
  games_played int not null default 0 check (games_played >= 0),
  current_streak int not null default 0,
  last_played_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (player_id, partner_id),
  constraint partner_stats_not_self check (player_id <> partner_id)
);

create index if not exists player_partner_stats_player_idx
  on public.player_partner_stats (player_id, wins desc, games_played desc);

create table if not exists public.player_rival_stats (
  player_id uuid not null references public.players (id) on delete cascade,
  rival_id uuid not null references public.players (id) on delete cascade,
  wins_for_player int not null default 0 check (wins_for_player >= 0),
  losses_for_player int not null default 0 check (losses_for_player >= 0),
  games_played int not null default 0 check (games_played >= 0),
  current_streak int not null default 0,
  last_meeting_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (player_id, rival_id),
  constraint rival_stats_not_self check (player_id <> rival_id)
);

create index if not exists player_rival_stats_player_idx
  on public.player_rival_stats (player_id, losses_for_player desc, games_played desc);

alter table public.player_partner_stats enable row level security;
alter table public.player_rival_stats enable row level security;

-- Visibility mirrors player_ratings: own player, shared league member, or accepted friend.
create policy player_partner_stats_select on public.player_partner_stats
  for select to authenticated
  using (
    exists (
      select 1
      from public.players p
      where p.id = player_partner_stats.player_id
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
      where p.id = player_partner_stats.player_id
        and p.user_id is not null
        and private.friend_accepted_with(private.request_uid(), p.user_id)
    )
  );

create policy player_rival_stats_select on public.player_rival_stats
  for select to authenticated
  using (
    exists (
      select 1
      from public.players p
      where p.id = player_rival_stats.player_id
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
      where p.id = player_rival_stats.player_id
        and p.user_id is not null
        and private.friend_accepted_with(private.request_uid(), p.user_id)
    )
  );

grant select on public.player_partner_stats to authenticated;
grant select on public.player_rival_stats to authenticated;

-- ---------------------------------------------------------------------------
-- Recompute function (full re-emit per player)
-- ---------------------------------------------------------------------------

create or replace function public.recalculate_partner_rival_stats_for_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_player_id is null then
    return;
  end if;

  -- Pull this player's competitive games (league + pickup) into a temp table
  -- with my_team / i_won / played_at flags. Used twice (partner + rival).
  create temporary table if not exists _my_games (
    played_at timestamptz,
    team_a uuid[],
    team_b uuid[],
    my_team text,
    i_won boolean
  ) on commit drop;

  truncate _my_games;

  insert into _my_games (played_at, team_a, team_b, my_team, i_won)
  select
    coalesce(s.scheduled_at, s.created_at, s.date::timestamptz) as played_at,
    g.team_a_players,
    g.team_b_players,
    case when p_player_id = any (g.team_a_players) then 'a' else 'b' end as my_team,
    case
      when (g.winner = 'team_a' and p_player_id = any (g.team_a_players)) then true
      when (g.winner = 'team_b' and p_player_id = any (g.team_b_players)) then true
      else false
    end as i_won
  from public.games g
  join public.sessions s on s.id = g.session_id
  where s.status = 'completed'
    and s.match_kind = 'competitive'
    and s.input_mode is distinct from 'champ_court_only'
    and (
      p_player_id = any (g.team_a_players)
      or p_player_id = any (g.team_b_players)
    )
  union all
  select
    coalesce(fs.starts_at, fs.created_at) as played_at,
    fg.team_a_players,
    fg.team_b_players,
    case when p_player_id = any (fg.team_a_players) then 'a' else 'b' end as my_team,
    case
      when (fg.winner = 'team_a' and p_player_id = any (fg.team_a_players)) then true
      when (fg.winner = 'team_b' and p_player_id = any (fg.team_b_players)) then true
      else false
    end as i_won
  from public.friendly_session_games fg
  join public.friendly_sessions fs on fs.id = fg.friendly_session_id
  where fs.status = 'completed'
    and fs.match_kind = 'competitive'
    and (
      p_player_id = any (fg.team_a_players)
      or p_player_id = any (fg.team_b_players)
    );

  -- ---------- Partner aggregates ----------
  -- A "partner" is any other player on my team in a given game.
  delete from public.player_partner_stats where player_id = p_player_id;

  with partner_rows as (
    select
      mg.played_at,
      mg.i_won,
      t.partner_id
    from _my_games mg
    cross join lateral unnest(case when mg.my_team = 'a' then mg.team_a else mg.team_b end) as t(partner_id)
  ),
  partner_filtered as (
    select played_at, i_won, partner_id
    from partner_rows
    where partner_id <> p_player_id and partner_id is not null
  ),
  ordered as (
    select
      partner_id,
      played_at,
      i_won,
      row_number() over (partition by partner_id order by played_at desc nulls last) as rn,
      first_value(i_won) over (partition by partner_id order by played_at desc nulls last) as latest_won
    from partner_filtered
  ),
  streaks as (
    select
      partner_id,
      latest_won,
      coalesce(min(rn) filter (where i_won is distinct from latest_won), max(rn) + 1) - 1 as streak_len
    from ordered
    group by partner_id, latest_won
  ),
  totals as (
    select
      partner_id,
      count(*)::int as games_played,
      count(*) filter (where i_won)::int as wins,
      count(*) filter (where not i_won)::int as losses,
      max(played_at) as last_played_at
    from partner_filtered
    group by partner_id
  )
  insert into public.player_partner_stats (
    player_id, partner_id, wins, losses, games_played,
    current_streak, last_played_at, updated_at
  )
  select
    p_player_id,
    t.partner_id,
    t.wins,
    t.losses,
    t.games_played,
    case when s.latest_won then s.streak_len else -s.streak_len end,
    t.last_played_at,
    now()
  from totals t
  left join streaks s on s.partner_id = t.partner_id;

  -- ---------- Rival aggregates ----------
  -- A "rival" is any player on the opposing team in a given game.
  delete from public.player_rival_stats where player_id = p_player_id;

  with rival_rows as (
    select
      mg.played_at,
      mg.i_won,
      t.rival_id
    from _my_games mg
    cross join lateral unnest(case when mg.my_team = 'a' then mg.team_b else mg.team_a end) as t(rival_id)
  ),
  rival_filtered as (
    select played_at, i_won, rival_id
    from rival_rows
    where rival_id <> p_player_id and rival_id is not null
  ),
  ordered as (
    select
      rival_id,
      played_at,
      i_won,
      row_number() over (partition by rival_id order by played_at desc nulls last) as rn,
      first_value(i_won) over (partition by rival_id order by played_at desc nulls last) as latest_won
    from rival_filtered
  ),
  streaks as (
    select
      rival_id,
      latest_won,
      coalesce(min(rn) filter (where i_won is distinct from latest_won), max(rn) + 1) - 1 as streak_len
    from ordered
    group by rival_id, latest_won
  ),
  totals as (
    select
      rival_id,
      count(*)::int as games_played,
      count(*) filter (where i_won)::int as wins_for_player,
      count(*) filter (where not i_won)::int as losses_for_player,
      max(played_at) as last_meeting_at
    from rival_filtered
    group by rival_id
  )
  insert into public.player_rival_stats (
    player_id, rival_id, wins_for_player, losses_for_player, games_played,
    current_streak, last_meeting_at, updated_at
  )
  select
    p_player_id,
    t.rival_id,
    t.wins_for_player,
    t.losses_for_player,
    t.games_played,
    case when s.latest_won then s.streak_len else -s.streak_len end,
    t.last_meeting_at,
    now()
  from totals t
  left join streaks s on s.rival_id = t.rival_id;
end;
$$;

grant execute on function public.recalculate_partner_rival_stats_for_player(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Recent-form view: most recent competitive games per player (caller bounds N).
-- ---------------------------------------------------------------------------

create or replace view public.player_recent_form_v as
with all_games as (
  select
    coalesce(s.scheduled_at, s.created_at, s.date::timestamptz) as played_at,
    g.team_a_players,
    g.team_b_players,
    g.winner,
    g.team_a_score,
    g.team_b_score
  from public.games g
  join public.sessions s on s.id = g.session_id
  where s.status = 'completed'
    and s.match_kind = 'competitive'
    and s.input_mode is distinct from 'champ_court_only'
  union all
  select
    coalesce(fs.starts_at, fs.created_at) as played_at,
    fg.team_a_players,
    fg.team_b_players,
    fg.winner,
    fg.team_a_score,
    fg.team_b_score
  from public.friendly_session_games fg
  join public.friendly_sessions fs on fs.id = fg.friendly_session_id
  where fs.status = 'completed'
    and fs.match_kind = 'competitive'
)
select
  participants.pid as player_id,
  ag.played_at,
  case
    when (ag.winner = 'team_a' and participants.pid = any (ag.team_a_players))
      or (ag.winner = 'team_b' and participants.pid = any (ag.team_b_players))
    then true else false
  end as won,
  case when participants.pid = any (ag.team_a_players) then ag.team_a_score else ag.team_b_score end as our_score,
  case when participants.pid = any (ag.team_a_players) then ag.team_b_score else ag.team_a_score end as opponent_score,
  case when participants.pid = any (ag.team_a_players) then ag.team_a_players else ag.team_b_players end as my_team_ids,
  case when participants.pid = any (ag.team_a_players) then ag.team_b_players else ag.team_a_players end as opponent_ids
from all_games ag
cross join lateral unnest(ag.team_a_players || ag.team_b_players) as participants(pid)
where participants.pid is not null;

grant select on public.player_recent_form_v to authenticated;

-- ---------------------------------------------------------------------------
-- Re-create skill-rating apply functions, adding the partner/rival recompute.
-- Bodies copied verbatim from:
--   20260411150000_league_session_match_kind.sql
--   20260412120000_pickup_match_kind_games_rating.sql
-- with a closing block that recomputes stats for each distinct participant.
-- ---------------------------------------------------------------------------

create or replace function public.apply_skill_rating_for_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sess record;
  default_skill constant double precision := 1500;
  elo_scale constant double precision := 400;
  k_base constant double precision := 32;
  alpha constant double precision := 0.05;
  margin_beta constant double precision := 0.15;
  margin_cap constant double precision := 8;
  champ_temp constant double precision := 200;
  g record;
  sa double precision;
  sb double precision;
  ea double precision;
  oa double precision;
  surprise_a double precision;
  margin_f double precision;
  pid uuid;
  rated_g int;
  k_factor double precision;
  d_delta double precision;
  sum_exp double precision;
  w_total int;
  n_teams int;
  obs_share double precision;
  exp_share double precision;
  participant uuid;
begin
  select id, status, input_mode, skill_rating_applied_at, match_kind
  into sess
  from public.sessions
  where id = p_session_id
  for update;

  if not found then
    return;
  end if;

  if sess.status is distinct from 'completed' then
    return;
  end if;

  if sess.skill_rating_applied_at is not null then
    return;
  end if;

  if sess.match_kind is not distinct from 'friendly' then
    return;
  end if;

  create temporary table if not exists _skill_rating_deltas (
    player_id uuid primary key,
    delta double precision not null default 0,
    games_inc int not null default 0
  ) on commit drop;

  truncate _skill_rating_deltas;

  if sess.input_mode is null or sess.input_mode = 'full' then
    for g in
      select
        g2.team_a_players,
        g2.team_b_players,
        g2.team_a_score,
        g2.team_b_score,
        g2.winner
      from public.games g2
      where g2.session_id = p_session_id
      order by g2.court_number, g2.id
    loop
      select coalesce(avg(coalesce(pr.skill, default_skill)), default_skill)
      into sa
      from unnest(g.team_a_players) as pa(pid)
      left join public.player_ratings pr on pr.player_id = pa.pid;

      select coalesce(avg(coalesce(pr.skill, default_skill)), default_skill)
      into sb
      from unnest(g.team_b_players) as pb(pid)
      left join public.player_ratings pr on pr.player_id = pb.pid;

      ea := 1.0 / (1.0 + power(10.0, (sb - sa) / elo_scale));
      if g.winner = 'team_a' then
        oa := 1.0;
      else
        oa := 0.0;
      end if;
      surprise_a := oa - ea;

      margin_f := 1.0 + margin_beta * least(
        greatest(abs(g.team_a_score - g.team_b_score)::double precision / margin_cap, 0.0),
        1.0
      );

      for pid in select unnest(g.team_a_players)
      loop
        if exists (select 1 from public.players pl where pl.id = pid and pl.user_id is not null) then
          rated_g := coalesce(
            (select pr.rated_games from public.player_ratings pr where pr.player_id = pid),
            0
          );

          k_factor := k_base / (1.0 + alpha * rated_g);
          d_delta := k_factor * surprise_a * margin_f;

          insert into _skill_rating_deltas (player_id, delta, games_inc)
          values (pid, d_delta, 1)
          on conflict (player_id) do update
          set
            delta = _skill_rating_deltas.delta + excluded.delta,
            games_inc = _skill_rating_deltas.games_inc + excluded.games_inc;
        end if;
      end loop;

      for pid in select unnest(g.team_b_players)
      loop
        if exists (select 1 from public.players pl where pl.id = pid and pl.user_id is not null) then
          rated_g := coalesce(
            (select pr.rated_games from public.player_ratings pr where pr.player_id = pid),
            0
          );

          k_factor := k_base / (1.0 + alpha * rated_g);
          d_delta := k_factor * (-surprise_a) * margin_f;

          insert into _skill_rating_deltas (player_id, delta, games_inc)
          values (pid, d_delta, 1)
          on conflict (player_id) do update
          set
            delta = _skill_rating_deltas.delta + excluded.delta,
            games_inc = _skill_rating_deltas.games_inc + excluded.games_inc;
        end if;
      end loop;
    end loop;

  elsif sess.input_mode = 'champ_court_only' then
    select coalesce(sum(sc.wins), 0)::int
    into w_total
    from public.session_court1_pair_wins sc
    where sc.session_id = p_session_id;

    if w_total <= 0 then
      update public.sessions
      set skill_rating_applied_at = now()
      where id = p_session_id;
      return;
    end if;

    select count(*)::int
    into n_teams
    from public.session_teams st
    where st.session_id = p_session_id;

    if n_teams <= 0 then
      update public.sessions
      set skill_rating_applied_at = now()
      where id = p_session_id;
      return;
    end if;

    create temporary table if not exists _champ_pairs (
      sort_order int,
      player_low uuid,
      player_high uuid,
      wins int,
      team_skill double precision,
      exp_share double precision
    ) on commit drop;

    truncate _champ_pairs;

    insert into _champ_pairs (sort_order, player_low, player_high, wins, team_skill, exp_share)
    select
      st.sort_order,
      least(st.player_a, st.player_b),
      greatest(st.player_a, st.player_b),
      coalesce(sc.wins, 0),
      (
        coalesce((select pr.skill from public.player_ratings pr where pr.player_id = st.player_a), default_skill)
        + coalesce((select pr.skill from public.player_ratings pr where pr.player_id = st.player_b), default_skill)
      ) / 2.0,
      0::double precision
    from public.session_teams st
    left join public.session_court1_pair_wins sc
      on sc.session_id = st.session_id
     and sc.player_low = least(st.player_a, st.player_b)
     and sc.player_high = greatest(st.player_a, st.player_b)
    where st.session_id = p_session_id
    order by st.sort_order;

    select coalesce(sum(exp(cp.team_skill / champ_temp)), 0)::double precision
    into sum_exp
    from _champ_pairs cp;

    if sum_exp <= 0 then
      sum_exp := 1.0;
    end if;

    update _champ_pairs cp
    set exp_share = exp(cp.team_skill / champ_temp) / sum_exp
    where true;

    for g in select * from _champ_pairs order by sort_order
    loop
      obs_share := g.wins::double precision / w_total::double precision;
      exp_share := coalesce(g.exp_share, 0);

      for pid in select unnest(array[g.player_low, g.player_high])
      loop
        if exists (select 1 from public.players pl where pl.id = pid and pl.user_id is not null) then
          rated_g := coalesce(
            (select pr.rated_games from public.player_ratings pr where pr.player_id = pid),
            0
          );

          k_factor := k_base / (1.0 + alpha * rated_g);
          d_delta := k_factor * (obs_share - exp_share);

          insert into _skill_rating_deltas (player_id, delta, games_inc)
          values (pid, d_delta, 1)
          on conflict (player_id) do update
          set
            delta = _skill_rating_deltas.delta + excluded.delta,
            games_inc = 1;
        end if;
      end loop;
    end loop;
  end if;

  update public.player_ratings pr
  set
    skill = pr.skill + d.delta,
    rated_games = pr.rated_games + d.games_inc,
    updated_at = now()
  from _skill_rating_deltas d
  where pr.player_id = d.player_id;

  insert into public.player_ratings (player_id, skill, rated_games, updated_at)
  select d.player_id, default_skill + d.delta, d.games_inc, now()
  from _skill_rating_deltas d
  where not exists (select 1 from public.player_ratings pr2 where pr2.player_id = d.player_id);

  update public.sessions
  set skill_rating_applied_at = now()
  where id = p_session_id;

  -- Recompute partner/rival aggregates for every participant of this session.
  for participant in
    select distinct p
    from public.games g
    cross join lateral unnest(g.team_a_players || g.team_b_players) as t(p)
    where g.session_id = p_session_id
      and exists (select 1 from public.players pl where pl.id = t.p and pl.user_id is not null)
  loop
    perform public.recalculate_partner_rival_stats_for_player(participant);
  end loop;
end;
$$;

create or replace function public.apply_skill_rating_for_pickup_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fs record;
  g record;
  default_skill constant double precision := 1500;
  elo_scale constant double precision := 400;
  k_base constant double precision := 32;
  alpha constant double precision := 0.05;
  margin_beta constant double precision := 0.15;
  margin_cap constant double precision := 8;
  sa double precision;
  sb double precision;
  ea double precision;
  oa double precision;
  surprise_a double precision;
  margin_f double precision;
  pid uuid;
  rated_g int;
  k_factor double precision;
  d_delta double precision;
  participant uuid;
begin
  select id, status, match_kind, skill_rating_applied_at
  into fs
  from public.friendly_sessions
  where id = p_session_id
  for update;

  if not found then
    return;
  end if;

  if fs.status is distinct from 'completed' then
    return;
  end if;

  if fs.skill_rating_applied_at is not null then
    return;
  end if;

  if fs.match_kind is distinct from 'competitive' then
    return;
  end if;

  create temporary table if not exists _pickup_skill_deltas (
    player_id uuid primary key,
    delta double precision not null default 0,
    games_inc int not null default 0
  ) on commit drop;

  truncate _pickup_skill_deltas;

  for g in
    select
      g2.team_a_players,
      g2.team_b_players,
      g2.team_a_score,
      g2.team_b_score,
      g2.winner
    from public.friendly_session_games g2
    where g2.friendly_session_id = p_session_id
    order by g2.court_number, g2.id
  loop
    select coalesce(avg(coalesce(pr.skill, default_skill)), default_skill)
    into sa
    from unnest(g.team_a_players) as pa(pid)
    left join public.player_ratings pr on pr.player_id = pa.pid;

    select coalesce(avg(coalesce(pr.skill, default_skill)), default_skill)
    into sb
    from unnest(g.team_b_players) as pb(pid)
    left join public.player_ratings pr on pr.player_id = pb.pid;

    ea := 1.0 / (1.0 + power(10.0, (sb - sa) / elo_scale));
    if g.winner = 'team_a' then
      oa := 1.0;
    else
      oa := 0.0;
    end if;
    surprise_a := oa - ea;

    margin_f := 1.0 + margin_beta * least(
      greatest(abs(g.team_a_score - g.team_b_score)::double precision / margin_cap, 0.0),
      1.0
    );

    for pid in select unnest(g.team_a_players)
    loop
      if exists (select 1 from public.players pl where pl.id = pid and pl.user_id is not null) then
        rated_g := coalesce(
          (select pr.rated_games from public.player_ratings pr where pr.player_id = pid),
          0
        );

        k_factor := k_base / (1.0 + alpha * rated_g);
        d_delta := k_factor * surprise_a * margin_f;

        insert into _pickup_skill_deltas (player_id, delta, games_inc)
        values (pid, d_delta, 1)
        on conflict (player_id) do update
        set
          delta = _pickup_skill_deltas.delta + excluded.delta,
          games_inc = _pickup_skill_deltas.games_inc + excluded.games_inc;
      end if;
    end loop;

    for pid in select unnest(g.team_b_players)
    loop
      if exists (select 1 from public.players pl where pl.id = pid and pl.user_id is not null) then
        rated_g := coalesce(
          (select pr.rated_games from public.player_ratings pr where pr.player_id = pid),
          0
        );

        k_factor := k_base / (1.0 + alpha * rated_g);
        d_delta := k_factor * (-surprise_a) * margin_f;

        insert into _pickup_skill_deltas (player_id, delta, games_inc)
        values (pid, d_delta, 1)
        on conflict (player_id) do update
        set
          delta = _pickup_skill_deltas.delta + excluded.delta,
          games_inc = _pickup_skill_deltas.games_inc + excluded.games_inc;
      end if;
    end loop;
  end loop;

  update public.player_ratings pr
  set
    skill = pr.skill + d.delta,
    rated_games = pr.rated_games + d.games_inc,
    updated_at = now()
  from _pickup_skill_deltas d
  where pr.player_id = d.player_id;

  insert into public.player_ratings (player_id, skill, rated_games, updated_at)
  select d.player_id, default_skill + d.delta, d.games_inc, now()
  from _pickup_skill_deltas d
  where not exists (select 1 from public.player_ratings pr2 where pr2.player_id = d.player_id);

  update public.friendly_sessions
  set skill_rating_applied_at = now()
  where id = p_session_id;

  -- Recompute partner/rival aggregates for every participant of this pickup.
  for participant in
    select distinct p
    from public.friendly_session_games g
    cross join lateral unnest(g.team_a_players || g.team_b_players) as t(p)
    where g.friendly_session_id = p_session_id
      and exists (select 1 from public.players pl where pl.id = t.p and pl.user_id is not null)
  loop
    perform public.recalculate_partner_rival_stats_for_player(participant);
  end loop;
end;
$$;

grant execute on function public.apply_skill_rating_for_pickup_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- One-time backfill: recompute for every player who has a competitive game.
-- ---------------------------------------------------------------------------

do $backfill$
declare
  participant uuid;
begin
  for participant in
    select distinct p from (
      select unnest(g.team_a_players || g.team_b_players) as p
      from public.games g
      join public.sessions s on s.id = g.session_id
      where s.status = 'completed'
        and s.match_kind = 'competitive'
        and s.input_mode is distinct from 'champ_court_only'
      union all
      select unnest(fg.team_a_players || fg.team_b_players) as p
      from public.friendly_session_games fg
      join public.friendly_sessions fs on fs.id = fg.friendly_session_id
      where fs.status = 'completed'
        and fs.match_kind = 'competitive'
    ) parts
    where p is not null
      and exists (select 1 from public.players pl where pl.id = parts.p and pl.user_id is not null)
  loop
    perform public.recalculate_partner_rival_stats_for_player(participant);
  end loop;
end;
$backfill$;
