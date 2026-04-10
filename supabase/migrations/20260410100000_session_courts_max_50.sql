-- Raise per-session court limit from 12 to 50 (UI + server validation aligned in app).

alter table public.sessions drop constraint if exists sessions_num_courts_check;
alter table public.sessions
  add constraint sessions_num_courts_check check (num_courts between 1 and 50);

alter table public.leagues drop constraint if exists leagues_last_court_count_check;
alter table public.leagues
  add constraint leagues_last_court_count_check
  check (last_court_count is null or (last_court_count >= 1 and last_court_count <= 50));
