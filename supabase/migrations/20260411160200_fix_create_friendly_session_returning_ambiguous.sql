-- Fix: PL/pgSQL RETURNS TABLE (..., invite_token) shadows the column name in INSERT...RETURNING.

create or replace function public.create_friendly_session(
  p_capacity int,
  p_title text default null,
  p_starts_at timestamptz default null
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
begin
  if uid is null then
    raise exception 'not authenticated';
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

  insert into public.friendly_sessions as fs (creator_user_id, capacity, title, starts_at)
  values (uid, p_capacity, nullif(trim(p_title), ''), p_starts_at)
  returning fs.id, fs.invite_token into sid, tok;

  insert into public.friendly_session_roster (session_id, user_id, slot_index)
  values (sid, uid, 0);

  return query select sid, tok;
end;
$$;
