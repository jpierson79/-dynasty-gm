begin;

grant select, insert, update, delete
on public.leagues
to authenticated;

grant select, insert, update, delete
on public.league_members
to authenticated;

drop policy if exists "Users can create leagues"
on public.leagues;

create policy "Users can create leagues"
on public.leagues
for insert
to authenticated
with check (
  auth.uid() is not null
  and owner_user_id = auth.uid()
);

drop policy if exists "Owners can view own leagues"
on public.leagues;

create policy "Owners can view own leagues"
on public.leagues
for select
to authenticated
using (
  auth.uid() is not null
  and owner_user_id = auth.uid()
);

drop policy if exists "Owners can add themselves as members"
on public.league_members;

create policy "Owners can add themselves as members"
on public.league_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1
    from public.leagues l
    where l.id = league_id
      and l.owner_user_id = auth.uid()
  )
);

commit;
