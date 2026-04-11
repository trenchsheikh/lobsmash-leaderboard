-- Fix "infinite recursion detected in policy for relation friendly_sessions":
-- friendly_sessions_select referenced friendly_session_roster, whose policy referenced
-- friendly_sessions again. Roster rows can be authorized without reading friendly_sessions:
-- own row, or any row on a session where the viewer also has a roster row.

drop policy if exists friendly_roster_select on public.friendly_session_roster;

create policy friendly_roster_select on public.friendly_session_roster
  for select to authenticated
  using (
    user_id = private.request_uid()
    or exists (
      select 1 from public.friendly_session_roster r2
      where r2.session_id = friendly_session_roster.session_id
        and r2.user_id = private.request_uid()
    )
  );
