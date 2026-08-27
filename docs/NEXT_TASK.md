# Next Task: V5.5B-6G0A Prospect Level Production Acceptance — Resumed Post-Migration

## Active authority and production state

- Baseline: clean `feature/manager-intelligence` at governance activation commit produced from `dee21ca57539caa9eaf484cbfb98011a9ce4151e`.
- V5.5B-6G0E is **COMPLETE / CHECKPOINTED** at implementation commit `cecbe15baa057a86a5cfc1da7a564ae23ac4534d` with documentation checkpoint `dee21ca57539caa9eaf484cbfb98011a9ce4151e`.
- V5.5B-6G0A is **ACTIVE / AUTHORIZED FOR RESUMED POST-MIGRATION PRODUCTION ACCEPTANCE**.
- Migration 014 and Migration 015 are **APPLIED** in production. The governed initial population completed 5,440 successful writes, zero failures, zero unattempted rows, completed player-write and audit-finalization outcomes, and a passing protected comparison. No second Apply occurred.
- G1 remains **BLOCKED PENDING RESUMED G0A**; calibration remains **`CALIBRATION_REQUIRED`**; V5.5C remains **BLOCKED**.

## Accepted G0E repair

The proven false-update cause was `LEVEL_OBSERVED_AT_CHANGED`: the MLB provider had assigned collection-level `fetchedAt` to factual player `level_observed_at`. The accepted repair keeps collection time in Preview/import audit metadata, leaves first-time evidence without factual observation time null, preserves an existing factual observation time, and retains meaningful provider timestamps when actually supplied.

One canonical semantic comparator covers exactly `current_level`, `level_source`, `level_availability`, `level_observed_at`, and `level_raw_evidence`. Equivalent timestamp and JSONB representations compare equal; raw evidence remains deterministic, allowlisted, bounded to 16 observations, and explicit about truncation. MLB, AAA, AA, A_PLUS, A, ROOKIE, CONFLICT, and the existing writable UNKNOWN policy are idempotent. Genuine factual changes remain updates, older evidence remains non-writable, partial retry and batches of at most 250 remain intact, and G0B/G0C/G0D, both migrations, identity, Player Intelligence formulas, and Engine 5.1.1 remain unchanged.

## Authorized acceptance sequence

Execute in order and stop on any failed mandatory gate:

1. Verify the exact repository baseline and history. The expected reviewed application target is `cecbe15baa057a86a5cfc1da7a564ae23ac4534d`; verify that later commits are documentation-only.
2. Deploy that exact target through the trusted immutable Pages workflow. Require manifest identity, module-graph integrity, no mixed-version assets, and the reviewed topology of 105 modules and 123 hashed files.
3. Start the immutable application, authenticate normally, and select Reddit Phanatics. Require clean startup and console/module health.
4. Read-only verify Migration 014 and Migration 015 are applied/healthy and the prospect-level schema is `PRESENT`. Never execute either migration.
5. Capture `PROSPECT_LEVEL_POPULATION` twice. Require healthy, deterministic protected counts/hashes and schema state.
6. Read-only verify the prior prospect-level population is materially present, including field coverage and factual level/availability distribution.
7. Run the canonical authenticated MLB Stats API prospect-level Preview. Do not Review or Apply.
8. Inspect exact UUID/MLBAM identity counts, normalization distribution, initial populations, updates, no-ops, stale/non-writable rows, warnings/errors, and the five field-level change-reason totals.
9. Prove production idempotency: unchanged evidence is `NO_OP`; collection `fetchedAt` and equivalent JSON/database representation alone cause no update; unchanged conflict evidence is a no-op; genuine factual changes remain updates; stale evidence remains blocked; and identity behavior is unchanged. Zero total updates are not required.
10. Capture the protected baseline again and require Preview caused no protected or expected-mutable change.
11. Only after idempotency passes, run canonical Data Health and inspect factual canonical Player Intelligence inputs across available levels.
12. Decide whether G1 may become **UNBLOCKED FOR LOCAL IMPLEMENTATION**. Do not implement G1.
13. Restore the approved normal Pages target determined at runtime and verify normal startup, authentication, league selection, and console health.
14. Record complete evidence in `docs/NEXT_TASK_RESULT.md`. If every gate passes, stage only that file, commit `Record resumed prospect level production acceptance`, and push `feature/manager-intelligence`.

## Idempotency and safety gates

