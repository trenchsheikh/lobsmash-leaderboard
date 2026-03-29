-- LobSmash core schema (exact model from product spec)

create extension if not exists "pgcrypto";

create schema if not exists private;

-- Enums
create type public.league_format as enum ('summit', 'americano');
create type public.league_member_role as enum ('owner', 'admin', 'player');
create type public.session_status as enum ('draft', 'active', 'completed');

-- public.users (linked to auth.users)
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  name text not null,
  playstyle text,
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  preferred_side text,
  experience_level text,
  constraint players_guest_name check (user_id is not null or length(trim(name)) > 0)
);

create unique index players_one_user on public.players (user_id) where user_id is not null;

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  format public.league_format not null,
  code text not null unique,
  owner_id uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

create index leagues_owner_id_idx on public.leagues (owner_id);

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.league_member_role not null,
  unique (league_id, user_id)
);

create index league_members_league_id_idx on public.league_members (league_id);
create index league_members_user_id_idx on public.league_members (user_id);

create table public.league_players (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  unique (league_id, player_id)
);

create index league_players_league_id_idx on public.league_players (league_id);
create index league_players_player_id_idx on public.league_players (player_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  created_by uuid not null references public.users (id),
  date date not null,
  status public.session_status not null default 'draft'
);

create index sessions_league_id_idx on public.sessions (league_id);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  court_number int not null check (court_number >= 1),
  team_a_players uuid[] not null,
  team_b_players uuid[] not null,
  team_a_score int not null check (team_a_score >= 0),
  team_b_score int not null check (team_b_score >= 0),
  winner text not null check (winner in ('team_a', 'team_b')),
  constraint games_winner_matches_score check (
    (winner = 'team_a' and team_a_score > team_b_score)
    or (winner = 'team_b' and team_b_score > team_a_score)
  )
);

create index games_session_id_idx on public.games (session_id);

create table public.player_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  league_id uuid not null references public.leagues (id) on delete cascade,
  total_games int not null default 0 check (total_games >= 0),
  total_wins int not null default 0 check (total_wins >= 0),
  court1_wins int not null default 0 check (court1_wins >= 0),
  total_points int not null default 0,
  unique (player_id, league_id)
);

create index player_stats_league_id_idx on public.player_stats (league_id);

-- New auth user → public.users row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
