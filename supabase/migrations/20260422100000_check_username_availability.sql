-- Username availability RPC that bypasses RLS on public.users.
--
-- Previously the client/server checked `public.users.username = :normalized`
-- directly via supabase-js, but RLS only exposes the caller's own row plus
-- same-league/friend/join-request rows. That meant handles held by users
-- outside the caller's scope looked "not found" and the UI marked them as
-- available even though the unique index on lower(trim(username)) rejects them
-- at write time. This function runs security definer so the existence check
-- is global, while only returning a small enum (no ids, no profile data).

create or replace function public.check_username_availability(p_username text)
returns text
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  n text;
  found_id text;
  caller text := private.request_uid();
begin
  n := lower(trim(coalesce(p_username, '')));

  if n = '' then
    return 'empty';
  end if;

  select u.id
    into found_id
  from public.users u
  where lower(trim(u.username)) = n
  limit 1;

  if found_id is null then
    return 'available';
  end if;

  if caller is not null and found_id = caller then
    return 'yours';
  end if;

  return 'taken';
end;
$$;

revoke all on function public.check_username_availability(text) from public;
grant execute on function public.check_username_availability(text) to authenticated;
