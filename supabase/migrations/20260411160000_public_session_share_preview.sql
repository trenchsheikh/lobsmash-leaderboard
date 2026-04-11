-- Public read model for link previews (/game/:id) and OG tags. Anyone with the UUID can read
-- non-sensitive session summary (same privacy model as invite links).

create or replace function public.get_public_session_share_preview(p_session_id uuid)
returns table (
  session_id uuid,
  league_id uuid,
  league_name text,
  session_date date,
  scheduled_at timestamptz,
  share_location text,
  share_restriction text,
  share_duration_minutes int,
  num_courts int,
  match_kind text,
  filled_players int,
  capacity_players int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.league_id,
    l.name,
    s.date,
    s.scheduled_at,
    s.share_location,
    s.share_restriction,
    s.share_duration_minutes,
    s.num_courts,
    s.match_kind,
    coalesce(
      (
        select count(*)::int * 2
        from public.session_teams st
        where st.session_id = s.id
      ),
      0
    ),
    greatest(0, s.num_courts * 4)
  from public.sessions s
  join public.leagues l on l.id = s.league_id
  where s.id = p_session_id
  limit 1;
$$;

grant execute on function public.get_public_session_share_preview(uuid) to anon, authenticated;

comment on function public.get_public_session_share_preview(uuid) is
  'Non-sensitive session card for public /game/:id previews. Secret link: UUID must be known.';
