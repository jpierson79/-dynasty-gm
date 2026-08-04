-- Dynasty Front Office V4
-- Phase 2C security-advisor cleanup

begin;

-- =========================================================
-- 1. FIX MUTABLE SEARCH PATH
-- =========================================================

alter function public.set_updated_at()
set search_path = public, pg_temp;

-- rls_auto_enable is an event-trigger helper.
-- Lock its search path and prevent browser roles from calling it directly.

alter function public.rls_auto_enable()
set search_path = pg_catalog;

revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;

-- =========================================================
-- 2. CREATE A NON-EXPOSED PRIVATE SCHEMA
-- =========================================================

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;

grant usage on schema private to authenticated;

-- =========================================================
-- 3. RECREATE RLS HELPERS IN PRIVATE SCHEMA
-- =========================================================

create or replace function private.is_league_owner(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.leagues l
      where l.id = target_league_id
        and l.owner_user_id = (select auth.uid())
    );
$$;

create or replace function private.is_league_member(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.leagues l
        where l.id = target_league_id
          and l.owner_user_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.league_members lm
        where lm.league_id = target_league_id
          and lm.user_id = (select auth.uid())
      )
    );
$$;

create or replace function private.can_edit_league(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.leagues l
        where l.id = target_league_id
          and l.owner_user_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.league_members lm
        where lm.league_id = target_league_id
          and lm.user_id = (select auth.uid())
          and lm.role in ('owner', 'editor')
      )
    );
$$;

revoke all on function private.is_league_owner(uuid) from public;
revoke all on function private.is_league_owner(uuid) from anon;

revoke all on function private.is_league_member(uuid) from public;
revoke all on function private.is_league_member(uuid) from anon;

revoke all on function private.can_edit_league(uuid) from public;
revoke all on function private.can_edit_league(uuid) from anon;

grant execute on function private.is_league_owner(uuid) to authenticated;
grant execute on function private.is_league_member(uuid) to authenticated;
grant execute on function private.can_edit_league(uuid) to authenticated;

-- =========================================================
-- 4. UPDATE LEAGUE POLICIES
-- =========================================================

alter policy "Members can view leagues"
on public.leagues
using (
  (select private.is_league_member(id))
);

alter policy "Owners can update leagues"
on public.leagues
using (
  (select private.is_league_owner(id))
)
with check (
  owner_user_id = (select auth.uid())
);

alter policy "Owners can delete leagues"
on public.leagues
using (
  (select private.is_league_owner(id))
);

-- =========================================================
-- 5. UPDATE MEMBERSHIP POLICIES
-- =========================================================

alter policy "Members can view league membership"
on public.league_members
using (
  (select private.is_league_member(league_id))
);

alter policy "Owners can add league members"
on public.league_members
with check (
  (select private.is_league_owner(league_id))
);

alter policy "Owners can update league members"
on public.league_members
using (
  (select private.is_league_owner(league_id))
)
with check (
  (select private.is_league_owner(league_id))
);

alter policy "Owners can remove league members"
on public.league_members
using (
  (select private.is_league_owner(league_id))
);

-- =========================================================
-- 6. UPDATE GENERAL LEAGUE-DATA POLICIES
-- =========================================================

do $$
declare
  table_name text;
  policy_prefix text;
begin
  foreach table_name in array array[
    'managers',
    'teams',
    'players',
    'player_metrics',
    'calculated_player_scores',
    'manager_preferences',
    'trades',
    'trade_assets',
    'player_snapshots'
  ]
  loop
    policy_prefix :=
      replace(initcap(replace(table_name, '_', ' ')), ' ', '');

    execute format(
      'alter policy %I on public.%I
       using ((select private.is_league_member(league_id)))',
      policy_prefix || '_members_select',
      table_name
    );

    execute format(
      'alter policy %I on public.%I
       with check ((select private.can_edit_league(league_id)))',
      policy_prefix || '_editors_insert',
      table_name
    );

    execute format(
      'alter policy %I on public.%I
       using ((select private.can_edit_league(league_id)))
       with check ((select private.can_edit_league(league_id)))',
      policy_prefix || '_editors_update',
      table_name
    );

    execute format(
      'alter policy %I on public.%I
       using ((select private.can_edit_league(league_id)))',
      policy_prefix || '_editors_delete',
      table_name
    );
  end loop;
end
$$;

-- =========================================================
-- 7. UPDATE IMPORT-JOB POLICIES
-- =========================================================

alter policy "Members can view import jobs"
on public.import_jobs
using (
  (select private.is_league_member(league_id))
);

alter policy "Editors can create own import jobs"
on public.import_jobs
with check (
  (select private.can_edit_league(league_id))
  and user_id = (select auth.uid())
);

alter policy "Editors can update permitted import jobs"
on public.import_jobs
using (
  (select private.can_edit_league(league_id))
  and (
    user_id = (select auth.uid())
    or (select private.is_league_owner(league_id))
  )
)
with check (
  (select private.can_edit_league(league_id))
  and (
    user_id = (select auth.uid())
    or (select private.is_league_owner(league_id))
  )
);

alter policy "Editors can delete permitted import jobs"
on public.import_jobs
using (
  (select private.can_edit_league(league_id))
  and (
    user_id = (select auth.uid())
    or (select private.is_league_owner(league_id))
  )
);

-- =========================================================
-- 8. REMOVE THE OLD PUBLIC RPC FUNCTIONS
-- =========================================================

drop function if exists public.is_league_owner(uuid);
drop function if exists public.is_league_member(uuid);
drop function if exists public.can_edit_league(uuid);

commit;