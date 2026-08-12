-- V5.5A: additive metadata for automated Statcast refresh auditability.
-- Implementation checkpoint only; do not apply without separate approval.

alter table public.import_jobs
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists rows_inserted integer not null default 0 check (rows_inserted >= 0),
  add column if not exists rows_updated integer not null default 0 check (rows_updated >= 0),
  add column if not exists rows_failed integer not null default 0 check (rows_failed >= 0);

comment on column public.import_jobs.source_metadata is
  'Non-secret provider/source/snapshot metadata used for reproducibility, freshness, and schema-drift diagnostics.';
