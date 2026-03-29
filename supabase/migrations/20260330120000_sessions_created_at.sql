-- Created-at for stable ordering and debugging (multiple sessions on the same calendar date).

alter table public.sessions
  add column if not exists created_at timestamptz;

update public.sessions
set created_at = (date::text || ' 12:00:00+00')::timestamptz
where created_at is null;

alter table public.sessions
  alter column created_at set default now();

alter table public.sessions
  alter column created_at set not null;

create index if not exists sessions_league_id_created_at_idx
  on public.sessions (league_id, created_at desc);
