# Next Task: V5.4.6E Gate 4 Controlled Maximum 10-Player Fantrax Synchronization Acceptance

## Status And Baseline

- Status: execution contract for a separate task. This planning checkpoint does not authorize synchronization, deployment, release-setting changes, database writes, or other cloud writes.
- Baseline: accepted `feature/manager-intelligence` commit `70bdaa109c5a2f51817145935f01f5f5743055cf`.
- Gate 3 is accepted: one exact four-player attempt completed with four `APPLIED` items, immutable protected fields, database actor stamping, clean replay checks, zero Data Health failures, correct audit UI, clean browser console, disabled expanded opt-in, and passing focused/full tests.
- Production migrations 009, 010, and 011 and the durable audit/recovery boundary are deployed and accepted. The expanded league opt-in is disabled.
- Rule 20 authority for this gate is explicit and exact: Gate 4 may execute one batch containing exactly 10 players. It does not authorize 1-9, 11 or more, a second batch, routine synchronization, or any later gate.

## Objective

Prove scale only by executing exactly one authenticated production status-only synchronization at the currently supported maximum expanded batch size of 10 reviewed players. Do not add capabilities, modify application or database boundaries, or relax any Gate 3 safeguard. If exactly 10 genuinely eligible candidates cannot be established from one fresh Current-period preview, stop without writing.

## Candidate-Selection Contract

All 10 candidates must satisfy every condition in the same fresh preview:

1. Recommendation is exactly `APPLY_FANTRAX_STATUS`; current cloud status differs from the known target status.
2. Fantrax source status is exactly `ACTIVE`, `RESERVE`, `INJURED_RESERVE`, or `MINORS`, mapping only to `ACTIVE`, `RESERVE`, `IL`, or `MINORS`. Exclude unknown, missing, and `UNCLASSIFIED` Fantrax source statuses.
3. Player identity is an exact authoritative Fantrax API identity derived through the accepted strict wrapper rule. No name, fuzzy, inferred, or MLBAM fallback is permitted.
4. Team identity is the exact authoritative persisted `fantrax_team_id` in the active league. No name suggestion or inferred team mapping is authoritative.
5. Expected cloud owner exactly matches the reviewed team mapping. Exclude ownership differences, free agents, different-owner conflicts, releases, removals, and any ownership repair.
6. No candidate has `MANUAL` provenance, an override actor, an override timestamp, an override conflict, or a manual override introduced after preview.
7. Player UUID, league UUID, current status, owner, player/team identities, release policy, and season/period context match the reviewed manifest immediately before persistence.
8. Each row is status-only. No ownership, free-agent, identity, manual-override, score, metric, import, HKB, team, manager, or other player-field change is authorized.
9. Record for each candidate: name, player UUID, exact Fantrax player ID, persisted Fantrax team ID, expected owner UUID, previewed status, target status, provenance/override state, and every exclusion check.
10. Selection starts empty, contains exactly 10 named players, and any selection or input change invalidates acknowledgement and requires complete re-review.

The 11th player must remain blocked in the UI, service, manifest, repository, and database boundaries. Do not split an intended operation of more than 10 players into multiple batches, retries, manifests, accounts, sessions, or deployments to circumvent the cap. Evidence that the intended operation exceeds 10 is a stop condition, not permission to partition it.

## Pre-Write Gates

