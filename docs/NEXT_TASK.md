# Next Task: V5.5B-6G0C Prospect Level Population Workflow

## Status and authority

- V5.5B-6G0 and G0B are checkpointed. G0A stopped before deployment or production access because no canonical prospect-level population workflow exists.
- Migration 014 remains unapplied. Calibration remains `CALIBRATION_REQUIRED`; G1 remains `BLOCKED ON PROSPECT LEVEL EVIDENCE FOUNDATION`; V5.5C remains blocked.
- This task is local implementation and validation only. It does not authorize deployment, cloud access, provider collection against production, migration application, production writes, archetype changes, Player Intelligence persistence, or Engine 5.1.1 recalculation.

## Objective

Implement the canonical authenticated preview/review/apply path for populating the five Migration 014 prospect-level evidence fields. Reuse the accepted MLB Stats API provider, `prospectLevelEvidence` normalizer, stable player UUIDs, MLBAM authority, `PROSPECT_LEVEL_POPULATION` protected baseline, normal RLS, and existing import-job/audit architecture where appropriate. Do not create an alternate write path.

## Identity and normalization

Writes may resolve only to an existing stable player UUID through exact MLBAM identity. Names are display evidence only and cannot authorize a match. Missing, duplicate, or ambiguous MLBAM evidence fails closed; no player may be created.

Use only the accepted levels `MLB`, `AAA`, `AA`, `A_PLUS`, `A`, `ROOKIE`, `COMPLEX`, `DSL`, `INACTIVE`, and `UNKNOWN`, with factual conflicts represented as `CONFLICT`. Do not add provider aliases during this phase.

## Read-only preview

Preview must perform no writes and must report provider/source freshness, total records, exact UUID/MLBAM matches, unmatched and ambiguous/conflicting identities, invalid evidence, normalized level distribution, planned updates and no-ops, warnings, and errors.

The reviewed preview must bind authenticated user, active league, provider snapshot/evidence, normalized rows, exact write plan, and `PROSPECT_LEVEL_POPULATION` baseline state. Apply requires explicit review and rejects skipped, stale, user-changed, league-changed, provider-changed, identity-changed, or plan-changed previews.

## Persistence boundary

Add one narrow authenticated, league-scoped repository/service path that requires existing player UUIDs and updates only:

- `current_level`
- `level_source`
- `level_availability`
- `level_observed_at`
- `level_raw_evidence`

`updated_at` may change only through the accepted database trigger. Do not include `is_minor_leaguer`, organization, team, position, age, Fantrax/MLBAM identity, ownership, roster state, or any other field. Use bounded batches of at most 250, update existing rows only, and never use broad player upsert or insert.

Immediately before each write, revalidate session, league, reviewed snapshot, identities, normalized values, exact plan, and fixed protected-baseline profile. If material evidence changed, invalidate review and require a new preview.

## Schema and baseline gates

The workflow always uses `PROSPECT_LEVEL_POPULATION`; no selector is allowed. The baseline action remains read-only and independent.

Preview may collect and normalize while Migration 014 is absent if the existing architecture supports it, but apply must fail closed when the mutable schema state is `SCHEMA_ABSENT`, partial, unavailable, permission blocked, or query failed. The workflow must never apply Migration 014 automatically.

The future acceptance sequence is baseline capture, preview, explicit review, apply, then protected comparison. Do not weaken or duplicate the baseline service.

## Outcomes and idempotency

Report `COMPLETED`, `PARTIAL`, or `FAILED` from actual batch outcomes. Preserve attempted, successful, failed, skipped, conflict, and no-op UUIDs/counts plus errors and warnings. A partial run cannot be reported as success, and successful batches cannot be described as rolled back without a real transaction.

Identical factual evidence after a successful apply must preview entirely as no-op. Do not rewrite unchanged rows. Retain bounded factual raw evidence sufficient for audit; never dump uncontrolled provider payloads or fabricate source/freshness timestamps.

Determine whether existing `import_jobs` is the canonical audit record. If reused, record source/context, preview distribution, write outcomes, warnings/errors, and bounded source metadata. Do not invent parallel history.

## UI workflow

Add a normal authenticated surface showing source/freshness, match and conflict counts, normalized distribution, updates/no-ops, warnings/errors, and protected-baseline readiness. Expose separate Preview, Review/approve, and Apply actions. No hidden or automatic apply, free-form profile selector, or baseline write action is permitted.

## Required validation

Tests must prove exact MLBAM-to-existing-UUID matching; missing/ambiguous identity rejection; no name authority or player creation; preview read-only behavior; canonical normalization; exact five-field payload; trigger-only `updated_at`; protected-field exclusion; batch limit at 250; update/no-op classification; partial outcome evidence; stale user/league/provider/identity/plan rejection; reviewed-preview requirement; schema-absent apply block; fixed baseline profile; existing profile independence; correct audit record if reused; and no UI auto-apply.

Run focused prospect population, provider, normalizer, repository, protected-baseline, imports/UI, auth, architecture, identity, and audit tests; all existing profile and Gate 4 regressions; the complete `tests/*.test.mjs` suite; JavaScript syntax checks; and `git diff --check`.

## Completion gate

Record identity rules, preview manifest, persistence payload, batching, stale guards, schema gate, partial/idempotency behavior, audit decision, UI routing, files changed, and exact tests in `docs/NEXT_TASK_RESULT.md`. Stop uncommitted for architect review.

After G0C is locally validated, reviewed, and checkpointed, resume G0A production acceptance. Only successful migration/population acceptance may unblock G1.
