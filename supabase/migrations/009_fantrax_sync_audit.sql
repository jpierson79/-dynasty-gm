-- V5.4.6D: durable, replay-safe audit boundary for bounded Fantrax roster-status synchronization.
-- Rollback: drop the item table first, then the attempt table and their audit triggers/functions.
begin;

create table if not exists public.fantrax_sync_attempts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  manifest_digest text not null check (manifest_digest ~ '^[a-f0-9]{64}$'),
  manifest_version text not null,
  season_context jsonb not null check (
    season_context->>'externalLeagueId' ~ '^[A-Za-z0-9]{16}$'
    and (season_context->>'seasonYear')::integer between 2000 and 2100
    and jsonb_typeof(season_context->'leagueHistoryAvailable')='boolean'
    and (coalesce((season_context->>'leagueHistoryAvailable')::boolean,false)=false or season_context->>'leagueHistoryId' ~ '^[A-Za-z0-9]{16}$')
  ),
  period text not null default '' check (period = ''),
  status text not null check (status in ('PREPARED','APPLYING','COMPLETED','PARTIAL','FAILED','ABANDONED')),
  reviewed_count integer not null check (reviewed_count between 1 and 3),
  created_at timestamptz not null default clock_timestamp(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (league_id, manifest_digest)
);

create table if not exists public.fantrax_sync_attempt_items (
  attempt_id uuid not null references public.fantrax_sync_attempts(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  ordinal integer not null check (ordinal between 0 and 2),
  expected_owner_team_id uuid not null references public.teams(id) on delete restrict,
  previewed_status text not null,
  target_status text not null check (target_status in ('ACTIVE','RESERVE','IL','MINORS')),
  fantrax_api_player_id text not null,
  fantrax_team_id text not null check (fantrax_team_id ~ '^[A-Za-z0-9]{16}$'),
  outcome text not null default 'PENDING' check (outcome in ('PENDING','APPLIED','SKIPPED','FAILED')),
  reason text,
  detail jsonb not null default '{}'::jsonb,
  applied_at timestamptz,
  primary key (attempt_id, player_id),
  unique (attempt_id, ordinal)
);

create index if not exists fantrax_sync_attempts_league_created_idx on public.fantrax_sync_attempts(league_id,created_at desc);
create index if not exists fantrax_sync_items_league_attempt_idx on public.fantrax_sync_attempt_items(league_id,attempt_id);

create or replace function public.protect_fantrax_sync_attempt_audit()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is null then raise exception 'Authentication is required to prepare a Fantrax synchronization attempt.'; end if;
    new.actor_user_id := (select auth.uid());
    new.created_at := clock_timestamp();
    new.started_at := null;
    new.completed_at := null;
    return new;
  end if;
  if new.league_id <> old.league_id or new.actor_user_id <> old.actor_user_id or new.manifest_digest <> old.manifest_digest or new.manifest_version <> old.manifest_version or new.season_context <> old.season_context or new.period <> old.period or new.reviewed_count <> old.reviewed_count or new.created_at <> old.created_at then
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

create or replace function public.protect_fantrax_sync_item_audit()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then
    if not exists(select 1 from public.fantrax_sync_attempts a where a.id=new.attempt_id and a.league_id=new.league_id and a.actor_user_id=(select auth.uid())) then raise exception 'Fantrax synchronization item must belong to the authenticated actor attempt in the same league.'; end if;
    if not exists(select 1 from public.players p where p.id=new.player_id and p.league_id=new.league_id) then raise exception 'Fantrax synchronization player is outside the attempt league.'; end if;
    if not exists(select 1 from public.teams t where t.id=new.expected_owner_team_id and t.league_id=new.league_id and t.fantrax_team_id=new.fantrax_team_id) then raise exception 'Fantrax synchronization expected team is outside the attempt league or has different Fantrax identity.'; end if;
    new.outcome:='PENDING'; new.reason:=null; new.detail:='{}'::jsonb; new.applied_at:=null;
    return new;
  end if;
  if tg_op='UPDATE' then
    if new.attempt_id<>old.attempt_id or new.league_id<>old.league_id or new.player_id<>old.player_id or new.ordinal<>old.ordinal or new.expected_owner_team_id<>old.expected_owner_team_id or new.previewed_status<>old.previewed_status or new.target_status<>old.target_status or new.fantrax_api_player_id<>old.fantrax_api_player_id or new.fantrax_team_id<>old.fantrax_team_id then
      raise exception 'Fantrax synchronization manifest rows are immutable.';
    end if;
    if old.outcome in ('APPLIED','SKIPPED') or new.outcome='PENDING' then raise exception 'Successful and skipped Fantrax synchronization outcomes are terminal.'; end if;
    if new.outcome='APPLIED' then new.applied_at:=clock_timestamp(); else new.applied_at:=null; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_fantrax_sync_attempt_audit on public.fantrax_sync_attempts;
create trigger protect_fantrax_sync_attempt_audit before insert or update on public.fantrax_sync_attempts for each row execute function public.protect_fantrax_sync_attempt_audit();
drop trigger if exists protect_fantrax_sync_item_audit on public.fantrax_sync_attempt_items;
create trigger protect_fantrax_sync_item_audit before insert or update on public.fantrax_sync_attempt_items for each row execute function public.protect_fantrax_sync_item_audit();

alter table public.fantrax_sync_attempts enable row level security;
alter table public.fantrax_sync_attempt_items enable row level security;
revoke all on public.fantrax_sync_attempts,public.fantrax_sync_attempt_items from anon;
grant select,insert,update on public.fantrax_sync_attempts,public.fantrax_sync_attempt_items to authenticated;

create policy fantrax_sync_attempts_members_select on public.fantrax_sync_attempts for select to authenticated using (public.is_league_member(league_id));
create policy fantrax_sync_attempts_editors_insert on public.fantrax_sync_attempts for insert to authenticated with check (public.can_edit_league(league_id) and actor_user_id=(select auth.uid()));
create policy fantrax_sync_attempts_actor_update on public.fantrax_sync_attempts for update to authenticated using (public.can_edit_league(league_id) and actor_user_id=(select auth.uid())) with check (public.can_edit_league(league_id) and actor_user_id=(select auth.uid()));
create policy fantrax_sync_items_members_select on public.fantrax_sync_attempt_items for select to authenticated using (public.is_league_member(league_id));
create policy fantrax_sync_items_actor_insert on public.fantrax_sync_attempt_items for insert to authenticated with check (public.can_edit_league(league_id) and exists(select 1 from public.fantrax_sync_attempts a where a.id=fantrax_sync_attempt_items.attempt_id and a.league_id=fantrax_sync_attempt_items.league_id and a.actor_user_id=(select auth.uid())));
create policy fantrax_sync_items_actor_update on public.fantrax_sync_attempt_items for update to authenticated using (public.can_edit_league(league_id) and exists(select 1 from public.fantrax_sync_attempts a where a.id=fantrax_sync_attempt_items.attempt_id and a.league_id=fantrax_sync_attempt_items.league_id and a.actor_user_id=(select auth.uid()))) with check (public.can_edit_league(league_id));

comment on table public.fantrax_sync_attempts is 'Immutable reviewed Fantrax roster-status manifest identity and lifecycle; no credentials or session data.';
comment on table public.fantrax_sync_attempt_items is 'Immutable reviewed rows with one terminal audit outcome for replay-safe recovery.';
commit;
