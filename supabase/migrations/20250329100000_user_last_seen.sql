-- Optional audit fields: client IP and last activity (not used for session length; Clerk controls sessions)
alter table public.users add column if not exists last_seen_ip text;
alter table public.users add column if not exists last_seen_at timestamptz;

comment on column public.users.last_seen_ip is 'Best-effort client IP from x-forwarded-for; audit only';
comment on column public.users.last_seen_at is 'Throttled server-side update when IP is recorded';
