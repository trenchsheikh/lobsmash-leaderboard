-- Allow authenticated users to fully delete their own app profile.
-- This removes their player row first and then their users row.
-- If other protected references exist (for example owned leagues), Postgres
-- raises a foreign key violation which is surfaced to the caller.

create or replace function public.delete_my_profile()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid text := private.request_uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.players
  where user_id = uid;

  delete from public.users
  where id = uid;
end;
$$;

revoke all on function public.delete_my_profile() from public;
grant execute on function public.delete_my_profile() to authenticated;
