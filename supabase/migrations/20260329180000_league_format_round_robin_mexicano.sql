-- Add round_robin and mexicano to league_format; align results_mode with format (Summit = champ court only).

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'league_format' and e.enumlabel = 'round_robin'
  ) then
    alter type public.league_format add value 'round_robin';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'league_format' and e.enumlabel = 'mexicano'
  ) then
    alter type public.league_format add value 'mexicano';
  end if;
end $$;

update public.leagues
set results_mode = case
  when format::text = 'summit' then 'champ_court_only'
  else 'full'
end;
