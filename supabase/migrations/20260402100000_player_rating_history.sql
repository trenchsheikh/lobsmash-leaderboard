-- Append-only history for global skill (one row per material change to player_ratings).
-- Enables profile rating charts without replaying sessions.

create table public.player_rating_history (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  skill double precision not null,
  rated_games int not null check (rated_games >= 0),
  recorded_at timestamptz not null default now()
);

create index player_rating_history_player_recorded_idx
  on public.player_rating_history (player_id, recorded_at asc);

alter table public.player_rating_history enable row level security;

create policy player_rating_history_select on public.player_rating_history
  for select to authenticated
  using (
    exists (
      select 1
      from public.players p
      where p.id = player_rating_history.player_id
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
      where p.id = player_rating_history.player_id
        and p.user_id is not null
        and private.friend_accepted_with(private.request_uid(), p.user_id)
    )
  );

grant select on public.player_rating_history to authenticated;

create or replace function public.trg_player_ratings_append_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.player_rating_history (player_id, skill, rated_games, recorded_at)
    values (new.player_id, new.skill, new.rated_games, coalesce(new.updated_at, now()));
  elsif tg_op = 'UPDATE' then
    if new.skill is distinct from old.skill
       or new.rated_games is distinct from old.rated_games then
      insert into public.player_rating_history (player_id, skill, rated_games, recorded_at)
      values (new.player_id, new.skill, new.rated_games, coalesce(new.updated_at, now()));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists player_ratings_append_history on public.player_ratings;

create trigger player_ratings_append_history
  after insert or update on public.player_ratings
  for each row
  execute function public.trg_player_ratings_append_history();

-- Seed one snapshot per existing rating so profiles have a baseline point immediately.
insert into public.player_rating_history (player_id, skill, rated_games, recorded_at)
select pr.player_id, pr.skill, pr.rated_games, pr.updated_at
from public.player_ratings pr;
