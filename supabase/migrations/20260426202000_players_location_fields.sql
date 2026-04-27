-- Add onboarding location step fields.

alter table public.players
  add column if not exists city_or_postcode text,
  add column if not exists travel_distance_km int,
  add column if not exists usual_play_times text[] not null default '{}';
