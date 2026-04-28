-- Snapshot coach label + venue on verification; extend assessment RPC.

alter table public.players
  add column if not exists coach_verified_venue text,
  add column if not exists coach_verified_by_display_name text;

alter table public.coach_assessments
  add column if not exists venue text;

comment on column public.players.coach_verified_venue is 'Venue or context where coach observed play (coach-entered).';
comment on column public.players.coach_verified_by_display_name is 'Snapshot of coach display name at verification time.';

-- Backfill display name for rows verified before this column existed.
update public.players p
set coach_verified_by_display_name = coalesce(
  nullif(trim(u.name), ''),
  nullif(trim(u.username), ''),
  'Coach'
)
from public.users u
where p.coach_verified_by_user_id = u.id
  and p.coach_verified_at is not null
  and (p.coach_verified_by_display_name is null or length(trim(p.coach_verified_by_display_name)) = 0);

drop function if exists public.submit_coach_assessment(uuid, jsonb);

create or replace function public.submit_coach_assessment(
  p_request_id uuid,
  p_attribute_scores jsonb,
  p_venue text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := private.request_uid();
  v_player_id uuid;
  v_coach text;
  v_st public.verification_request_status;
  required_keys text[] := array[
    'serve_return', 'net_game', 'power', 'consistency', 'movement', 'tactical_iq'
  ];
  k text;
  v_num numeric;
  v_assessment_id uuid;
  v_coach_label text;
  v_venue text := left(trim(coalesce(p_venue, '')), 200);
begin
  if v_uid is null or length(trim(v_uid)) = 0 then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.coach_profiles cp
    where cp.user_id = v_uid
      and cp.approved_at is not null
  ) then
    raise exception 'not an approved coach';
  end if;

  select r.player_id, r.coach_user_id, r.status
  into v_player_id, v_coach, v_st
  from public.player_verification_requests r
  where r.id = p_request_id
  for update;

  if v_player_id is null then
    raise exception 'request not found';
  end if;

  if v_coach <> v_uid then
    raise exception 'not assigned to this request';
  end if;

  if v_st <> 'pending' then
    raise exception 'request is not pending';
  end if;

  if (select count(*) from jsonb_object_keys(p_attribute_scores)) <> 6 then
    raise exception 'attribute_scores must contain exactly six keys';
  end if;

  foreach k in array required_keys loop
    v_num := (p_attribute_scores ->> k)::numeric;
    if v_num is null or v_num <> floor(v_num) or v_num < 1 or v_num > 8 then
      raise exception 'invalid attribute score for %', k;
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_object_keys(p_attribute_scores) as ek(key)
    where ek.key <> all (required_keys)
  ) then
    raise exception 'unknown attribute keys in payload';
  end if;

  select coalesce(
    nullif(trim(u.name), ''),
    nullif(trim(u.username), ''),
    'Coach'
  )
  into v_coach_label
  from public.users u
  where u.id = v_uid
  limit 1;

  if v_coach_label is null then
    v_coach_label := 'Coach';
  end if;

  insert into public.coach_assessments (request_id, coach_user_id, attribute_scores, venue)
  values (p_request_id, v_uid, p_attribute_scores, nullif(v_venue, ''))
  returning id into v_assessment_id;

  update public.players pl
  set
    coach_verified_attributes = p_attribute_scores,
    coach_verified_at = now(),
    coach_verified_by_user_id = v_uid,
    coach_verified_by_display_name = v_coach_label,
    coach_verified_venue = nullif(v_venue, '')
  where pl.id = v_player_id;

  update public.player_verification_requests r
  set status = 'submitted', updated_at = now()
  where r.id = p_request_id;

  return v_assessment_id;
end;
$$;

grant execute on function public.submit_coach_assessment(uuid, jsonb, text) to authenticated;
