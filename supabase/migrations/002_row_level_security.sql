-- Dynasty Front Office V4
-- Phase 2C: Row Level Security and access policies

begin;

-- =========================================================
-- SECURITY HELPER FUNCTIONS
-- =========================================================
-- SECURITY DEFINER prevents recursive RLS checks when these
-- functions inspect leagues and league_members.

create or replace function public.is_league_owner(target_league_id uuid)
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

create or replace function public.is_league_member(target_league_id uuid)
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

create or replace function public.can_edit_league(target_league_id uuid)
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

revoke all on function public.is_league_owner(uuid) from public;
revoke all on function public.is_league_member(uuid) from public;
revoke all on function public.can_edit_league(uuid) from public;

grant execute on function public.is_league_owner(uuid) to authenticated;
grant execute on function public.is_league_member(uuid) to authenticated;
grant execute on function public.can_edit_league(uuid) to authenticated;

-- =========================================================
-- ENABLE ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.managers enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.player_metrics enable row level security;
alter table public.calculated_player_scores enable row level security;
alter table public.manager_preferences enable row level security;
alter table public.trades enable row level security;
alter table public.trade_assets enable row level security;
alter table public.player_snapshots enable row level security;
alter table public.import_jobs enable row level security;

-- =========================================================
-- REMOVE DEFAULT ANONYMOUS ACCESS
-- =========================================================

revoke all on public.profiles from anon;
revoke all on public.leagues from anon;
revoke all on public.league_members from anon;
revoke all on public.managers from anon;
revoke all on public.teams from anon;
revoke all on public.players from anon;
revoke all on public.player_metrics from anon;
revoke all on public.calculated_player_scores from anon;
revoke all on public.manager_preferences from anon;
revoke all on public.trades from anon;
revoke all on public.trade_assets from anon;
revoke all on public.player_snapshots from anon;
revoke all on public.import_jobs from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.leagues to authenticated;
grant select, insert, update, delete on public.league_members to authenticated;
grant select, insert, update, delete on public.managers to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.players to authenticated;
grant select, insert, update, delete on public.player_metrics to authenticated;
grant select, insert, update, delete on public.calculated_player_scores to authenticated;
grant select, insert, update, delete on public.manager_preferences to authenticated;
grant select, insert, update, delete on public.trades to authenticated;
grant select, insert, update, delete on public.trade_assets to authenticated;
grant select, insert, update, delete on public.player_snapshots to authenticated;
grant select, insert, update, delete on public.import_jobs to authenticated;

-- =========================================================
-- DROP EXISTING POLICIES SO THIS MIGRATION IS RE-RUNNABLE
-- =========================================================

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can create own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can delete own profile" on public.profiles;

drop policy if exists "Members can view leagues" on public.leagues;
drop policy if exists "Users can create leagues" on public.leagues;
drop policy if exists "Owners can update leagues" on public.leagues;
drop policy if exists "Owners can delete leagues" on public.leagues;

drop policy if exists "Members can view league membership" on public.league_members;
drop policy if exists "Owners can add league members" on public.league_members;
drop policy if exists "Owners can update league members" on public.league_members;
drop policy if exists "Owners can remove league members" on public.league_members;

-- =========================================================
-- PROFILE POLICIES
-- =========================================================

create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) is not null
  and id = (select auth.uid())
);

create policy "Users can create own profile"
on public.profiles
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and id = (select auth.uid())
);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
)
with check (
  id = (select auth.uid())
);

create policy "Users can delete own profile"
on public.profiles
for delete
to authenticated
using (
  id = (select auth.uid())
);

-- =========================================================
-- LEAGUE POLICIES
-- =========================================================

create policy "Members can view leagues"
on public.leagues
for select
to authenticated
using (
  public.is_league_member(id)
);

create policy "Users can create leagues"
on public.leagues
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and owner_user_id = (select auth.uid())
);

create policy "Owners can update leagues"
on public.leagues
for update
to authenticated
using (
  public.is_league_owner(id)
)
with check (
  owner_user_id = (select auth.uid())
);