- Aggregate only `CURRENT_LEVEL_CHANGED`, `LEVEL_SOURCE_CHANGED`, `LEVEL_AVAILABILITY_CHANGED`, `LEVEL_OBSERVED_AT_CHANGED`, and `LEVEL_RAW_EVIDENCE_CHANGED` (or exact implemented equivalents). Every update must have a factual explanation.
- Any observed-at-only update caused by collection/Preview/job time fails acceptance. Any raw-evidence-only update caused by key/order, JSONB round trip, null/missing, primitive formatting, or audit metadata fails acceptance.
- Identity authority remains existing stable UUID plus exact MLBAM. Names are display-only; no fuzzy/name matching, player creation, or remapping is allowed.
- Continue using `PROSPECT_LEVEL_POPULATION`; protect all unauthorized player fields, scores, metrics, teams, managers, league settings, identity, ownership, and roster state.
- Data Health and canonical Player Intelligence input inspection remain mandatory before G1 can be unblocked. Successful G0A does not mark calibration passed and does not activate V5.5C.

## Explicit prohibitions

Do not expect `SCHEMA_ABSENT`; reapply or modify Migration 014/015; create Migration 016; invoke Review/Apply merely to prove idempotency; rewrite the 5,440 rows; edit application code during acceptance; improvise SQL or production repair; match by name; create/remap players; change identity, ownership, roster, teams, organization, positions, metrics, scores, or model formulas; refresh Statcast; import/sync Fantrax; implement G1; or activate V5.5C.

# Completed Contract: V5.5B-6G0E Prospect Level Idempotency Repair

## Active status and authority

- Baseline: clean `feature/manager-intelligence` at `b4e514ca534c754a487756bac06feb1c452f4cd7`.
- G0D is **COMPLETE / CHECKPOINTED**. G0A is **BLOCKED ON G0E / IDEMPOTENCY** after one successful governed population of 5,440 players.
- Migration 014 and Migration 015 are **APPLIED**. They must not be reapplied, modified, or treated as pending.
- At activation, G0E was authorized for local investigation, repair, and validation only. G1 remained **BLOCKED**; calibration remained **`CALIBRATION_REQUIRED`**; V5.5C remained **BLOCKED**. G0E is now complete under the active contract above.

## Proven failure and objective

The first governed Apply completed for 5,440 of 5,440 exact UUID/MLBAM matches. Player writes and audit finalization were `COMPLETED`, protected-domain comparison passed, and no unauthorized mutation occurred. A fresh post-Apply Preview nevertheless classified all 5,440 persisted rows as `UPDATE` and zero as `NO_OP`. No second Apply was performed.

G0E must prove which persisted field creates the false difference: `current_level`, `level_source`, `level_availability`, `level_observed_at`, or `level_raw_evidence`. Expose deterministic field-level planner reasons for each changed field. Do not guess, persist diagnostic reasons, or mass-rewrite the 5,440 rows.

Identical factual evidence must produce `NO_OP` even when irrelevant workflow metadata or equivalent storage representations differ. Meaningful factual changes must remain `UPDATE`, and older evidence must remain stale/non-writable. Prefer one canonical semantic comparator shared by Preview, retry, Apply revalidation, and tests.

## Mandatory investigation and semantic contract

Investigate without assuming: regenerated Preview/collection time; volatile request/job/snapshot metadata; object-key or irrelevant array order; JSON/database round trips; timestamp timezone/precision; null/undefined/missing/empty representations; serialized instead of semantic comparison; unstable conflict evidence; and stored versus normalized type differences.

- `current_level`: identical values compare equal; real changes such as `AA -> AAA` remain updates.
- `level_source` and `level_availability`: cosmetic representation does not update, but meaningful source or availability transitions do. Preserve distinct `AVAILABLE`, `UNKNOWN`, and `CONFLICT` semantics.
- `level_observed_at`: determine and document its factual-freshness meaning. A new click/request/job time alone cannot update a player. Equivalent timezone/precision representations compare equal; meaningful newer evidence remains distinguishable. Do not simply ignore this field.
- `level_raw_evidence`: remain allowlisted, factual, auditable, deterministic, bounded to 16 observations, and explicit about truncation. Separate workflow/audit time from factual player evidence. Canonicalize key order and only array order proven factually irrelevant; preserve meaningful order.
- Define deterministic null, absent, empty-array, and empty-object behavior without collapsing schema-distinct states.

Identical factual evidence for `MLB`, `AAA`, `AA`, `A_PLUS`, `A`, `ROOKIE`, and `CONFLICT` must become `NO_OP`; UNKNOWN retains its accepted policy. Conflict remains visible, never guesses a level, and must not overwrite valid evidence with a guess.

## Preserved boundaries

Preserve exact UUID plus MLBAM identity, no name authority or player creation, the five-field mutation boundary, batches of at most 250, partial retry, truthful audit finalization, `PROSPECT_LEVEL_POPULATION`, G0C Preview/Review/Apply, and G0D bootstrap. Previously successful rows become no-ops; only failed/unwritten rows remain writable if evidence is valid. Audit/job timestamps cannot drive player updates.

