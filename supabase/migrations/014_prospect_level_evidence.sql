-- V5.5B-6G0: nullable provider-neutral prospect level evidence.
alter table public.players
  add column if not exists current_level text,
  add column if not exists level_source text,
  add column if not exists level_availability text,
  add column if not exists level_observed_at timestamptz,
  add column if not exists level_raw_evidence jsonb;

alter table public.players drop constraint if exists players_current_level_allowed;
alter table public.players add constraint players_current_level_allowed check (
  current_level is null or current_level in ('MLB','AAA','AA','A_PLUS','A','ROOKIE','COMPLEX','DSL','INACTIVE','UNKNOWN')
);

alter table public.players drop constraint if exists players_level_evidence_consistent;
alter table public.players drop constraint if exists players_level_availability_allowed;
alter table public.players add constraint players_level_availability_allowed check (
  level_availability is null or level_availability in ('AVAILABLE','UNKNOWN','STALE','CONFLICT')
);
alter table public.players add constraint players_level_evidence_consistent check (
  (current_level is null and level_source is null and level_availability is null and level_observed_at is null and level_raw_evidence is null)
  or (
    level_source is not null and level_availability is not null
    and ((level_availability in ('AVAILABLE','STALE') and current_level is not null) or level_availability in ('UNKNOWN','CONFLICT'))
  )
);

comment on column public.players.current_level is 'Provider-neutral factual competitive level; null means no persisted level evidence.';
comment on column public.players.level_source is 'Reviewed factual provider for current_level; never inferred from age, name, market, production, or Statcast.';
comment on column public.players.level_availability is 'Availability of factual level evidence, including explicit conflict and unknown states.';
comment on column public.players.level_observed_at is 'Provider observation timestamp when available; null means freshness unavailable.';
comment on column public.players.level_raw_evidence is 'Bounded provider evidence retained for audit; not an identity, ownership, or roster authority.';
