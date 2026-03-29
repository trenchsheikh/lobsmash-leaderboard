-- Admins/owners must see requester profiles; requesters are not league members yet.

drop policy if exists users_select_pending_join_request on public.users;

create policy users_select_pending_join_request on public.users
  for select to authenticated
  using (
    exists (
      select 1
      from public.league_join_requests r
      where r.user_id = users.id
        and r.status = 'pending'
        and private.league_role(r.league_id) in ('owner', 'admin')
    )
  );
