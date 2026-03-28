-- League create bootstrap: creator must see the new league row before league_members exists,
-- and must insert the first membership row before league_role() returns 'owner'.

drop policy if exists leagues_select_member on public.leagues;

create policy leagues_select_member on public.leagues
  for select to authenticated
  using (
    owner_id = auth.uid()
    or private.is_league_member(id)
  );

-- Allow the league owner to insert their own row as owner (no prior membership row yet)
create policy league_members_insert_as_league_owner on public.league_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1
      from public.leagues l
      where l.id = league_id
        and l.owner_id = auth.uid()
    )
  );
