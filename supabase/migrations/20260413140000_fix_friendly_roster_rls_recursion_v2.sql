-- Fix "infinite recursion detected in policy for relation friendly_session_roster":
-- friendly_roster_select used EXISTS on friendly_session_roster, so evaluating visibility
-- for one roster row re-entered the same policy on other rows in the subquery.
-- Use a SECURITY DEFINER helper so membership checks read the tables without RLS re-entry.

create or replace function private.user_can_access_friendly_session_roster_rows(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.friendly_sessions s
      where s.id = p_session_id
        and s.creator_user_id = private.request_uid()
    )
    or exists (
      select 1
      from public.friendly_session_roster r
      where r.session_id = p_session_id
        and r.user_id = private.request_uid()
    );
$$;

comment on function private.user_can_access_friendly_session_roster_rows(uuid) is
  'RLS helper for friendly_session_roster: creator or anyone on the session roster (reads bypass RLS).';

grant execute on function private.user_can_access_friendly_session_roster_rows(uuid) to authenticated;

drop policy if exists friendly_roster_select on public.friendly_session_roster;

create policy friendly_roster_select on public.friendly_session_roster
  for select to authenticated
  using (private.user_can_access_friendly_session_roster_rows(session_id));
