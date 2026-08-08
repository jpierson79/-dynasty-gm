# Next Task: V5.4.6E Controlled Fantrax Roster Synchronization Expansion

## Status And Baseline

- Status: planning contract for architect review; implementation, migration creation/application, deployment, and production writes require explicit later authorization.
- Branch baseline: `feature/manager-intelligence` at `82dc2319a6ea414186ed3b248efa63ed9b72d714`.
- V5.4.6D-1 is accepted. Migration 009 is applied and its authenticated audit/recovery acceptance passed.
- The current production and application limit remains one to three explicitly selected players. This phase definition does not increase that limit by itself.

## Objective

Expand the reviewed Fantrax roster-status synchronization boundary from the current three-player cap to one deliberately bounded larger batch while preserving exact review, durable audit evidence, replay-safe recovery, and every existing write-time protection. The first expanded release must be opt-in, reversible, league-scoped, and limited to a maximum of 10 reviewed players. Any increase beyond 10 is a separate phase and requires new evidence and authorization.

## Why This Phase Is Next

- V5.4.6B proved an exact three-player status-only apply without changing protected fields.
- V5.4.6C prevents writes under an unreviewed or changed Fantrax season context and invalidates stale previews.
- V5.4.6D plus migration 009 provides durable immutable manifests, database-stamped actors, classified per-row outcomes, lifecycle enforcement, duplicate-digest protection, and replay-safe recovery.
- The remaining operational gap is controlled scale. A jump directly from three rows to the full eligible set would enlarge the failure domain without intermediate evidence.
- Migration 009 enforces `reviewed_count between 1 and 3` and `ordinal between 0 and 2`; therefore a UI-only limit change would contradict the database boundary and is prohibited.

## Release Model

1. Keep the default and fallback cap at 3.
2. Add a named opt-in release tier for a maximum of 10 rows. The release must be disabled unless the active league has an explicit reviewed setting and the running application recognizes the exact release identifier.
3. Include the release identifier and effective cap in the immutable, versioned manifest and digest so retry cannot change tiers or broaden the reviewed UUID set.
4. Fail closed when the release setting is missing, malformed, stale, for another league, or above the application/database-supported cap.
5. Provide an immediate operator rollback by disabling the opt-in setting; this prevents new expanded attempts but does not delete or alter existing audit evidence or block safe recovery of an already prepared attempt.
6. Do not add a 25-row, full-roster, select-all, or automatic synchronization tier in V5.4.6E. A later tier requires separate production evidence and architect approval.

## Authorized Implementation Scope After Separate Approval

1. Design an additive migration following 009 that widens only the audit constraints required for the 10-row tier and preserves all existing tables, rows, RLS, actor stamping, immutability, lifecycle transitions, and replay prevention.
2. Decide whether release metadata belongs in immutable attempt columns or the versioned manifest representation; prove it cannot be altered after preparation and cannot be spoofed to exceed the supported cap.
3. Replace hard-coded three-row application checks with one centralized effective-cap policy whose default is 3 and whose only expanded value is 10 for an explicitly opted-in active league.
4. Keep selection empty by default. Require individual row selection; do not add Select All. Display selected count, effective cap, release tier, and the exact named players in both review and final confirmation.
5. Invalidate acknowledgement and confirmation whenever selection, preview, league, external league configuration, scoring period, season context, team mapping, or release setting changes.
6. Canonicalize and digest the exact selected UUID set with expected owner, previewed status, target status, exact Fantrax player/team identities, Current period, reviewed season context, manifest version, and release tier.
7. Prepare or recover the durable attempt before player persistence. Resume only `PENDING` and `FAILED` rows from the same immutable digest; never replay `APPLIED` or `SKIPPED` rows and never add a row during recovery.
8. Repeat season-context, Current-period, stale-preview, active-league, exact player/team identity, expected-owner, previewed-status, allowed-target-status, and manual-override guards immediately before every write group and again on recovery.
9. Preserve grouped/batched status writes. Do not introduce per-player remote requests or a single unbounded write.
10. Refresh league data and obtain a fresh Current-period preview after every returned attempt. Report completed, partial, failed, skipped, and recoverable outcomes accurately.
11. Extend the read-only audit/recovery panel and Data Health output to show release tier, reviewed count, terminal/pending counts, recovery eligibility, and cap/configuration inconsistencies without making Fantrax reads.

## Protected-Field Boundary

The only player payload fields permitted are:

- `roster_status`
- `roster_status_source = 'FANTRAX'`
- the established update timestamp

The synchronization must never write ownership, free-agent state, player UUID, Fantrax or MLBAM identity, name, organization, position, team identity, manager assignment, scores, HKB values/ranks, metrics, manual-override actor/time, or unrelated fields.

Before and after controlled acceptance, verify counts and deterministic hashes or equivalent exact comparisons for:

- player UUID, league, identity, owner, free-agent, manual-override, HKB, score-bearing, and metric-bearing fields outside the permitted payload;
- team UUID, league, Fantrax identity, name, and manager assignment;
- calculated scores and player metrics.

Any protected-field difference is a failed acceptance and stops further synchronization.

