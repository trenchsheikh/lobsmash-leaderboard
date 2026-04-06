-- pg_safeupdate on Supabase rejects UPDATE with no WHERE. Champ softmax step must qualify rows.
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
begin
  select id, status, input_mode, skill_rating_applied_at
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
          select coalesce(pr.rated_games, 0)
          into rated_g
          from public.player_ratings pr
          where pr.player_id = pid;

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
          select coalesce(pr.rated_games, 0)
          into rated_g
          from public.player_ratings pr
          where pr.player_id = pid;

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
          select coalesce(pr.rated_games, 0)
          into rated_g
          from public.player_ratings pr
          where pr.player_id = pid;

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
end;
$$;

create or replace function public.reverse_skill_rating_for_session(p_session_id uuid)
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
  lrole text;
begin
  select private.league_role(s.league_id)
  into lrole
  from public.sessions s
  where s.id = p_session_id;

  if lrole is null or lrole not in ('owner', 'admin') then
    raise exception 'not allowed';
  end if;

  select id, status, input_mode, skill_rating_applied_at
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

  if sess.skill_rating_applied_at is null then
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
          select coalesce(pr.rated_games, 0)
          into rated_g
          from public.player_ratings pr
          where pr.player_id = pid;

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
          select coalesce(pr.rated_games, 0)
          into rated_g
          from public.player_ratings pr
          where pr.player_id = pid;

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
      set skill_rating_applied_at = null
      where id = p_session_id;
      return;
    end if;

    select count(*)::int
    into n_teams
    from public.session_teams st
    where st.session_id = p_session_id;

    if n_teams <= 0 then
      update public.sessions
      set skill_rating_applied_at = null
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
          select coalesce(pr.rated_games, 0)
          into rated_g
          from public.player_ratings pr
          where pr.player_id = pid;

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
    skill = pr.skill - d.delta,
    rated_games = pr.rated_games - d.games_inc,
    updated_at = now()
  from _skill_rating_deltas d
  where pr.player_id = d.player_id;

  update public.sessions
  set skill_rating_applied_at = null
  where id = p_session_id;
end;
$$;

grant execute on function public.reverse_skill_rating_for_session(uuid) to authenticated;