Migration 014 and Migration 015 remain unchanged. Do not create Migration 016 unless investigation proves an unavoidable database-contract contradiction; if so, stop and report. Preserve Fantrax, Statcast, Player Intelligence formulas, and Engine 5.1.1.

## Required validation

Add focused tests for identical normal/conflict evidence, accepted UNKNOWN behavior, volatile run times, JSON ordering/round trips, equivalent timestamps, deterministic null/absent handling, real factual changes, stale evidence, conflict safety, exact mutation fields, Migration 015, 250-row batching, partial retry, audit failures, G0B/G0C/G0D, Fantrax, Statcast, and Engine 5.1.1. Run focused tests, all `tests/*.test.mjs`, syntax checks for changed JavaScript, and `git diff --check`.

Record the root cause, field diagnostics, equality/freshness/raw-evidence contracts, files, and tests in `docs/NEXT_TASK_RESULT.md`; stop uncommitted for architect review unless separately authorized.

## Resumed G0A starting state

After G0E is implemented, tested, reviewed, and checkpointed, G0A resumes from the **current production state**. Verify Migrations 014/015 and protected domains are healthy, deploy the reviewed immutable G0E artifact, and run a fresh Preview. The 5,440 prior successes must be `NO_OP` except for proven genuine factual source changes. Do not restart at `SCHEMA_ABSENT` or reapply either migration. Data Health, canonical Player Intelligence production-input inspection, and the G1 decision remain pending; G0E completion alone does not unblock G1.

## Prohibitions

Do not deploy, access production/cloud data, run provider Preview/Review/Apply, rewrite or roll back the 5,440 rows, modify/reapply Migrations 014/015, implement G1, change Player Intelligence formulas, refresh Statcast, run Fantrax import/sync, or activate V5.5C.

# Superseded Contract: V5.5B-6G0A Prospect Level Migration / Data Population Acceptance

## Active status and authority

- Baseline: clean `feature/manager-intelligence` at governance activation commit produced from `a46cf6901f882ca9243f67e170041359f29b3157`.
- V5.5B-6G0D is **COMPLETE / CHECKPOINTED** at implementation commit `f9079ddc7174ad5f0ab87ccdf713fa099df0e1ce` with documentation checkpoint `1476d98a352507a45299e51553df9fbe0c80ce91`.
- V5.5B-6G0A is **ACTIVE / AUTHORIZED FOR CONTROLLED PRODUCTION ACCEPTANCE**. Migration 014 and Migration 015 are created and unapplied. G1 remains blocked pending successful G0A evidence; calibration remains `CALIBRATION_REQUIRED`; V5.5C remains blocked.
- This authorization is gate-specific. Any failed mandatory gate stops acceptance; production code must not be repaired inside G0A.

## Accepted G0D foundation

The repaired startup chain is `bootstrap -> refreshLeagueData -> loadPlayerPage -> listPlayerIntelligence -> nested player projection`. Mandatory bootstrap no longer requires Migration 014. The five optional fields—`current_level`, `level_source`, `level_availability`, `level_observed_at`, and `level_raw_evidence`—load as UUID-authoritative enrichment in 100-UUID batches, without name matching, identity remapping, or N+1 queries.

Complete absence is `SCHEMA_ABSENT`; complete presence, including all-null values, is `PRESENT`; partial schema fails closed. Permission/RLS, network, malformed, and unexpected database errors remain failures. Pre-migration Player Intelligence invents no prospect evidence; post-migration factual evidence flows through the canonical input. G0B baseline and G0C Preview -> Review -> Apply semantics, identity, ownership, roster behavior, League Production, and Engine 5.1.1 remain unchanged.

## Required acceptance sequence

Execute in this order and stop on any failure:

1. Verify the exact repository baseline and history, then select the reviewed immutable application target. Expected implementation target is `f9079ddc7174ad5f0ab87ccdf713fa099df0e1ce`, subject to history verification.
2. Deploy that exact target through the trusted immutable deployment workflow and verify application startup before Migration 014.
3. Authenticate normally and select Reddit Phanatics.
4. Capture the fixed `PROSPECT_LEVEL_POPULATION` baseline before Migration 014. Require `SCHEMA_ABSENT`.
5. Capture it again and require deterministic protected hashes.
6. Apply Migration 014 once through the canonical accepted migration path.
7. Recapture the baseline. Require `SCHEMA_ABSENT -> PRESENT` while every protected domain remains unchanged.
8. Apply Migration 015 once through the canonical accepted migration path.
9. Recapture the baseline and require protected domains unchanged.
10. Run the canonical MLB Stats API Prospect Level Preview.
11. Review provider counts, exact MLBAM/UUID matches, unmatched/conflicts, normalized distribution, write plan, warnings/errors, source snapshot, protected-baseline binding, and preview digest.
12. Explicitly approve Review, revalidate every gate, and Apply through the governed prospect-level population workflow.
13. Capture the protected baseline after writes.
14. Run a read-only idempotency Preview, Data Health, and canonical Player Intelligence input inspection.
15. Decide whether G1 may become `UNBLOCKED FOR LOCAL IMPLEMENTATION`.
16. Restore normal approved Pages if a temporary immutable feature artifact was deployed.

