# Next Task: V5.5A Automated Statcast Data Provider

## Status And Authority

- Status: planning and implementation contract for the next separately executed task.
- Baseline: `feature/manager-intelligence` after the documentation commit `Suspend Gate 4 and begin V5.5 intelligence roadmap`.
- This document does not itself authorize implementation, deployment, migration application, production import, cloud writes, player creation, identity repair, score calculation, or any Fantrax synchronization operation.
- V5.4.6E Gate 4E-1 is suspended because external GitHub Pages infrastructure prevented publication of its exact hosted artifact. Fantrax synchronization is frozen at its current safe checkpoint; the ten-player production synchronization remains unexecuted.

## Objective

Establish a reliable automated Statcast ingestion foundation that replaces repeated screenshots and CSV-only collection with a provider-driven pipeline:

```text
source collector
  -> immutable/raw snapshot preservation
  -> schema and value validation
  -> MLBAM player identity resolution
  -> normalized hitter/pitcher metrics
  -> authenticated, league-scoped Supabase persistence
  -> Data Health and audit reporting
```

V5.5A supplies trustworthy, fresh metrics. It does not implement Player Intelligence Engine 2.0 scoring, waiver decisions, roster-churn classification, or trade recommendations.

## Required Discovery Before Implementation

1. Re-read all repository instructions and inspect the current V5 provider, import, repository, identity, metric, and Data Health boundaries.
2. Use current primary-source Baseball Savant, Statcast, and MLB documentation plus safe live read-only endpoint inspection. Do not rely only on remembered interfaces.
3. Inventory candidate public endpoints and downloadable interfaces, their terms and access constraints, supported seasons, pagination/row limits, rate limits, response formats, schema stability, and whether credentials or browser sessions are required.
4. Prefer documented public endpoints or downloadable data interfaces. Do not use credentials, copied cookies, browser-session scraping, Selenium, or an undocumented authenticated endpoint without a separate architecture review.
5. Produce a discovery record identifying which interface supplies each approved metric. Do not assume that one endpoint supplies every metric.
6. Stop before implementation if the source requires prohibited authentication/scraping, lacks stable MLBAM identity, conflicts with repository schema/RLS, or cannot support a fail-closed validation boundary.

## Existing Architecture And Safest Integration Point

- Existing CSV Statcast ingestion lives in `js/services/cloudCsvImportService.js`; it previews source rows, resolves existing players, writes `player_metrics`, and reports exceptions. V5 repositories include `v5/js/repositories/metricRepository.js`, `playerRepository.js`, `importJobRepository.js`, and the Data Health services/views.
- Build a source-specific collector/provider behind a provider interface. It may fetch and preserve raw source payloads but may not resolve players, write Supabase rows, calculate intelligence scores, or render UI.
- Put source-independent validation, MLBAM resolution, metric normalization, batching, partial-failure accounting, and refresh orchestration in services shared by automated and future manual ingestion paths. Do not duplicate those rules inside the provider or a view.
- Persist normalized metrics through the canonical authenticated repository/Supabase boundary. Reuse or extend `metricRepository.js` and import-job/audit infrastructure rather than calling Supabase directly from the provider.
- Keep the existing CSV workflow operational until automated ingestion is independently validated. If shared logic is extracted, prove CSV behavior remains unchanged with regression tests.
- Views may request a refresh and render state only. They must not fetch Baseball Savant directly, normalize metrics, resolve identity, or issue writes.

## Source And Metric Research Contract

### Hitter Metrics

Determine availability, definitions, units, minimum-sample behavior, and source endpoints for at least:

- plate appearances;
- xBA, xSLG, xwOBA, and wOBA;
- barrel rate and hard-hit rate;
- average and maximum exit velocity;
- launch angle and sweet-spot rate;
- chase rate and whiff rate;
- strikeout and walk rates;
- sprint speed where available.

### Pitcher Metrics

Determine availability, definitions, units, minimum-sample behavior, and source endpoints for at least:

- innings pitched and/or batters faced context;
- xERA and xwOBA allowed;
- strikeout and walk rates;
- whiff and chase rates;
- barrel and hard-hit rates allowed;
- average exit velocity allowed;
- velocity;
- pitch usage where practical.

For every field, record canonical metric key, source column, player type, aggregation grain, numerator/denominator or sample context, unit, nullable behavior, season applicability, and validation range. Unsupported fields remain explicitly unavailable; never synthesize or infer them from names or unrelated metrics.

## Retention And Refresh Decisions

1. Compare current-season aggregate, game-level, and pitch-level retention for diagnostic value, storage cost, recomputation needs, and downstream V5.5B requirements.
2. Default toward retaining immutable raw retrieval snapshots plus normalized current-season aggregates. Retain game- or pitch-level data only when a documented V5.5B use case requires it and storage/retention policy is approved.
3. Define a sensible daily or periodic refresh cadence. Avoid high-frequency polling. Make refresh idempotent for the same provider, source date, season, player, metric type, and snapshot identity.
4. Preserve enough raw metadata to reproduce normalization and diagnose source drift: provider, endpoint/interface, request parameters excluding secrets, response schema/version when available, source date, season, fetched time, checksum, row counts, and validation warnings/errors.
5. The browser is never the raw-data source of truth.

## Identity And Data-Preservation Contract

