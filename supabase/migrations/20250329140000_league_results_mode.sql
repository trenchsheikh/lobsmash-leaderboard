-- Locked at creation: how sessions in this league record results (drives sessions.input_mode)

alter table public.leagues
  add column if not exists results_mode text
  not null default 'full'
  check (results_mode in ('full', 'champ_court_only'));

update public.leagues set results_mode = 'full' where results_mode is null;
