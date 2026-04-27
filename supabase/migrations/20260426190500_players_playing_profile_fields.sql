-- New onboarding playing-profile schema.
-- Staged migration: add new fields and backfill, keep legacy columns for compatibility.

alter table public.players
  add column if not exists play_styles text[] not null default '{}',
  add column if not exists profile_attributes jsonb not null default '{}'::jsonb;

-- Backfill a basic initial style from legacy playstyle when possible.
update public.players
set play_styles = case
  when coalesce(array_length(play_styles, 1), 0) > 0 then play_styles
  when playstyle is not null and length(trim(playstyle)) > 0 then array[playstyle]
  else play_styles
end;
