-- V5.4.6E: additive opt-in expansion from three to at most ten reviewed status rows.
-- This migration preserves migration 009 audit rows and defaults them to CONTROLLED_3.
-- Rollback is permitted only when no attempt exceeds three rows and no OPT_IN_10 attempt exists.
begin;

alter table public.fantrax_sync_attempts
  add column if not exists release_tier text not null default 'CONTROLLED_3',
  add column if not exists batch_limit integer not null default 3;

alter table public.fantrax_sync_attempts
  drop constraint if exists fantrax_sync_attempts_reviewed_count_check;

alter table public.fantrax_sync_attempts
  add constraint fantrax_sync_attempts_reviewed_count_check check (
    (release_tier = 'CONTROLLED_3' and batch_limit = 3 and reviewed_count between 1 and 3)
    or
    (release_tier = 'V5.4.6E_OPT_IN_10' and batch_limit = 10 and reviewed_count between 1 and 10)
  );

alter table public.fantrax_sync_attempt_items
  drop constraint if exists fantrax_sync_attempt_items_ordinal_check;

alter table public.fantrax_sync_attempt_items
  add constraint fantrax_sync_attempt_items_ordinal_check check (ordinal between 0 and 9);

create or replace function public.protect_fantrax_sync_attempt_audit()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  release_setting jsonb;
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is null then raise exception 'Authentication is required to prepare a Fantrax synchronization attempt.'; end if;
    if new.release_tier = 'V5.4.6E_OPT_IN_10' then
      select l.settings->'fantraxRosterSyncRelease' into release_setting
      from public.leagues l where l.id = new.league_id;
      if coalesce(release_setting->>'releaseId','') <> 'V5.4.6E_OPT_IN_10'
        or coalesce(release_setting->>'enabled','') <> 'true'
        or coalesce(release_setting->>'reviewed','') <> 'true'
        or coalesce(release_setting->>'leagueId','') <> new.league_id::text then
        raise exception 'The active league is not opted into the reviewed V5.4.6E ten-player release.';
      end if;
    end if;
    new.actor_user_id := (select auth.uid());
    new.created_at := clock_timestamp();
    new.started_at := null;
    new.completed_at := null;
    return new;
  end if;
  if new.league_id <> old.league_id or new.actor_user_id <> old.actor_user_id or new.manifest_digest <> old.manifest_digest or new.manifest_version <> old.manifest_version or new.release_tier <> old.release_tier or new.batch_limit <> old.batch_limit or new.season_context <> old.season_context or new.period <> old.period or new.reviewed_count <> old.reviewed_count or new.created_at <> old.created_at then
    raise exception 'Fantrax synchronization attempt identity and manifest are immutable.';
  end if;
  if old.status in ('COMPLETED','ABANDONED') or (old.status='APPLYING' and new.status not in ('APPLYING','COMPLETED','PARTIAL','FAILED','ABANDONED')) or (old.status in ('PREPARED','PARTIAL','FAILED') and new.status not in ('APPLYING','ABANDONED')) then
    raise exception 'Invalid Fantrax synchronization attempt transition from % to %.',old.status,new.status;
  end if;
  if new.status='APPLYING' then new.started_at:=clock_timestamp(); new.completed_at:=null;
  elsif new.status in ('COMPLETED','PARTIAL','FAILED','ABANDONED') then new.completed_at:=clock_timestamp();
  end if;
  return new;
end;
$$;

comment on column public.fantrax_sync_attempts.release_tier is 'Immutable recognized synchronization release; CONTROLLED_3 remains the default.';
comment on column public.fantrax_sync_attempts.batch_limit is 'Immutable database-enforced maximum for the recognized release tier.';

commit;