create policy "Owners can delete leagues"
on public.leagues
for delete
to authenticated
using (
  public.is_league_owner(id)
);

-- =========================================================
-- LEAGUE MEMBERSHIP POLICIES
-- =========================================================

create policy "Members can view league membership"
on public.league_members
for select
to authenticated
using (
  public.is_league_member(league_id)
);

create policy "Owners can add league members"
on public.league_members
for insert
to authenticated
with check (
  public.is_league_owner(league_id)
);

create policy "Owners can update league members"
on public.league_members
for update
to authenticated
using (
  public.is_league_owner(league_id)
)
with check (
  public.is_league_owner(league_id)
);

create policy "Owners can remove league members"
on public.league_members
for delete
to authenticated
using (
  public.is_league_owner(league_id)
);

-- =========================================================
-- GENERAL LEAGUE DATA POLICIES
-- =========================================================
-- Run the same read/edit rules for each league-owned table.

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
    policy_prefix := replace(initcap(replace(table_name, '_', ' ')), ' ', '');

    execute format(
      'drop policy if exists %I on public.%I',
      policy_prefix || '_members_select',
      table_name
    );

    execute format(
      'drop policy if exists %I on public.%I',
      policy_prefix || '_editors_insert',
      table_name
    );

    execute format(
      'drop policy if exists %I on public.%I',
      policy_prefix || '_editors_update',
      table_name
    );

    execute format(
      'drop policy if exists %I on public.%I',
      policy_prefix || '_editors_delete',
      table_name
    );

    execute format(
      'create policy %I on public.%I
       for select to authenticated
       using (public.is_league_member(league_id))',
      policy_prefix || '_members_select',
      table_name
    );

    execute format(
      'create policy %I on public.%I
       for insert to authenticated
       with check (public.can_edit_league(league_id))',
      policy_prefix || '_editors_insert',
      table_name
    );

    execute format(
      'create policy %I on public.%I
       for update to authenticated
       using (public.can_edit_league(league_id))
       with check (public.can_edit_league(league_id))',
      policy_prefix || '_editors_update',
      table_name
    );

    execute format(
      'create policy %I on public.%I
       for delete to authenticated
       using (public.can_edit_league(league_id))',
      policy_prefix || '_editors_delete',
      table_name
    );
  end loop;
end
$$;

-- =========================================================
-- IMPORT JOB POLICIES
-- =========================================================

drop policy if exists "Members can view import jobs"
on public.import_jobs;

drop policy if exists "Editors can create own import jobs"
on public.import_jobs;

drop policy if exists "Editors can update permitted import jobs"
on public.import_jobs;

drop policy if exists "Editors can delete permitted import jobs"
on public.import_jobs;

create policy "Members can view import jobs"
on public.import_jobs
for select
to authenticated
using (
  public.is_league_member(league_id)
);

create policy "Editors can create own import jobs"
on public.import_jobs
for insert
to authenticated
with check (
  public.can_edit_league(league_id)
  and user_id = (select auth.uid())
);

create policy "Editors can update permitted import jobs"
on public.import_jobs
for update
to authenticated
using (
  public.can_edit_league(league_id)
  and (
    user_id = (select auth.uid())
    or public.is_league_owner(league_id)
  )
)
with check (
  public.can_edit_league(league_id)
  and (
    user_id = (select auth.uid())
    or public.is_league_owner(league_id)
  )
);

create policy "Editors can delete permitted import jobs"
on public.import_jobs
for delete
to authenticated
using (
  public.can_edit_league(league_id)
  and (
    user_id = (select auth.uid())
    or public.is_league_owner(league_id)
  )
);

-- =========================================================
-- INDEXES USED BY SECURITY POLICIES
-- =========================================================

create index if not exists leagues_owner_user_idx
on public.leagues(owner_user_id);

create index if not exists league_members_user_league_idx
on public.league_members(user_id, league_id);

create index if not exists league_members_league_role_idx
on public.league_members(league_id, role);

commit;