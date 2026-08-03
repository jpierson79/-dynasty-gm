-- V5.4.6B-1: explicit roster-status provenance and protected manual overrides.
-- Existing statuses and provenance are intentionally not backfilled.
begin;
alter table public.players
  add column if not exists roster_status_source text,
  add column if not exists roster_status_override_at timestamptz,
  add column if not exists roster_status_override_by uuid references auth.users(id) on delete set null;
alter table public.players drop constraint if exists players_roster_status_source_allowed;
alter table public.players add constraint players_roster_status_source_allowed check (roster_status_source is null or roster_status_source in ('FANTRAX','MANUAL','CSV','LEGACY','UNKNOWN'));
alter table public.players drop constraint if exists players_roster_status_override_metadata_valid;
alter table public.players add constraint players_roster_status_override_metadata_valid check ((roster_status_source = 'MANUAL' and roster_status_override_at is not null) or (roster_status_source is distinct from 'MANUAL' and roster_status_override_at is null and roster_status_override_by is null));
create or replace function public.protect_roster_status_override_audit()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if new.roster_status_source = 'MANUAL' then
    if (select auth.uid()) is null then raise exception 'Authentication is required to save a manual roster-status override.'; end if;
    new.roster_status_override_at := clock_timestamp();
    new.roster_status_override_by := (select auth.uid());
  else
    new.roster_status_override_at := null;
    new.roster_status_override_by := null;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_roster_status_override_audit on public.players;
create trigger protect_roster_status_override_audit before insert or update of roster_status, roster_status_source, roster_status_override_at, roster_status_override_by on public.players for each row execute function public.protect_roster_status_override_audit();
comment on column public.players.roster_status_source is 'Explicit roster-status provenance. Null means legacy/unknown provenance; it must not be inferred.';
comment on column public.players.roster_status_override_at is 'Database-stamped time of an active manual roster-status override.';
comment on column public.players.roster_status_override_by is 'Authenticated user database-stamped for an active manual override; nullable after auth-user deletion.';
commit;
