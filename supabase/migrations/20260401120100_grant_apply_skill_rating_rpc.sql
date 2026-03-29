-- Re-apply skill updates from the app after editing a completed session (no-op if skill migration not applied).
do $grant_apply$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'apply_skill_rating_for_session'
      and pg_get_function_identity_arguments(p.oid) = 'p_session_id uuid'
  ) then
    execute 'grant execute on function public.apply_skill_rating_for_session(uuid) to authenticated';
  end if;
end;
$grant_apply$;
