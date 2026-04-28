-- Break RLS cycles between players, player_verification_requests, users, coach_assessments.
-- Subqueries in policies that touched players under RLS re-entered players policies that
-- queried player_verification_requests again (42P17).

create or replace function private.player_id_owned_by_uid(p_player_id uuid, p_uid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players pl
    where pl.id = p_player_id
      and pl.user_id is not null
      and pl.user_id = p_uid
  );
$$;

grant execute on function private.player_id_owned_by_uid(uuid, text) to authenticated;

create or replace function private.coach_assessment_viewable_by_player(
  p_request_id uuid,
  p_uid text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.player_verification_requests r
    join public.players p on p.id = r.player_id
    where r.id = p_request_id
      and p.user_id = p_uid
  );
$$;

grant execute on function private.coach_assessment_viewable_by_player(uuid, text) to authenticated;

create or replace function private.user_is_verification_counterparty_for_coach(
  p_target_user_id text,
  p_coach_uid text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.player_verification_requests r
    join public.players p on p.id = r.player_id
    where p.user_id = p_target_user_id
      and r.coach_user_id = p_coach_uid
  );
$$;

grant execute on function private.user_is_verification_counterparty_for_coach(text, text) to authenticated;

drop policy if exists pvr_select_player on public.player_verification_requests;
create policy pvr_select_player on public.player_verification_requests
  for select to authenticated
  using (private.player_id_owned_by_uid(player_id, private.request_uid()));

drop policy if exists ca_select_player on public.coach_assessments;
create policy ca_select_player on public.coach_assessments
  for select to authenticated
  using (private.coach_assessment_viewable_by_player(request_id, private.request_uid()));

drop policy if exists users_select_verification_subject on public.users;
create policy users_select_verification_subject on public.users
  for select to authenticated
  using (
    private.user_is_verification_counterparty_for_coach(
      users.id,
      private.request_uid()
    )
  );
