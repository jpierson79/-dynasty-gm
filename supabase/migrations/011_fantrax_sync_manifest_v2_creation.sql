-- V5.4.6E Gate 2A: require manifest v2 for every newly prepared attempt.
-- Historical manifest-v1 attempts remain valid and recoverable through the unchanged update path.
begin;

create or replace function public.protect_fantrax_sync_attempt_audit()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  release_setting jsonb;
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is null then raise exception 'Authentication is required to prepare a Fantrax synchronization attempt.'; end if;
    if new.manifest_version <> '2' then
      raise exception 'New Fantrax synchronization attempts require manifest version 2.';
    end if;
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

comment on function public.protect_fantrax_sync_attempt_audit() is 'Protects immutable Fantrax sync manifests, requires v2 for new attempts, and preserves recovery of existing v1 attempts.';

commit;
