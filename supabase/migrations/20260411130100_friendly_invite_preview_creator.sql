-- Expose creator id on invite preview (needed for “you created this” / manage link).

drop function if exists public.get_friendly_invite_preview(uuid);

create or replace function public.get_friendly_invite_preview(p_invite_token uuid)
returns table (
  session_id uuid,
  title text,
  capacity int,
  starts_at timestamptz,
  status text,
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