1. Confirm the expected branch/commit, clean tree, applicable repository instructions, and consistency among Rule 20, this contract, deployed schema, and production authorization.
2. Rerun focused Gate 4/Fantrax, audit/recovery, season-context, team-identity, roster-manager, Data Health, auth/configuration tests and the complete sorted `tests/*.test.mjs` suite; require all to pass. Run `git diff --check`.
3. Verify migrations 009-011 exactly once as already deployed; do not reapply them. Verify audit tables/triggers, RLS, private authorization helpers, manifest-v2 creation, lifecycle/immutability rules, replay prevention, actor stamping, cross-league isolation, default cap 3, expanded cap 10, and item ordinals 0-9.
4. Publish the exact authorized commit through the established authenticated preview workflow. Record the Pages run, exact commit, artifact identity, and successful application loading.
5. Complete **Gate A: Pre-preview readiness**. Require an authenticated session, the correct active league, healthy loading of the exact hosted artifact, authoritative persisted team identity availability, available durable audit history, accepted audit/recovery readiness, manual-override protection, deployed database cap and release-tier readiness, reliable browser inspection, and a clean console. Run only Data Health checks that can be evaluated without a fresh Fantrax observation and require those readiness checks to pass.
6. At Gate A, `Fantrax Season Context Review` must not be treated as `PASS` unless the application already holds the exact fresh preview that will be used for the write. Without that observation it may be `UNAVAILABLE`, `REVIEW_REQUIRED`, or an equivalent fail-closed state. That state does not fail Gate A merely because the read-only preview has not yet been acquired, but it never authorizes persistence.
7. After Gate A passes, fetch one fresh `Current` Fantrax preview. Preview acquisition is read-only and is not authorization to write. Derive the observed external league ID, season year, available league-history identity, and returned Current-period context from that preview.
8. Complete **Gate B: Post-preview pre-write readiness** before any persisted write. Compare the observed context with the accepted reviewed persisted context and require `Fantrax Season Context Review = PASS`, Current-period verification, exact player and team identity coverage, no unknown or `UNCLASSIFIED` source statuses in the proposed set, manual-override and conflict protection, stale-preview protection, and every remaining write-readiness/Data Health check to pass. A failed league, season, history, or Current-period comparison stops execution.
9. Between the preview fetch and successful completion of Gate B, perform no persisted write of any kind. Only after Gate B passes may the workflow enable expanded opt-in, select candidates, construct an audit attempt or manifest, or persist roster status.
10. Enable only the exact reviewed league-scoped `V5.4.6E_OPT_IN_10` setting after Gate B passes. Because a release/configuration change invalidates write authorization, refresh league data, fetch another fresh Current preview, and repeat all Gate B comparisons and write-readiness checks before candidate selection.
11. Identify exactly 10 candidates satisfying every criterion. If only 9 or fewer qualify, stop. Do not weaken criteria, substitute ambiguous rows, include releases, or reduce the batch size under this authorization.
12. Capture the final preview timestamp and deterministic hash of the normalized inputs. Capture pre-write counts, exact projections, and deterministic hashes for all protected fields, teams, scores, metrics, and pre-existing audit history.
13. Construct and inspect one manifest-v2 binding release tier, cap 10, reviewed count 10, final preview hash/timestamp, Current period, accepted season context, exact UUIDs, identities, owners, current statuses, targets, and item ordinals 0-9. Record the deterministic digest.
14. Prove an attempted 11th selection/submission remains blocked without creating an attempt or player write. Return to the exact reviewed 10-player selection and regenerate evidence if this check invalidates review state.
15. Require exact-set acknowledgement and a separate final confirmation naming all 10 players, release tier, effective cap, manifest digest, and status-only scope. Confirm the persistence request is byte-for-byte/field-for-field equivalent to the reviewed manifest.
16. Any change to the period, active league, league configuration, reviewed season context, candidate set, release setting, or preview invalidates Gate B and all write authorization. Repeat the fresh-preview Gate B sequence from the beginning; never carry authorization forward from stale observations.

Any stale preview, season/period drift, changed configuration, identity/owner/status/provenance mismatch, manifest/request discrepancy, applicable Gate A failure, Gate B failure, post-preview Data Health failure, or authorization contradiction stops the run before persistence. Gate A cannot authorize a write, and a successful read-only preview cannot authorize a write without a subsequent successful Gate B.

## Authorized Write Boundary

- Execute exactly one new manifest-v2 attempt with exactly 10 items. Do not execute a smaller batch, an 11th item, a second batch, or an automatic retry.
- The only permitted player payload fields are `roster_status`, `roster_status_source = 'FANTRAX'`, and the established update timestamp.
- Immediately before attempt creation and every grouped persistence call, repeat active-league, expanded-release signature, fresh-preview hash/timestamp, matching accepted season context, Current period, exact player/team identity, expected owner, previewed current status, allowed target status, non-manual provenance, and exact-manifest guards.
- Any unexpected skip, failure, pending row, partial lifecycle, stale guard, ambiguous result, protected-field difference, or database contradiction stops the gate. Preserve durable evidence and do not continue with another batch.

## Protected-Field Snapshot

Before and after the attempt, compare counts plus deterministic hashes or exact projections covering:

- player UUID and league UUID;
- owner team and free-agent state;
- Fantrax ID, MLBAM ID, name, normalized name, MLB organization, and positions;
- manual-override source, actor, and timestamp;
- HKB values/ranks, asset class, notes, imported attributes, and every non-status player field;
- team UUID, league UUID, Fantrax team ID, name, abbreviation, and manager assignment;
- every calculated-score row and score-bearing value;
- every player-metric row and metric payload;
- every pre-existing Fantrax audit attempt/item and immutable manifest/lifecycle field.

