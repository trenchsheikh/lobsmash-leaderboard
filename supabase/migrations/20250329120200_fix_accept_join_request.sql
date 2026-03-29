-- Plain insert: if membership already exists, fail before deleting the request row.

create or replace function public.accept_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  req_uid text;
  pid uuid;
  admin_role public.league_member_role;
begin
  select r.league_id, r.user_id
  into lid, req_uid
  from public.league_join_requests r
  where r.id = p_request_id
    and r.status = 'pending';

  if lid is null then
    raise exception 'request not found';
  end if;

  admin_role := private.league_role(lid);
  if admin_role is null or admin_role not in ('owner', 'admin') then
    raise exception 'not allowed';
  end if;

  select p.id
  into pid
  from public.players p
  where p.user_id = req_uid
  limit 1;

  if pid is null then
    raise exception 'player profile missing';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (lid, req_uid, 'player');

  insert into public.league_players (league_id, player_id)
  values (lid, pid)
  on conflict do nothing;

  delete from public.league_join_requests
  where id = p_request_id;
end;
$$;
