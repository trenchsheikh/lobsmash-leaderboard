-- Pickup sessions: friendly vs competitive on dashboard; games + skill rating for competitive.

alter table public.friendly_sessions
  add column if not exists match_kind text not null default 'friendly'
  check (match_kind in ('friendly', 'competitive'));

alter table public.friendly_sessions
  add column if not exists skill_rating_applied_at timestamptz;

alter table public.friendly_sessions drop constraint if exists friendly_sessions_status_check;

alter table public.friendly_sessions
  add constraint friendly_sessions_status_check
  check (status in ('open', 'cancelled', 'completed'));

comment on column public.friendly_sessions.match_kind is
  'friendly: no global skill change; competitive: skill rating when completed with games.';
comment on column public.friendly_sessions.skill_rating_applied_at is
  'Idempotent marker after apply_skill_rating_for_pickup_session.';

-- Per-game results for pickup (mirrors public.games shape; player_id uuid arrays).
create table if not exists public.friendly_session_games (
  id uuid primary key default gen_random_uuid(),
  friendly_session_id uuid not null references public.friendly_sessions (id) on delete cascade,
  court_number int not null check (court_number >= 1),
  team_a_players uuid[] not null,
  team_b_players uuid[] not null,
  team_a_score int not null check (team_a_score >= 0),
  team_b_score int not null check (team_b_score >= 0),
  winner text not null check (winner in ('team_a', 'team_b')),
  constraint friendly_session_games_winner_matches_score check (
    (winner = 'team_a' and team_a_score > team_b_score)
    or (winner = 'team_b' and team_b_score > team_a_score)
  )
);

create index if not exists friendly_session_games_session_id_idx
  on public.friendly_session_games (friendly_session_id);

alter table public.friendly_session_games enable row level security;

-- Creator or roster: read games when session visible to them (same as friendly_sessions visibility).
create policy friendly_session_games_select on public.friendly_session_games
  for select to authenticated
  using (
    exists (
      select 1 from public.friendly_sessions s
      where s.id = friendly_session_games.friendly_session_id
        and (
          s.creator_user_id = private.request_uid()
          or exists (
            select 1 from public.friendly_session_roster r
            where r.session_id = s.id and r.user_id = private.request_uid()
          )
          or exists (
            select 1 from public.friendly_session_join_requests q
            where q.session_id = s.id and q.user_id = private.request_uid()
          )
        )
    )
  );

create policy friendly_session_games_insert on public.friendly_session_games
  for insert to authenticated
  with check (
    exists (
      select 1 from public.friendly_sessions s
      where s.id = friendly_session_games.friendly_session_id
        and s.status = 'open'
        and (
          s.creator_user_id = private.request_uid()
          or exists (
            select 1 from public.friendly_session_roster r
            where r.session_id = s.id and r.user_id = private.request_uid()
          )
        )
    )
  );

create policy friendly_session_games_delete on public.friendly_session_games
  for delete to authenticated
  using (
    exists (
      select 1 from public.friendly_sessions s
      where s.id = friendly_session_games.friendly_session_id
        and s.status = 'open'
        and (
          s.creator_user_id = private.request_uid()
          or exists (
            select 1 from public.friendly_session_roster r
            where r.session_id = s.id and r.user_id = private.request_uid()
          )
        )
    )
  );

grant select, insert, delete on public.friendly_session_games to authenticated;

-- Replace create_friendly_session with match_kind (drop old 3-arg signature).
drop function if exists public.create_friendly_session(int, text, timestamptz);

create or replace function public.create_friendly_session(
  p_capacity int,
  p_title text default null,
  p_starts_at timestamptz default null,
  p_match_kind text default 'friendly'
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
  mk text := coalesce(nullif(trim(p_match_kind), ''), 'friendly');
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if mk not in ('friendly', 'competitive') then
    raise exception 'invalid match kind';
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

  insert into public.friendly_sessions as fs (creator_user_id, capacity, title, starts_at, match_kind)
  values (uid, p_capacity, nullif(trim(p_title), ''), p_starts_at, mk)
  returning fs.id, fs.invite_token into sid, tok;

  insert into public.friendly_session_roster (session_id, user_id, slot_index)
  values (sid, uid, 0);

  return query select sid, tok;
end;
$$;

grant execute on function public.create_friendly_session(int, text, timestamptz, text) to authenticated;

-- Skill rating for competitive pickup (full games only; mirrors league full-mode loop).
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
end;
$$;

grant execute on function public.apply_skill_rating_for_pickup_session(uuid) to authenticated;

create or replace function public.complete_friendly_pickup_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := private.request_uid();
  cap int;
  mk text;
  rcount int;
  cre text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select capacity, match_kind, creator_user_id
  into cap, mk, cre
  from public.friendly_sessions
  where id = p_session_id
  for update;

  if cre is null then
    raise exception 'session not found';
  end if;

  if cre is distinct from uid then
    raise exception 'not allowed';
  end if;

  select count(*)::int into rcount from public.friendly_session_roster where session_id = p_session_id;

  if rcount < cap then
    raise exception 'roster not full';
  end if;

  if mk = 'competitive' then
    if not exists (
      select 1 from public.friendly_session_games g where g.friendly_session_id = p_session_id
    ) then
      raise exception 'add game results first';
    end if;
  end if;

  update public.friendly_sessions
  set status = 'completed'
  where id = p_session_id;

  if mk = 'competitive' then
    perform public.apply_skill_rating_for_pickup_session(p_session_id);
  end if;
end;
$$;

grant execute on function public.complete_friendly_pickup_session(uuid) to authenticated;

-- Invite preview: include match_kind for public page copy.
drop function if exists public.get_friendly_invite_preview(uuid);

create or replace function public.get_friendly_invite_preview(p_invite_token uuid)
returns table (
  session_id uuid,
  title text,
  capacity int,
  starts_at timestamptz,
  status text,
  match_kind text,
  creator_name text,
  creator_username text,
  filled_count bigint,
  creator_user_id text
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
    s.match_kind,
    coalesce(u.name, ''),
    u.username,
    (select count(*)::bigint from public.friendly_session_roster r where r.session_id = s.id),
    s.creator_user_id
  from public.friendly_sessions s
  join public.users u on u.id = s.creator_user_id
  where s.invite_token = p_invite_token
  limit 1;
$$;

grant execute on function public.get_friendly_invite_preview(uuid) to anon, authenticated;

-- Do not cancel a completed session.
create or replace function public.cancel_friendly_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cre text;
  st text;
begin
  select creator_user_id, status into cre, st from public.friendly_sessions where id = p_session_id;
  if cre is null then
    raise exception 'session not found';
  end if;
  if cre is distinct from private.request_uid() then
    raise exception 'not allowed';
  end if;
  if st is distinct from 'open' then
    raise exception 'session not open';
  end if;
  update public.friendly_sessions set status = 'cancelled' where id = p_session_id;
end;
$$;

grant execute on function public.cancel_friendly_session(uuid) to authenticated;
