-- Pair (two-player) wins from completed sessions in Championship court only mode

create table public.pair_championship_stats (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  player_low uuid not null references public.players (id) on delete cascade,
  player_high uuid not null references public.players (id) on delete cascade,
  championship_wins int not null default 0 check (championship_wins >= 0),
  constraint pair_championship_order check (player_low < player_high),
  unique (league_id, player_low, player_high)
);

create index pair_championship_stats_league_id_idx on public.pair_championship_stats (league_id);

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
    case
      when g.winner = 'team_a' then least(g.team_a_players[1], g.team_a_players[2])
      else least(g.team_b_players[1], g.team_b_players[2])
    end as player_low,
    case
      when g.winner = 'team_a' then greatest(g.team_a_players[1], g.team_a_players[2])
      else greatest(g.team_b_players[1], g.team_b_players[2])
    end as player_high,
    count(*)::int as championship_wins
  from public.games g
  join public.sessions s on s.id = g.session_id
  where s.league_id = p_league_id
    and s.status = 'completed'
    and s.input_mode = 'champ_court_only'
  group by
    s.league_id,
    case
      when g.winner = 'team_a' then least(g.team_a_players[1], g.team_a_players[2])
      else least(g.team_b_players[1], g.team_b_players[2])
    end,
    case
      when g.winner = 'team_a' then greatest(g.team_a_players[1], g.team_a_players[2])
      else greatest(g.team_b_players[1], g.team_b_players[2])
    end;
end;
$$;

create or replace function public.recalculate_all_league_stats(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_player_stats_for_league(p_league_id);
  perform public.recalculate_pair_championship_stats_for_league(p_league_id);
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
    perform public.recalculate_all_league_stats(lid);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

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
    perform public.recalculate_all_league_stats(lid);
    return old;
  end if;

  if tg_op = 'INSERT' then
    perform public.recalculate_all_league_stats(new.league_id);
    return new;
  end if;

  old_lid := old.league_id;
  lid := new.league_id;
  if old_lid is distinct from lid then
    perform public.recalculate_all_league_stats(old_lid);
    perform public.recalculate_all_league_stats(lid);
  else
    perform public.recalculate_all_league_stats(lid);
  end if;
  return new;
end;
$$;

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

  perform public.recalculate_all_league_stats(p_league_id);
  return v_player_id;
end;
$$;

alter table public.pair_championship_stats enable row level security;

create policy pair_championship_stats_select on public.pair_championship_stats
  for select to authenticated
  using (private.is_league_member(league_id));
