-- In-app notifications: session partner assignments (RLS + admin-only sync RPC).

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (id) on delete cascade,
  type text not null check (type = 'session_partner'),
  payload jsonb not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

create index user_notifications_user_unread_idx
  on public.user_notifications (user_id)
  where read_at is null;

alter table public.user_notifications enable row level security;

create policy user_notifications_select_own on public.user_notifications
  for select to authenticated
  using (user_id = private.request_uid());

create policy user_notifications_update_own on public.user_notifications
  for update to authenticated
  using (user_id = private.request_uid())
  with check (user_id = private.request_uid());

create or replace function public.sync_session_partner_notifications(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
  v_uid text;
  v_session_date date;
  v_league_name text;
begin
  v_uid := private.request_uid();
  if v_uid is null or length(trim(v_uid)) = 0 then
    raise exception 'Not authenticated';
  end if;

  select s.league_id, s.date
  into v_league_id, v_session_date
  from public.sessions s
  where s.id = p_session_id;

  if v_league_id is null then
    raise exception 'Session not found';
  end if;

  if not exists (
    select 1
    from public.league_members lm
    where lm.league_id = v_league_id
      and lm.user_id = v_uid
      and lm.role in ('owner', 'admin')
  ) then
    raise exception 'Not allowed';
  end if;

  select l.name into v_league_name
  from public.leagues l
  where l.id = v_league_id;

  delete from public.user_notifications un
  where un.type = 'session_partner'
    and un.payload->>'session_id' = p_session_id::text;

  insert into public.user_notifications (user_id, type, payload)
  select
    trim(both from pa.user_id),
    'session_partner',
    jsonb_build_object(
      'session_id', p_session_id::text,
      'league_id', v_league_id::text,
      'league_name', coalesce(v_league_name, ''),
      'session_date', coalesce(v_session_date::text, ''),
      'partner_player_id', st.player_b::text,
      'partner_user_id', pb.user_id,
      'partner_name', coalesce(
        nullif(trim(pub.name), ''),
        case
          when pub.username is not null and length(trim(pub.username)) > 0
            then '@' || pub.username
        end,
        nullif(trim(pb.name), ''),
        'Partner'
      ),
      'partner_username', pub.username,
      'partner_avatar_url', pub.avatar_url
    )
  from public.session_teams st
  join public.players pa on pa.id = st.player_a
  join public.players pb on pb.id = st.player_b
  left join public.users pub on pub.id = pb.user_id
  where st.session_id = p_session_id
    and pa.user_id is not null
  union all
  select
    trim(both from pb.user_id),
    'session_partner',
    jsonb_build_object(
      'session_id', p_session_id::text,
      'league_id', v_league_id::text,
      'league_name', coalesce(v_league_name, ''),
      'session_date', coalesce(v_session_date::text, ''),
      'partner_player_id', st.player_a::text,
      'partner_user_id', pa.user_id,
      'partner_name', coalesce(
        nullif(trim(pua.name), ''),
        case
          when pua.username is not null and length(trim(pua.username)) > 0
            then '@' || pua.username
        end,
        nullif(trim(pa.name), ''),
        'Partner'
      ),
      'partner_username', pua.username,
      'partner_avatar_url', pua.avatar_url
    )
  from public.session_teams st
  join public.players pa on pa.id = st.player_a
  join public.players pb on pb.id = st.player_b
  left join public.users pua on pua.id = pa.user_id
  where st.session_id = p_session_id
    and pb.user_id is not null;
end;
$$;

revoke all on function public.sync_session_partner_notifications(uuid) from public;
grant execute on function public.sync_session_partner_notifications(uuid) to authenticated;