For the selected 10 players, the only permitted differences are the reviewed target `roster_status`, `roster_status_source` becoming `FANTRAX`, and the expected update timestamp. Any other difference fails acceptance.

## Post-Write Acceptance Gates

1. Verify exactly 10 intended player rows changed and no unselected player row changed. Verify every before/after status individually.
2. Verify one database-stamped actor, one immutable manifest-v2 digest, release `V5.4.6E_OPT_IN_10`, cap 10, reviewed count 10, and exact item ordinals, identities, owners, current statuses, and targets.
3. Require all 10 items to reach `APPLIED` with no skipped, failed, pending, duplicated, or missing item. Require the attempt to reach `COMPLETED` with internally consistent lifecycle timestamps, terminal count 10, and recoverable count 0.
4. Compare all protected counts, projections, and hashes. Require exact equality outside the authorized status/provenance/timestamp fields.
5. Refresh league data and obtain a new Current preview. Require `NO_CHANGE` for all 10 selected rows, matching season context, and no evidence of an unselected mutation.
6. Submit the same exact manifest/digest once as the planned idempotency check. It must resolve to the existing attempt, perform zero player changes, create no duplicate attempt/items, and preserve terminal non-replayability.
7. Confirm terminal item replay remains rejected. Inspect existing failed/pending rows only to verify documented recovery semantics; do not inject a production failure or recover unrelated history.
8. Run authenticated Data Health and inspect the audit UI. Require zero new failure and correct release, cap, actor, digest, reviewed, terminal, recoverable, lifecycle, attempt, and item rendering.
9. Verify the browser console has no errors or warnings attributable to Gate 4.
10. Disable the expanded league opt-in immediately after acceptance and verify new expanded attempts are blocked while the exact completed attempt remains inspectable.
11. Restore GitHub Pages or any temporary deployment configuration to `main` according to the established workflow and verify the restoration deployment succeeds.
12. Rerun the focused tests, the complete sorted standalone suite, and `git diff --check`. Record exact commands and results.

## Recovery And Stop Plan

- Disable the league opt-in first after any uncertain or incomplete outcome. Do not delete or rewrite audit rows, digests, manifests, or outcomes.
- Do not automatically compensate or reverse an applied player status. Preserve terminal rows and all protected snapshots.
- A real `FAILED` or `PENDING` item ends Gate 4. Recovery is not authorized by this task; it requires separate architect review and may address only the original exact manifest under every fresh guard.
- Never replay `APPLIED` or `SKIPPED` items, broaden the manifest, replace a candidate, or create a second attempt to complete the intended operation.
- Stop immediately on any identity ambiguity, owner/status/provenance change, manual override, period/season drift, stale preview, manifest mismatch, protected-field change, replay weakness, cross-league exposure, unexpected database result, or repository contradiction.

## Explicitly Prohibited

- Any synchronization other than one exact 10-player Gate 4 batch, including 1-9 players, 11 or more players, a second batch, a split batch, routine/bulk synchronization, background retry, or Select All.
- Releases/removals, unknown or `UNCLASSIFIED` Fantrax source statuses, ownership/free-agent changes, identity repair, fuzzy/name/MLBAM fallback, manual-override changes, or ambiguous/unmapped identities.
- Imports, player/team creation, ownership repair, score recalculation, HKB/metric writes, manager changes, migration/schema changes, audit deletion, or unrelated cloud writes.
- Application, test, or migration changes merely to make Gate 4 pass. Any required capability change is a separate architect-reviewed task.
- Merging into `main`, authorizing Gate 5, or treating acceptance as routine synchronization authority.

## Definition Of Done

Gate 4 is accepted only when exactly one 10-player status-only manifest completes with all 10 items `APPLIED`, the attempt is `COMPLETED`, the 11th player remains blocked, no cap-circumvention split occurs, replay performs zero writes, protected fields match, the fresh Current preview reports `NO_CHANGE` for all selected rows, Data Health/audit UI/browser console are clean, the opt-in is disabled, deployment configuration is restored, and all tests/checks pass. Gate 4 acceptance does not authorize routine or bulk synchronization; that requires a separate architect decision after review of the complete Gate 4 evidence.