## Migration and mutation boundary

- Only Migration 014 followed by Migration 015 may be applied. Do not edit them, create Migration 016, or use ad hoc SQL.
- Only `current_level`, `level_source`, `level_availability`, `level_observed_at`, and `level_raw_evidence` may be mutated. `players.updated_at` may change only through the existing trigger.
- Existing player UUID, exact MLBAM ID, league scope, and expected prior values may be identity/authorization/concurrency guards only, never mutation targets.
- Apply batches must contain at most 250 rows.

## Identity, provider, and evidence contract

- Existing stable player UUID plus exact MLBAM mapping is authoritative. Names are display-only. No normalized/fuzzy name matching, ambiguous match, player creation, or identity remapping is allowed.
- Prospect-level authority is the accepted MLB Stats API provider/adapter. Do not infer level from Statcast, HKB, Fantrax production, age, name, roster heuristics, position, or organization assumptions.
- Canonical levels remain `MLB`, `AAA`, `AA`, `A_PLUS`, `A`, `ROOKIE`, `COMPLEX`, `DSL`, `INACTIVE`, and `UNKNOWN`; `CONFLICT` remains distinct. Acceptance must not change normalization.
- `level_raw_evidence` must remain allowlisted, deterministic, bounded to at most 16 sport observations, and explicit about truncation. Arbitrary provider payload dumping is prohibited.
- `CONFLICT` never guesses or overwrites valid factual evidence with a guessed level. `UNKNOWN` remains distinct and cannot become a factual level through heuristics.

## Review, protection, outcome, and idempotency gates

- Apply requires Preview -> explicit Review -> Apply. Review binds authenticated user/session, league, provider snapshot, exact identity mapping, normalized evidence, exact write plan, fixed protected baseline, and preview digest. Any material change invalidates Review.
- The only baseline profile is `PROSPECT_LEVEL_POPULATION`; no alternate selector is permitted. Protected domains include every non-authorized player field, calculated scores, all metrics, teams, managers, league settings, identities, ownership, and roster state. Any protected change fails acceptance.
- Preserve truthful player-write and import-job audit outcomes. Successful, failed, and unattempted UUIDs must remain distinct; audit-finalization failure must not relabel successful writes as failed or imply replay.
- After successful Apply, an identical fresh Preview must report `NO_OP` for persisted rows and must not rewrite them merely to change `updated_at`.

## G1 decision gate

G1 remains blocked unless G0A proves: pre-migration `SCHEMA_ABSENT`; deterministic baselines; safe ordered application of Migrations 014 and 015; unchanged protected domains after each boundary; structurally plausible provider Preview; exact identity; meaningful MiLB coverage; acceptable Apply; passing post-write protection and idempotency; acceptable Data Health; factual canonical Player Intelligence input; and no player creation or identity, ownership, roster, or score mutation.

Successful G0A does not equal calibration pass. Calibration remains `CALIBRATION_REQUIRED`, and V5.5C remains blocked.

## Explicit prohibitions

Do not edit application code or either migration during acceptance; create Migration 016; use ad hoc SQL or service-role workarounds; bypass Preview or Review; match by name; create players; alter identity, ownership, roster, team/organization, position, Statcast, Fantrax, Engine 5.1.1, or Player Intelligence scores; implement G1; change archetypes/model weights; or activate V5.5C.

## Failure and completion policy

On any mandatory gate failure, stop, preserve exact evidence, restore Pages when applicable, and open a separately reviewed repair task. Record the immutable target, every baseline/schema/migration/provider/write outcome, protected comparisons, idempotency, Data Health, canonical-input result, restoration, and G1 decision in `docs/NEXT_TASK_RESULT.md`.

# Completed Contract: V5.5B-6G0D Pre-Migration Schema-Absence Bootstrap

## Historical activation status and authority

- Baseline: clean `feature/manager-intelligence` at `f35700cd401be5cee63b26dfd6ef221e314321bf`.
- V5.5B-6G0, G0B, and G0C are checkpointed. The latest G0A acceptance stopped before migration or data writes because mandatory application bootstrap queried Migration 014 columns before the required pre-migration protected baseline could complete.
- At activation, G0A was `BLOCKED ON G0D`; Migration 014 and Migration 015 were created and unapplied; calibration was `CALIBRATION_REQUIRED`; and G1 and V5.5C were blocked.
- This completed G0D contract authorized local implementation and validation only. Its implementation and documentation checkpoints are recorded above; the active authority is now the G0A contract at the top of this file.

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
