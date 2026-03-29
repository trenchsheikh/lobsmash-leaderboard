-- Public join URLs use league reference code (/join/XXXXXXXX). Preview RPC + return code in UUID preview.

drop function if exists public.get_league_invite_preview(uuid);

create function public.get_league_invite_preview(p_invite_token uuid)
returns table (
  league_id uuid,
  league_code text,
  league_name text,
  format public.league_format,
  member_count bigint,
  owner_name text,
  owner_username text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.code,
    l.name,
    l.format,
    (select count(*)::bigint from public.league_members lm where lm.league_id = l.id),
    coalesce(ou.name, ''),
    ou.username
  from public.leagues l
  join public.users ou on ou.id = l.owner_id
  where l.invite_token = p_invite_token
  limit 1;
$$;

grant execute on function public.get_league_invite_preview(uuid) to anon, authenticated;

create or replace function public.get_league_invite_preview_by_code(p_code text)
returns table (
  league_id uuid,
  league_code text,
  league_name text,
  format public.league_format,
  member_count bigint,
  owner_name text,
  owner_username text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.code,
    l.name,
    l.format,
    (select count(*)::bigint from public.league_members lm where lm.league_id = l.id),
    coalesce(ou.name, ''),
    ou.username
  from public.leagues l
  join public.users ou on ou.id = l.owner_id
  where l.code = upper(trim(p_code))
  limit 1;
$$;

grant execute on function public.get_league_invite_preview_by_code(text) to anon, authenticated;
