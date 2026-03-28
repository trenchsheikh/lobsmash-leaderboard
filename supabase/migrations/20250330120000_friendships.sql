-- Friendships (request/accept) + RLS visibility for friends.

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a text not null references public.users (id) on delete cascade,
  user_b text not null references public.users (id) on delete cascade,
  requested_by text not null references public.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  constraint friendships_ordered check (user_a < user_b)
);

create unique index friendships_pair_uidx on public.friendships (user_a, user_b);
create index friendships_user_a_idx on public.friendships (user_a);
create index friendships_user_b_idx on public.friendships (user_b);

alter table public.friendships enable row level security;

-- Accepted friendship check (for players / player_stats policies).
create or replace function private.friend_accepted_with(me text, other text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select me is not null
    and other is not null
    and me <> other
    and exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.user_a = me and f.user_b = other)
          or (f.user_b = me and f.user_a = other)
        )
    );
$$;

grant execute on function private.friend_accepted_with(text, text) to authenticated;

-- Username search for friend requests (global lookup; excludes self and existing pair rows).
create or replace function public.search_users_for_friendship(p_query text)
returns table (id text, username text, name text)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select private.request_uid() as uid)
  select u.id, u.username, u.name
  from public.users u, me
  where me.uid is not null
    and length(trim(p_query)) >= 2
    and u.username is not null
    and length(trim(u.username)) > 0
    and u.id <> me.uid
    and u.username ilike '%' || trim(lower(p_query)) || '%'
    and not exists (
      select 1
      from public.friendships f
      where (f.user_a = me.uid and f.user_b = u.id)
         or (f.user_b = me.uid and f.user_a = u.id)
    )
  limit 20;
$$;

grant execute on function public.search_users_for_friendship(text) to authenticated;

create or replace function public.user_id_by_username(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.username is not null
    and lower(trim(u.username)) = lower(trim(p_username))
  limit 1;
$$;

grant execute on function public.user_id_by_username(text) to authenticated;

-- friendships policies
create policy friendships_select on public.friendships
  for select to authenticated
  using (user_a = private.request_uid() or user_b = private.request_uid());

create policy friendships_insert on public.friendships
  for insert to authenticated
  with check (
    requested_by = private.request_uid()
    and user_a < user_b
    and (user_a = private.request_uid() or user_b = private.request_uid())
    and status = 'pending'
  );

create policy friendships_update_accept on public.friendships
  for update to authenticated
  using (
    status = 'pending'
    and requested_by <> private.request_uid()
    and (user_a = private.request_uid() or user_b = private.request_uid())
  )
  with check (status = 'accepted');

create policy friendships_delete on public.friendships
  for delete to authenticated
  using (user_a = private.request_uid() or user_b = private.request_uid());

-- See counterparty profile when any friendship row exists (pending or accepted).
create policy users_select_friend on public.users
  for select to authenticated
  using (
    exists (
      select 1
      from public.friendships f
      where (f.user_a = private.request_uid() and f.user_b = users.id)
         or (f.user_b = private.request_uid() and f.user_a = users.id)
    )
  );

-- Accepted friends can see each other's player row.
create policy players_select_friend on public.players
  for select to authenticated
  using (
    players.user_id is not null
    and private.friend_accepted_with(private.request_uid(), players.user_id)
  );

-- Accepted friends can see each other's stats rows (all leagues).
create policy player_stats_select_friend on public.player_stats
  for select to authenticated
  using (
    exists (
      select 1
      from public.players p
      where p.id = player_stats.player_id
        and p.user_id is not null
        and private.friend_accepted_with(private.request_uid(), p.user_id)
    )
  );
