# Next Task: V5.5B-1 Canonical Player Intelligence Input And Component Foundation

## Status And Authority

- V5.5A implementation is complete; live coordinated production refresh acceptance remains suspended and unexecuted because exact GitHub Pages publication is unreliable.
- This task authorizes local V5.5B-1 implementation only. It does not authorize deployment, production reads/writes, score recalculation, migration creation/application, ingestion changes, identity/ownership/roster changes, or V5.5C waiver logic.
- Preserve Engine 5.1.1 behavior through an explicit compatibility path while building the new versioned foundation. Stop on any schema, metric, league-setting, or data-contract contradiction.

## Objective

Create one canonical, availability-aware input boundary and one normalized component-result contract for Player Intelligence Engine 2.0. Align accepted Statcast fields with engine consumers, make freshness/missingness explicit, and produce explainable component envelopes without tuning final Reddit Phanatics weights yet.

## Required Implementation

1. Inventory the current engine input at runtime and define `PLAYER_INTELLIGENCE_INPUT_VERSION` plus a deterministic adapter that accepts player, all relevant metric rows, league settings, and as-of time.
2. Select Statcast rows by explicit source/season/type/freshness rather than a single undifferentiated latest metric row. Preserve hitter and pitcher domains and never combine incompatible player types.
3. Canonicalize accepted automated-provider keys once at the adapter boundary. Support current normalized camelCase fields (`hardHitRate`, `barrelRate`, exit-velocity and allowed variants, `xwoba`, `xera`, etc.) and explicitly mapped reviewed legacy aliases. Modules must consume only canonical keys.
4. Missing, stale, unsupported, conflicting, or malformed inputs return explicit status/warnings; they must not silently become zero or neutral evidence. Player names cannot join data.
5. Define a reusable component envelope: `{score, status, confidence, evidence, warnings, version}`. Define scenario, signal, explanation, and source-freshness envelopes without deciding final component weights.
6. Add a V5.5B explanation/output builder that fits inside existing `calculated_player_scores.explanation` JSONB and retains a compatibility projection for current top-level fields. Do not create a migration.
7. Keep current Engine 5.1.1 calculation and persistence behavior unchanged by default. No view or decision service may create a second calculation path.
8. Add fixture-based calibration coverage for hitter, pitcher, prospect, missing/stale data, mixed metric rows, alias equivalence, and stable UUID attachment. Do not hard-code player-specific bonuses.

## Safety And Compatibility

- MLBAM remains authoritative for Statcast ingestion; permanent `players.id` remains the score attachment.
- Do not modify the Baseball Savant provider, metric persistence, HKB import, Fantrax services, protected-baseline profiles, score schema, RLS, or production data.
- Preserve existing score repository upsert key `(player_id, score_version)`, batches, cancellation, deterministic output, current views, recommendations, and trade consumers.
- Do not invent player fantasy production, role, defensive, injury, or prospect evidence. Mark unavailable inputs for later slices.

## Required Tests

- Canonical camelCase Statcast mapping and reviewed legacy-alias equivalence.
- Hitter/pitcher metric separation, season/source selection, freshness, and conflicts.
- Missing/unavailable/stale/malformed semantics and no name-based join.
- Component/scenario/signal/output envelope determinism and evidence traceability.
- Stable UUID, compatibility projection, unchanged Engine 5.1.1 outputs, unchanged repository batching/upsert behavior.
- Existing engine, calibration, player-intelligence, Data Health, Statcast, identity, decision, trade, auth, architecture, and Fantrax regressions.
- Complete `tests/*.test.mjs` and `git diff --check`.

## Deliverable And Stop

Implement locally, update `docs/NEXT_TASK_RESULT.md`, and stop uncommitted for architect review. Do not deploy, run a production provider preview/refresh, recalculate production scores, create/apply migrations, or begin V5.5B-2/V5.5C.
