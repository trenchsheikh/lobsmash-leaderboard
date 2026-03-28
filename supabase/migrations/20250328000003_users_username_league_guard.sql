-- Unique username (case-insensitive via normalized storage + unique index on lower)
alter table public.users add column if not exists username text;

create unique index if not exists users_username_lower_unique
  on public.users (lower(trim(username)))
  where username is not null and length(trim(username)) > 0;

-- Every league member must have a non-empty username on public.users
create or replace function public.league_members_require_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.users u
    where u.id = new.user_id
      and u.username is not null
      and length(trim(u.username)) > 0
  ) then
    raise exception 'user must have a username before joining a league';
  end if;
  return new;
end;
$$;

drop trigger if exists league_members_require_username on public.league_members;

create trigger league_members_require_username
  before insert on public.league_members
  for each row execute function public.league_members_require_username();

-- Prevent clearing username while the user is in any league
create or replace function public.users_username_league_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.username is not null and length(trim(old.username)) > 0)
      and (new.username is null or length(trim(new.username)) = 0) then
      if exists (
        select 1 from public.league_members lm where lm.user_id = new.id
      ) then
        raise exception 'cannot clear username while you are in a league';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists users_username_league_guard on public.users;

create trigger users_username_league_guard
  before update on public.users
  for each row execute function public.users_username_league_guard();

-- join_league_by_code: explicit check for clearer error ordering
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

  if not exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.username is not null
      and length(trim(u.username)) > 0
  ) then
    raise exception 'username required for league';
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
