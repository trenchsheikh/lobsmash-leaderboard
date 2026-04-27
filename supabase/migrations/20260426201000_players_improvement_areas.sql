-- Add optional onboarding step-3 focus areas.

alter table public.players
  add column if not exists improvement_areas text[] not null default '{}';