- MLBAM ID is the authoritative Statcast join identity. Resolve incoming MLBAM IDs only to existing league-scoped players and preserve permanent `players.id` UUIDs.
- Player names are diagnostic display data only and cannot authorize a match, insert, identity update, or metric write.
- Do not recreate players, merge players, change `fantrax_id`, replace a valid `mlbam_id`, or backfill an MLBAM ID from ambiguous provider data.
- Missing, malformed, duplicate, cross-league, or unmatched MLBAM IDs are reported and skipped. No fuzzy or normalized-name fallback is permitted.
- A provider row must never write ownership, roster status/provenance, manual overrides, team identity, HKB values, calculated scores, Fantrax identity, or unrelated player fields.
- All reads and writes remain authenticated, league-scoped, RLS-protected, paginated, and batched.

## Validation And Failure Isolation

1. Validate HTTP status, content type, payload size, parseability, required identity fields, season/source dates, schema, metric types, finite numeric values, ranges, and duplicate keys before persistence.
2. Preserve explicit distinctions among no data, unsupported metric, stale data, source unavailable, permission blocked, malformed response, validation failure, unmatched identity, and persistence failure.
3. One failed player or metric group must not corrupt validated rows. Batch results must report inserted, updated, unchanged, skipped, and failed counts; partial failure is never success.
4. Use deterministic snapshot and normalized-row checksums. Repeating an identical successful snapshot must be idempotent and must not manufacture changed rows.
5. Source-schema drift fails closed before affected metric writes and leaves the last successful normalized data intact.
6. Define retry/resume semantics at safe batch boundaries. Do not retry non-idempotent writes blindly.

## Freshness, Audit, And Data Health

Each normalized metric set must expose:

- provider;
- source date;
- season;
- fetched_at;
- normalized/imported timestamp;
- freshness status;
- source snapshot/checksum reference;
- warnings and errors.

Data Health and refresh reporting must show:

- players/rows requested;
- rows received and validated;
- players matched by MLBAM;
- unmatched, malformed, and duplicate MLBAM IDs;
- metric rows inserted, updated, unchanged, skipped, and failed;
- stale or unavailable data;
- last attempt and last successful refresh;
- provider/schema drift and partial-failure state.

Unavailable or failed reads must never render as a genuine zero. Audit records and source metadata must not expose credentials or session material.

## Implementation Sequence

1. Complete and document source-interface research and the metric-to-source matrix.
2. Define the provider response contract, raw snapshot envelope, normalized metric schema, freshness model, and idempotency keys.
3. Add focused collector fixtures/tests using recorded non-sensitive responses; live source tests remain read-only and bounded.
4. Implement the collector with timeout, rate-limit, payload-size, schema, and error controls.
5. Implement shared validation and MLBAM-only resolution against paginated existing-player reads.
6. Implement normalized metric batches through the canonical repository and authenticated RLS path; create an additive migration only if the reviewed schema cannot represent required raw/audit/freshness metadata.
7. Integrate import-job/audit and Data Health reporting without coupling provider code to views.
8. Add an explicit preview/dry-run that performs collection, validation, identity resolution, and planned-write reporting with no database mutation.
9. Validate idempotency, partial failures, source drift, cross-league isolation, protected fields, and unchanged legacy CSV imports.
10. Stop for architect review before applying any migration, deploying, scheduling refreshes, or importing production Statcast data.

## Required Tests And Acceptance Evidence

- Provider contract and representative hitter/pitcher fixture normalization.
- Missing/malformed/duplicate MLBAM IDs and explicit prohibition of name authorization.
- Stable `players.id`, preserved Fantrax identity, and no player creation.
- Raw snapshot/checksum metadata and schema-drift rejection.
- Metric units, nullability, ranges, sample context, and season/source-date handling.
- Pagination, bounded collection, batched persistence, idempotent replay, retry/resume, and isolated partial failure.
- RLS/league scoping and rejection of cross-league rows.
- Protected-field verification for ownership, roster status/provenance, overrides, identities, HKB, and calculated scores.
- Data Health distinctions for zero, stale, unavailable, permission blocked, query failed, and partial failure.
- Existing CSV Statcast imports and unrelated Fantrax synchronization behavior unchanged.
- Focused tests, complete `tests/*.test.mjs` suite, and `git diff --check`.

## Stop Conditions

Stop and report before deviating if research or repository evidence reveals an unstable/prohibited source, ambiguous identity, destructive schema change, required service-role bypass, missing league/RLS boundary, source-to-metric contradiction, unbounded dataset, inability to preserve raw diagnostic evidence, or any need to overwrite protected fields.

## Explicitly Out Of Scope

- Production deployment, scheduler activation, migration application, or cloud/data writes.
- Production Statcast import or score recalculation.
- Player creation, merging, identity repair, Fantrax identity changes, ownership or roster-status changes.
- Player Intelligence Engine 2.0 scoring, waiver-vs-roster decisions, churn classification, consolidation, or trade-target recommendations.
- Reopening Gate 4E-1, expanded Fantrax opt-in, previews, manifests, audit attempts, or roster synchronization.

## Deliverables

- Primary-source research record and metric/source matrix.
- Provider, raw snapshot, normalized metric, freshness, and audit contracts.
- Smallest coherent implementation and any unapplied additive migration required by the reviewed design.
- Focused regression coverage and complete-suite validation.
- Updated `docs/NEXT_TASK_RESULT.md` containing implementation evidence and explicit confirmation that no production deployment, migration, import, score recalculation, identity change, or Fantrax synchronization occurred.
