-- Fix "infinite recursion detected in policy for relation friendly_sessions":
-- Any RLS policy that queries friendly_sessions (or chains sessions ↔ roster under RLS)
-- re-enters the same policies. SECURITY DEFINER alone is not enough if Postgres still
-- applies RLS to table owners in this project — disable row_security for the helper reads.

-- Session visible to: creator, roster, or pending join request (dashboard / lobby list).
create or replace function private.friendly_session_visible_including_pending_join(p_session_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform set_config('row_security', 'off', true);
  return exists (
    select 1
    from public.friendly_sessions s
    where s.id = p_session_id
      and (
        s.creator_user_id is not distinct from private.request_uid()
        or exists (
          select 1
          from public.friendly_session_roster r
          where r.session_id = s.id
            and r.user_id = private.request_uid()
        )
        or exists (
          select 1
          from public.friendly_session_join_requests q
          where q.session_id = s.id
            and q.user_id = private.request_uid()
        )
      )
  );
end;
$$;

-- Roster rows: creator or anyone on the roster (pending league-style join alone is not enough).
create or replace function private.friendly_roster_visible(p_session_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform set_config('row_security', 'off', true);
  return exists (
    select 1
    from public.friendly_sessions s
    where s.id = p_session_id
      and s.creator_user_id is not distinct from private.request_uid()
  )
  or exists (
    select 1
    from public.friendly_session_roster r
    where r.session_id = p_session_id
      and r.user_id = private.request_uid()
  );
end;
$$;

create or replace function private.is_creator_of_friendly_session(p_session_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform set_config('row_security', 'off', true);
  return exists (
    select 1
    from public.friendly_sessions s
    where s.id = p_session_id
      and s.creator_user_id is not distinct from private.request_uid()
  );
end;
$$;

-- Games insert/delete: open session + competitive (creator only) or friendly (creator or roster).
create or replace function private.friendly_session_game_mutate_allowed(p_session_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform set_config('row_security', 'off', true);
  return exists (
    select 1
    from public.friendly_sessions s
    where s.id = p_session_id
      and s.status = 'open'
      and (
        (s.match_kind = 'competitive' and s.creator_user_id is not distinct from private.request_uid())
        or (
          s.match_kind = 'friendly'
          and (
            s.creator_user_id is not distinct from private.request_uid()
            or exists (
              select 1
              from public.friendly_session_roster r
              where r.session_id = s.id
                and r.user_id = private.request_uid()
            )
          )
        )
      )
  );
end;
$$;

-- Non-organiser roster approves competitive scores (insert own approval row).
create or replace function private.friendly_session_competitive_approval_insert_ok(p_session_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid text := private.request_uid();
begin
  perform set_config('row_security', 'off', true);
  return exists (
    select 1
    from public.friendly_sessions s
    inner join public.friendly_session_roster r
      on r.session_id = s.id
      and r.user_id = uid
    where s.id = p_session_id
      and s.status = 'open'
      and s.match_kind = 'competitive'
      and s.creator_user_id is distinct from uid
  );
end;
$$;

grant execute on function private.friendly_session_visible_including_pending_join(uuid) to authenticated;
grant execute on function private.friendly_roster_visible(uuid) to authenticated;
grant execute on function private.is_creator_of_friendly_session(uuid) to authenticated;
grant execute on function private.friendly_session_game_mutate_allowed(uuid) to authenticated;
grant execute on function private.friendly_session_competitive_approval_insert_ok(uuid) to authenticated;

drop policy if exists friendly_sessions_select on public.friendly_sessions;
create policy friendly_sessions_select on public.friendly_sessions
  for select to authenticated
  using (private.friendly_session_visible_including_pending_join(id));

drop policy if exists friendly_roster_select on public.friendly_session_roster;
create policy friendly_roster_select on public.friendly_session_roster
  for select to authenticated
  using (private.friendly_roster_visible(session_id));

drop policy if exists friendly_join_requests_select on public.friendly_session_join_requests;
create policy friendly_join_requests_select on public.friendly_session_join_requests
  for select to authenticated
  using (
    user_id = private.request_uid()
    or private.is_creator_of_friendly_session(session_id)
  );

drop policy if exists friendly_results_select on public.friendly_session_results;
create policy friendly_results_select on public.friendly_session_results
  for select to authenticated
  using (private.friendly_session_visible_including_pending_join(session_id));

drop policy if exists friendly_session_games_select on public.friendly_session_games;
create policy friendly_session_games_select on public.friendly_session_games
  for select to authenticated
  using (private.friendly_session_visible_including_pending_join(friendly_session_id));

drop policy if exists friendly_session_games_insert on public.friendly_session_games;
create policy friendly_session_games_insert on public.friendly_session_games
  for insert to authenticated
  with check (private.friendly_session_game_mutate_allowed(friendly_session_id));

drop policy if exists friendly_session_games_delete on public.friendly_session_games;
create policy friendly_session_games_delete on public.friendly_session_games
  for delete to authenticated
  using (private.friendly_session_game_mutate_allowed(friendly_session_id));

drop policy if exists friendly_session_competitive_approvals_select on public.friendly_session_competitive_approvals;
create policy friendly_session_competitive_approvals_select
  on public.friendly_session_competitive_approvals
  for select to authenticated
  using (private.friendly_session_visible_including_pending_join(session_id));

drop policy if exists friendly_session_competitive_approvals_insert on public.friendly_session_competitive_approvals;
create policy friendly_session_competitive_approvals_insert
  on public.friendly_session_competitive_approvals
  for insert to authenticated
  with check (
    user_id = private.request_uid()
    and private.friendly_session_competitive_approval_insert_ok(session_id)
  );

drop policy if exists friendly_session_competitive_approvals_delete on public.friendly_session_competitive_approvals;
create policy friendly_session_competitive_approvals_delete
  on public.friendly_session_competitive_approvals
  for delete to authenticated
  using (
    user_id = private.request_uid()
    or private.is_creator_of_friendly_session(session_id)
  );

drop function if exists private.user_can_access_friendly_session_roster_rows(uuid);
