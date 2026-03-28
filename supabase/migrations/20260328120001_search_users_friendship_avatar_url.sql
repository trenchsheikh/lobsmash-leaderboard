-- Friend search RPC: include avatar_url (requires public.friendships from 20250330120000_friendships.sql).

create or replace function public.search_users_for_friendship(p_query text)
returns table (id text, username text, name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select private.request_uid() as uid)
  select u.id, u.username, u.name, u.avatar_url
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
