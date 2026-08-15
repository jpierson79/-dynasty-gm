# Next Task: V5.5B-6G0 Prospect Level Evidence Foundation

## Status and authority

- V5.5B-6G remains active, calibration is `CALIBRATION_REQUIRED`, and V5.5C remains blocked.
- V5.5B-6G1 Archetype Classification Repair is `BLOCKED ON PROSPECT LEVEL EVIDENCE FOUNDATION`, not failed.
- This task is a local evidence-foundation implementation. It does not authorize deployment, production/cloud access, provider refreshes, imports, Player Intelligence persistence, Engine 5.1.1 changes, identity/ownership/roster changes, or V5.5C activation.

## Proven blocker

The Player Intelligence repository omits `players.is_minor_leaguer`. Canonical input receives it as missing, converts it to false, and lets young players fall through to the age-based `YOUNG_MLB_OR_RECENT_CALLUP` rule.

The schema stores only the minor-leaguer boolean and no authoritative competitive level. Existing import behavior collapses level/minors/prospect source evidence into that boolean, while canonical Player Intelligence exposes null level and readiness. The application therefore cannot safely distinguish AAA/AA from A+/A/Rookie/Complex/DSL.

Do not apply a partial G1 fix that merely loads `is_minor_leaguer`. G0 must establish level evidence first.

## Objective

Create an authoritative, provider-neutral foundation for:

- minor-league status;
- current competitive level;
- level evidence source;
- source timestamp and freshness where available;
- availability and unknown state; and
- raw provider evidence needed for audit.

This foundation must let the later G1 classifier distinguish near-MLB and distant prospects without inference from age, HKB, production, Statcast, name, or reputation.

## Source and provider review

Trace the complete accepted path from source to raw evidence, normalizer, repository, and canonical Player Intelligence input before selecting a storage or collection design.

1. Inspect accepted MLB Stats API capabilities first for authoritative MLB/MiLB organization, roster, and level evidence.
2. Inspect current Fantrax exports and accepted import paths for explicit level evidence already present but discarded. Do not force Fantrax to provide level if reviewed data does not contain it.
3. Prefer preserving and normalizing existing factual raw evidence over adding a new provider.
4. Do not introduce another provider without separate evidence and architectural review.
5. Never use credentials, names, fuzzy matching, HKB rankings, Fantrax FPts, Statcast values, age, or prospect reputation as level authority.

## Canonical level contract

Derive a provider-neutral vocabulary from actual reviewed provider values and repository conventions. Candidate concepts include MLB, AAA, AA, A+, A, Rookie, Complex, DSL, inactive, and unknown, but do not adopt enum names or mappings blindly.

Canonical evidence must expose factual equivalents of:

- `isMinorLeaguer`;
- `currentLevel`;
- `levelSource`;
- `levelAvailability`;
- `levelFreshness`; and
- bounded raw source evidence for diagnostics.

Absent level remains `UNKNOWN` or null. It must not become MLB, near-MLB, or distant prospect.

Restore `players.is_minor_leaguer` through the canonical repository/input path, while preserving the distinction between the boolean minor-league state and specific level evidence.

## Schema review

Determine explicitly whether existing storage can represent canonical level, source, freshness, availability, and audit evidence safely.

If a schema addition is proven necessary, propose the smallest additive migration. It must be non-destructive, narrowly scoped, RLS-safe, preserve stable `players.id` UUIDs and all external identities, and make no ownership or roster rewrite. Migration creation, application, deployment, and production backfill require the authority stated by the future implementation task and subsequent architect gates.

## Boundaries with G1

G0 supplies factual evidence; it does not choose final archetype weights or repair composite scoring. G1 remains responsible for centralized classification precedence and the reviewed mapping from canonical levels to `NEAR_MLB_PROSPECT` and `DISTANT_PROSPECT`.

Do not classify archetypes in G0 except where a narrow fixture is required to prove the input contract. Do not repair Statcast resolution, missing-evidence composite inflation, age/trajectory dominance, reliever confidence, or Prospect Opportunity Cost formulas.

## Required validation

Add deterministic coverage for MLB, AAA, AA, A+, A, Rookie/Complex, DSL, missing level, stale level, inactive state, provider alias normalization, minor-leaguer true with missing level, minor-leaguer false with MLB level, and unknown-state preservation.

Prove age, HKB, Fantrax production, Statcast, and names cannot change level. Prove UUIDs and identity fields remain unchanged, canonical reads remain league scoped, missing values remain missing, and any preview/import boundary remains read-only until separately authorized persistence.

Run focused provider/normalization, repository, canonical-input, identity, architecture, and Player Intelligence foundation tests; then the complete `tests/*.test.mjs` suite, JavaScript syntax checks, and `git diff --check`.

## Completion gate

Record the selected factual authority, canonical vocabulary and aliases, source/freshness model, storage decision, read/write boundaries, files changed, tests, and known limitations in `docs/NEXT_TASK_RESULT.md`. Stop for architect review before deployment, migration application, provider refresh, production backfill, or resuming G1 unless separately authorized.

After G0 is locally validated, reviewed, and checkpointed, resume V5.5B-6G1, followed by G2 Statcast Canonical Input Repair, G3 Evidence Sufficiency / Missingness Repair, and G4 Real-Player Recalibration.
