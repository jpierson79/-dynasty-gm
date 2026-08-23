# Next Task: V5.5B-6G0D Pre-Migration Schema-Absence Bootstrap

## Active status and authority

- Baseline: clean `feature/manager-intelligence` at `f35700cd401be5cee63b26dfd6ef221e314321bf`.
- V5.5B-6G0, G0B, and G0C are checkpointed. The latest G0A acceptance stopped before migration or data writes because mandatory application bootstrap queried Migration 014 columns before the required pre-migration protected baseline could complete.
- G0A is `BLOCKED ON G0D`. Migration 014 and Migration 015 are created and unapplied. Calibration remains `CALIBRATION_REQUIRED`; G1 and V5.5C remain blocked.
- G0D is local implementation and validation only. It does not authorize deployment, migration application, production/cloud access, provider collection, production writes, G1 implementation, model changes, or V5.5C activation.

## Objective

Make application and league bootstrap compatible with the complete absence of Migration 014 while preserving the accepted production order:

```text
pre-migration PROSPECT_LEVEL_POPULATION baseline
→ Migration 014
→ protected comparison
→ Migration 015
→ protected comparison
→ provider Preview
→ explicit Review
→ Apply
→ post-write protected comparison
```

Before Migration 014 exists, the application must start, authenticate, select/load Reddit Phanatics, load core league/player data, navigate to Cloud Imports and Data Health, capture `PROSPECT_LEVEL_POPULATION`, and report `SCHEMA_ABSENT`. Apply remains disabled and migration-required state remains explicit.

## Proven defect and investigation

The hosted G0A artifact failed with `player intelligence paged query: column players_1.current_level does not exist`. The protected-baseline service already understands `SCHEMA_ABSENT`, but normal bootstrap/canonical player loading queries prospect-level columns first.

Before editing, trace and document the exact repository method, SELECT construction, caller, startup and league-selection sequence, Player Intelligence involvement, query reuse, and dependency chain that made optional evidence mandatory. Do not guess.

## Required architecture

Separate core player/league bootstrap data from optional prospect-level evidence. Base loading must request fields guaranteed before Migration 014, including canonical UUID, Fantrax and MLBAM identities, name, age, position, `is_minor_leaguer`, existing team/organization fields, ownership, roster state, and other previously required fields.

Load the five optional evidence fields only after schema capability is known, using either a base player query plus optional prospect-evidence enrichment or a schema-aware projection that includes prospect fields only after proven availability. Keep one canonical UUID identity path and one Player Intelligence repository architecture. Do not create permanent competing pre/post-migration pipelines. Any enrichment query must remain bounded and paginated—no per-player requests or N+1 behavior.

## Schema-state and failure contract

- All five columns absent → `SCHEMA_ABSENT`.
- All five columns present → `PRESENT` and factual evidence loads normally.
- Some present and some absent → partial/unhealthy and fail closed.
- Authentication, RLS, or permission failures → fail closed / `PERMISSION_BLOCKED` as appropriate.
- Network, generic query, unexpected PostgreSQL, or other failures → `QUERY_FAILED` or explicit failure.

Only the specifically recognized complete absence of `current_level`, `level_source`, `level_availability`, `level_observed_at`, and `level_raw_evidence` may become `SCHEMA_ABSENT`. Do not broadly suppress Supabase errors.

## Canonical input and baseline behavior

Before Migration 014, Player Intelligence may represent prospect-level evidence as unavailable/schema absent, but must not invent level, source, or availability from age, `is_minor_leaguer`, Fantrax, HKB, Statcast, names, or roster heuristics. After all five columns exist, the canonical input path must read them normally.

`PROSPECT_LEVEL_POPULATION` capture must remain independently obtainable before any Player Intelligence query requiring optional columns. It must continue protecting core players, calculated scores, metrics, teams, managers, and league settings. Preserve `SCHEMA_ABSENT`, `PRESENT`, partial-schema fail-closed behavior, and all existing baseline profiles.

## Preserved boundaries

- Preserve G0C Preview → Review → Apply behavior and keep Apply blocked when schema is absent.
- Never auto-apply Migration 014 or Migration 015.
- Preserve pagination, batching, caching/indexing, identity, ownership, roster, Fantrax, Statcast, MLBAM, Data Health, auth, and immutable deployment behavior.
- Do not reintroduce per-player queries, unpaginated player loads, repeated full-table metric scans, or synchronous quadratic evaluation.
- Make only the minimum schema-awareness change needed in Data Health if it shares the mandatory query.
- Do not change providers, migrations, archetypes, formulas, weights, floor/expected/ceiling, confidence, reliever logic, Player Intelligence persistence, or Engine 5.1.1.

## Required tests

Add focused coverage proving:

1. Complete five-column absence permits application/core-player bootstrap and league selection.
2. Complete absence permits `PROSPECT_LEVEL_POPULATION` capture and reports `SCHEMA_ABSENT`.
3. Apply remains blocked while schema is absent.
4. Pre-migration Player Intelligence fabricates no level values.
5. All five columns present report `PRESENT` and load factual values.
6. Partial schema fails closed.
7. Permission/RLS and generic query failures are not mistaken for absence or swallowed.
8. UUID, Fantrax/MLBAM identity, ownership, and roster behavior remain unchanged.
9. Pagination remains intact and no N+1 query path is introduced.
10. Existing G0B baseline and G0C workflow tests remain green.
11. MLBAM, Statcast, Fantrax, Data Health, auth, architecture, and trusted deployment regressions remain green.
12. Post-Migration-014 canonical Player Intelligence still reads prospect evidence.

Run focused tests, the complete `tests/*.test.mjs` suite, syntax checks for changed JavaScript, and `git diff --check`.

## Completion gate

Record the proven dependency chain, repair shape, schema/error classification, pre/post-migration behavior, baseline independence, query counts/pagination, changed files, and exact tests in `docs/NEXT_TASK_RESULT.md`. Stop uncommitted for architect review.

After implementation, testing, review, and checkpointing, resume G0A from the beginning with a fresh immutable artifact. Do not reuse the failed G0A deployment as successful pre-migration evidence.

# Superseded Contract: V5.5B-6G0C Prospect Level Population Workflow

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
