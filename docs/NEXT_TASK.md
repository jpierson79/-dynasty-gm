# Next Task: V5.5B-6G0B Prospect Level Protected Baseline Profile

## Status and authority

- V5.5B-6G0 is checkpointed. V5.5B-6G0A stopped safely before writes because no operation-specific protected-baseline profile exists.
- Migration 014 remains unapplied. V5.5B-6G1 remains `BLOCKED ON PROSPECT LEVEL EVIDENCE FOUNDATION`, calibration remains `CALIBRATION_REQUIRED`, and V5.5C remains blocked.
- This task is local implementation and validation only. It does not authorize migration application, deployment, provider collection, production/cloud access, imports, prospect-level population, Player Intelligence persistence, Engine 5.1.1 changes, or identity/ownership/roster changes.

## Objective

Implement a provider-neutral protected-baseline profile named `PROSPECT_LEVEL_POPULATION` for the future authenticated, league-scoped prospect-level population operation. The profile proves mutation boundaries only; it must not apply Migration 014, collect or normalize provider data, or write prospect-level evidence.

Do not overload or weaken `STRICT`, `MLBAM_BACKFILL`, `STATCAST_REFRESH`, or `FANTRAX_PRODUCTION_IMPORT`.

## Authoritative player-field contract

Derive and test the allowed field set directly from `supabase/migrations/014_prospect_level_evidence.sql`. The exact Migration 014 fields are:

- `current_level`
- `level_source`
- `level_availability`
- `level_observed_at`
- `level_raw_evidence`

Do not include `is_minor_leaguer`; Migration 014 does not authorize it for mutation.

Determine whether the canonical repository/database update path unavoidably changes `updated_at`. Return exactly one implementation decision in the result:

- `UPDATED_AT_PROTECTED`; or
- `UPDATED_AT_EXPECTED_MUTABLE` with the proven mechanism requiring it.

Prefer `UPDATED_AT_PROTECTED`. Do not allow it merely for convenience.

Every other player field remains protected, including UUID and external identities, name, position, age, minor-leaguer boolean, organization/team data, ownership, roster/free-agent state, scoring/market data, provider identities, and unrelated timestamps.

## Protected domains

Fully hash and protect calculated player scores, all player metrics, teams, managers, league settings, ownership and roster state, identities, Fantrax data, Statcast data, and HKB data. No metric partition is expected mutable.

## Pre-migration capture

The before baseline must be capturable before Migration 014 exists in production. Hash existing protected player fields without querying absent Migration 014 columns as protected data. Represent the expected-mutable partition's absent schema state deterministically without inventing field values. Capture scores, metrics, teams, managers, and other protected domains normally.

Logically separate protected player evidence from expected-mutable prospect-level evidence. After migration and a future population operation, exact allowed-field changes may produce `EXPECTED_MUTATION`; any protected change produces `CHANGED`, overriding simultaneous expected mutation.

## Comparison and determinism

Preserve the fail-closed states `UNCHANGED`, `EXPECTED_MUTATION`, `CHANGED`, `UNAVAILABLE`, `PERMISSION_BLOCKED`, and `QUERY_FAILED`. Unreliable protected reads cannot report success.

Hashes must remain row-order independent, object-field-order independent, stable for nulls, and unaffected by capture time. Timestamps participate only when the profile contract explicitly includes them.

## Authentication, RLS, and routing

Capture remains authenticated, league-scoped, read-only, provider-neutral, and subject to normal Supabase RLS. No service role or privileged bypass is permitted.

If hosted acceptance needs a canonical UI action, route Prospect Level Population only to `PROSPECT_LEVEL_POPULATION`; expose no free-form profile selector. Preserve fixed routing for MLBAM, Statcast, and Fantrax Production and preserve `STRICT` unchanged.

## Required tests

Add deterministic coverage proving:

1. the profile is registered;
2. its exact allowed set matches Migration 014;
3. the `updated_at` decision is explicit;
4. identities, ownership, roster state, position, age, `is_minor_leaguer`, and unrelated player fields remain protected;
5. scores, metrics, teams, managers, and league settings remain protected;
6. only allowed level fields changing yields `EXPECTED_MUTATION`;
7. any protected player/domain change yields `CHANGED`, including simultaneous allowed changes;
8. deterministic ordering, object ordering, nulls, and hashes;
9. capture works before the new columns exist;
10. unavailable, permission-blocked, and query-failed reads remain fail-closed;
11. all existing profiles retain their semantics; and
12. fixed UI routing cannot be weakened or selected freely.

Run focused protected-baseline/service/UI tests, existing profile regressions, architecture and auth tests, the complete `tests/*.test.mjs` suite, JavaScript syntax checks, and `git diff --check`.

## Completion gate

Record the profile implementation, exact allowed fields, `updated_at` decision, pre-migration capture design, protected partitions, routing, files changed, and exact validation results in `docs/NEXT_TASK_RESULT.md`. Stop for architect review before committing unless separately authorized.

After G0B is locally validated, reviewed, and checkpointed, resume V5.5B-6G0A Migration / Data Population Acceptance. Only accepted schema and data evidence may unblock G1.
