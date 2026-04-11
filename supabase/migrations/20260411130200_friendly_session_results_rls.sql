-- Future-friendly results: allow roster members to insert rows (UI in a follow-up).

create policy friendly_results_insert on public.friendly_session_results
  for insert to authenticated
  with check (
    recorded_by = private.request_uid()
    and exists (
      select 1 from public.friendly_session_roster r
      where r.session_id = friendly_session_results.session_id
        and r.user_id = private.request_uid()
    )
  );

grant insert on public.friendly_session_results to authenticated;
