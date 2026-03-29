-- Rename league format enum value king_of_court -> summit (display: Summit).
-- Skips when init already created 'summit' (no old label).

do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public'
      and t.typname = 'league_format'
      and e.enumlabel = 'king_of_court'
  ) then
    alter type public.league_format rename value 'king_of_court' to 'summit';
  end if;
end $$;