## Required Safety Invariants

- Current-period-only synchronization remains mandatory in UI, service, manifest, database, and recovery paths.
- Reviewed and observed Fantrax season contexts must match at preparation and immediately before each write group and recovery write.
- Preview data must be fresh and tied to the active league/configuration; stale preview or changed configuration fails closed.
- Only exact `APPLY_FANTRAX_STATUS` rows may be selected. Names, fuzzy matching, and MLBAM fallback are prohibited.
- Ownership differences, unmatched identity, unmapped team identity, unknown/unclassified Fantrax status, owner changes, status changes, and manual overrides remain excluded or classified as skips/conflicts.
- Manual override protection is repeated in the database write predicate; an override created after review must win.
- Audit rows remain league-scoped under RLS and actor-stamped by the database. No browser delete or audit-rewrite path may be introduced.
- A repeated manifest resolves to the same attempt. Terminal item outcomes cannot be replayed.
- Preview and routine Data Health remain read-only and do not store raw Fantrax payloads or credentials.
- The approved fail-closed mapping-first/settings-second season-review sequence remains unchanged.

## Required Tests

- Migration static and database tests for the additive constraint change, RLS, private authorization helpers, actor stamping, immutable release metadata, lifecycle transitions, cross-league isolation, and rollback compatibility with existing migration-009 rows.
- Cap-policy tests proving default 3, opted-in 10, rejection of 0/negative/non-integer/unknown/greater values, and league/configuration isolation.
- UI tests proving empty-by-default selection, no Select All, 10-row maximum, exact selected-player confirmation, and acknowledgement invalidation after every relevant state change.
- Manifest determinism and digest tests including release tier, cap, season context, period, selected UUIDs, expected owner/status, and exact external identities.
- Idempotency and recovery tests for duplicate submission, browser interruption, partial grouped writes, terminal-row exclusion, failed/pending retry, and inability to broaden the original set.
- Regression tests for Current period, season rollover, stale preview, exact identity, team mapping, expected owner/current status, manual overrides, protected payload fields, grouped writes, and accurate partial-result reporting.
- Data Health and audit-view tests for expanded, partial, failed, completed, inconsistent, and recoverable attempts.
- Focused Fantrax, roster-sync, roster-manager, Data Health, auth, and audit tests; then every `tests/*.test.mjs` file and `git diff --check`.

## Staged Acceptance Plan

### Gate 1: Local And Schema Review

- Implement and validate locally without applying a migration or enabling the expanded tier.
- Architect reviews the application diff, additive migration, rollback, tests, and protected-field query/hash plan.

### Gate 2: Migration Deployment And Read-Only Verification

- With separate explicit approval, apply the additive migration once through the approved Supabase workflow.
- Verify schema, existing migration-009 rows, constraints, triggers, RLS, helper schemas, actor stamping, immutability, lifecycle, replay, and cross-league controls.
- Do not enable the 10-row tier or synchronize rosters in this gate.

### Gate 3: Opt-In Controlled Production Acceptance

- With separate explicit approval, snapshot protected fields and enable the named 10-row tier for exactly one reviewed league.
- Fetch a fresh authenticated Current-period preview with matching season context.
- Select exactly one reviewed batch of no more than 10 eligible status-only rows from an empty selection. Include at least two write groups when safely available so grouped outcome handling is exercised.
- Complete exact review and separate final confirmation, then verify durable attempt/items, database actor, manifest digest, outcomes, refreshed preview, Data Health, and protected-field hashes.
- Safely prove replay behavior by resolving the same digest without rewriting terminal rows. If deliberate recovery testing requires a production mutation or fault injection, obtain separate explicit approval; otherwise use transaction rollback or a safe simulation.
- Disable the opt-in release after acceptance unless the architect explicitly approves leaving it enabled.
- Stop immediately on any partial result, unexpected skip, failed group, stale guard, protected-field difference, audit inconsistency, or browser/database contradiction. Preserve evidence and do not start a second batch without review.

## Explicitly Out Of Scope

- More than 10 selected rows, full-roster synchronization, Select All, scheduled/background sync, or automatic retries.
- Ownership synchronization/repair, free-agent rewrites, player/team creation, imports, score recalculation, identity repair, or manager changes.
- Weakening or bypassing migration 009, manual overrides, exact identity, season-context review, Current-period enforcement, stale-preview invalidation, league scoping, or field restrictions.
- Fantrax credentials, cookies, Selenium, Python, undocumented authenticated endpoints, or direct production-browser Fantrax calls.
- Merging into `main` without completed staged acceptance and architect review.

## Definition Of Done

V5.4.6E is complete only when the default remains capped at 3, the explicitly opted-in league can review and apply at most 10 exact status-only rows through the durable migration-009 audit/recovery boundary, every guard is repeated at write and recovery time, terminal outcomes are replay-safe, protected fields are unchanged, Data Health and audit rendering are accurate, all automated and authenticated staged acceptance checks pass, the opt-in state is explicitly resolved, and architect review authorizes the resulting checkpoint. Completion does not authorize any larger batch or merge into `main`.
