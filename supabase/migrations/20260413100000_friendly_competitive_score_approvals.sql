-- Competitive pickup: organiser enters scores; every other roster player must approve before
-- complete_friendly_pickup_session applies global skill rating.

create table if not exists public.friendly_session_competitive_approvals (
  session_id uuid not null references public.friendly_sessions (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  approved_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index if not exists friendly_session_competitive_approvals_session_id_idx
  on public.friendly_session_competitive_approvals (session_id);

alter table public.friendly_session_competitive_approvals enable row level security;

-- Visible to anyone who can see the session row.
create policy friendly_session_competitive_approvals_select
  on public.friendly_session_competitive_approvals
  for select to authenticated
  using (
    exists (
      select 1 from public.friendly_sessions s
      where s.id = friendly_session_competitive_approvals.session_id
        and (
          s.creator_user_id = private.request_uid()
          or exists (
            select 1 from public.friendly_session_roster r
            where r.session_id = s.id and r.user_id = private.request_uid()
          )
          or exists (
            select 1 from public.friendly_session_join_requests q
            where q.session_id = s.id and q.user_id = private.request_uid()
          )
        )
    )
  );

-- Non-organiser roster members approve their own row.
create policy friendly_session_competitive_approvals_insert
  on public.friendly_session_competitive_approvals
  for insert to authenticated
  with check (
    user_id = private.request_uid()
    and exists (
      select 1 from public.friendly_sessions s
      inner join public.friendly_session_roster r
        on r.session_id = s.id and r.user_id = private.request_uid()
      where s.id = friendly_session_competitive_approvals.session_id
        and s.status = 'open'
        and s.match_kind = 'competitive'
        and s.creator_user_id is distinct from private.request_uid()
    )
  );

-- Organiser clears all when updating scores; players can remove own approval.
create policy friendly_session_competitive_approvals_delete
  on public.friendly_session_competitive_approvals
  for delete to authenticated
  using (
    user_id = private.request_uid()
    or exists (
      select 1 from public.friendly_sessions s
      where s.id = friendly_session_competitive_approvals.session_id
        and s.creator_user_id = private.request_uid()
    )
  );

grant select, insert, delete on public.friendly_session_competitive_approvals to authenticated;

-- Only organiser may insert/delete competitive game rows (roster could not bypass client).
drop policy if exists friendly_session_games_insert on public.friendly_session_games;
create policy friendly_session_games_insert on public.friendly_session_games
  for insert to authenticated
  with check (
    exists (
      select 1 from public.friendly_sessions s
      where s.id = friendly_session_games.friendly_session_id
        and s.status = 'open'
        and (
          (s.match_kind = 'competitive' and s.creator_user_id = private.request_uid())
          or (
            s.match_kind = 'friendly'
            and (
              s.creator_user_id = private.request_uid()
              or exists (
                select 1 from public.friendly_session_roster r
                where r.session_id = s.id and r.user_id = private.request_uid()
              )
            )
          )
        )
    )
  );

drop policy if exists friendly_session_games_delete on public.friendly_session_games;
create policy friendly_session_games_delete on public.friendly_session_games
  for delete to authenticated
  using (
    exists (
      select 1 from public.friendly_sessions s
      where s.id = friendly_session_games.friendly_session_id
        and s.status = 'open'
        and (
          (s.match_kind = 'competitive' and s.creator_user_id = private.request_uid())
          or (
            s.match_kind = 'friendly'
            and (
              s.creator_user_id = private.request_uid()
              or exists (
                select 1 from public.friendly_session_roster r
                where r.session_id = s.id and r.user_id = private.request_uid()
              )
            )
          )
        )
    )
  );

create or replace function public.complete_friendly_pickup_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := private.request_uid();
  cap int;
  mk text;
  rcount int;
  cre text;
  need_appr int;
  have_appr int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select capacity, match_kind, creator_user_id
  into cap, mk, cre
  from public.friendly_sessions
  where id = p_session_id
  for update;

  if cre is null then
    raise exception 'session not found';
  end if;

  if cre is distinct from uid then
    raise exception 'not allowed';
  end if;

  select count(*)::int into rcount from public.friendly_session_roster where session_id = p_session_id;

  if rcount < cap then
    raise exception 'roster not full';
  end if;

  if mk = 'competitive' then
    if not exists (
      select 1 from public.friendly_session_games g where g.friendly_session_id = p_session_id
    ) then
      raise exception 'add game results first';
    end if;

    select count(*)::int into need_appr
    from public.friendly_session_roster r
    where r.session_id = p_session_id
      and r.user_id is distinct from cre;

    select count(*)::int into have_appr
    from public.friendly_session_competitive_approvals a
    inner join public.friendly_session_roster r
      on r.session_id = a.session_id and r.user_id = a.user_id
    where a.session_id = p_session_id
      and r.user_id is distinct from cre;

    if need_appr > 0 and have_appr < need_appr then
      raise exception 'all players must approve results first';
    end if;
  end if;

  update public.friendly_sessions
  set status = 'completed'
  where id = p_session_id;

  if mk = 'competitive' then
    perform public.apply_skill_rating_for_pickup_session(p_session_id);
  end if;
end;
$$;
