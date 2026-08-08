# Next Task: V5.4.6E Gate 3 First Controlled Expanded Fantrax Sync

## Status And Baseline

- Status: execution plan for separate architect authorization. This planning checkpoint does not authorize deployment, release activation, database writes, or roster synchronization.
- Baseline: accepted `feature/manager-intelligence` commit `a743defc0db47d46eb9680fa2b185476ba594cc3`.
- Production migrations 009, 010, and 011 are applied. Gate 2 verified manifest-v2 creation, historical manifest-v1 recovery, actor stamping, immutability, lifecycle, replay prevention, RLS, cross-league isolation, default cap 3, and reviewed expanded cap 10.
- The league-scoped expanded opt-in is disabled. No expanded roster-status synchronization has occurred.

## Objective

Perform one deliberately conservative authenticated production synchronization of exactly 4 or 5 reviewed status-only players through the `V5.4.6E_OPT_IN_10` durable audit boundary. Four is preferred; use five only when a fresh Current-period preview offers five equally safe candidates and the fifth materially improves grouped-write evidence. Ten players are not authorized.

## Candidate-Selection Criteria

Every selected player must satisfy all criteria in the same fresh preview:

1. Exact stored Fantrax API player identity and exact persisted Fantrax team identity; no name, fuzzy, MLBAM, or inferred fallback.
2. Recommendation exactly `APPLY_FANTRAX_STATUS`, with no ownership conflict and the expected cloud owner equal to the reviewed Fantrax team mapping.
3. Known source status that maps exactly to `ACTIVE`, `RESERVE`, `IL`, or `MINORS`; exclude unknown, missing, and `UNCLASSIFIED` source statuses.
4. No `MANUAL` provenance, override actor, or override timestamp before review, and no manual override introduced before persistence.
5. No release candidate, free agent, ownership change, different-owner conflict, player/team mapping issue, identity ambiguity, or proposed ownership repair.
6. Current cloud status must equal the manifest's previewed status and differ from the exact target status.
7. Prefer four status-only rows spanning two target-status write groups when equally safe candidates exist. Do not weaken candidate quality merely to create a second group.
8. Record player UUID, display name, exact Fantrax player/team IDs, cloud owner UUID, previewed status, target status, and exclusion-check result before acknowledgement.

If fewer than four candidates meet every rule, stop without enabling or writing. If more than five qualify, choose the smallest, clearest four-row set; do not increase scope.

## Pre-Write Gates

1. Confirm clean expected branch/commit and rerun focused Fantrax/audit/roster tests, the full `tests/*.test.mjs` suite, and `git diff --check`.
2. Verify migrations 009–011, audit triggers, RLS, private authorization helpers, and production release setting shape without altering schema.
3. Publish the exact authorized commit through the authenticated preview workflow and record the Pages run, commit, and asset identity.
4. Run Data Health before mutation. Require zero failures in synchronization integrity, release/cap consistency, season context, identity, team mapping, manual-override protection, RLS, and protected-write diagnostics.
5. Fetch a new `Current` preview only. Require observed league ID, season year, and league-history ID to match the reviewed context.
6. Capture the preview fetch timestamp plus a deterministic hash of the exact normalized preview inputs used by the selected manifest. Any refresh, league/configuration/period/mapping/season/release change invalidates selection and acknowledgement.
7. Capture deterministic pre-write counts and hashes for all protected fields and audit-history counts. Record the exact 4–5 candidate manifest before release activation.
8. Enable the exact reviewed league-scoped `V5.4.6E_OPT_IN_10` setting only after all earlier gates pass. Refresh league data and preview, then reselect and re-review the exact candidates if activation invalidates state.
9. Require explicit review acknowledgement and the separate final confirmation showing release tier, effective cap, exact selected names, manifest digest, and status-only scope.

## Authorized Write Boundary

- Exactly one new manifest-v2 attempt containing 4 or 5 rows.
- Only `roster_status`, `roster_status_source = 'FANTRAX'`, and the established update timestamp may change.
- Immediately before each grouped persistence call, repeat active-league, release signature, fresh-preview hash/timestamp, matching season context, Current period, exact player/team identity, expected owner, previewed current status, allowed target status, and non-manual provenance guards.
- Do not continue to a second batch. Any partial, failed, unexpected skipped, stale, ambiguous, or guard-rejected result stops the run and preserves the durable evidence for inspection.

## Protected-Field Snapshot

Before and after the attempt, compare row counts and deterministic hashes or exact projections covering:

- player UUID and league UUID;
- owner team and free-agent state;
- Fantrax ID, MLBAM ID, name, normalized name, MLB organization, and positions;
- HKB value, ranks, asset class, notes, and other non-status player attributes;
- manual-override actor and timestamp;
- team UUID, league UUID, Fantrax team ID, name, abbreviation, and manager assignment;
- every calculated score row and score-bearing value;
- every player metric row and metric payload;
- pre-existing Fantrax audit attempts/items and their immutable manifest/lifecycle fields.

For selected players, the only permitted differences are the reviewed target `roster_status`, `roster_status_source` changing to `FANTRAX`, and the expected update timestamp. Any other difference fails acceptance.

## Post-Write Acceptance Gates

1. Verify one database-stamped actor, one immutable manifest-v2 digest, release `V5.4.6E_OPT_IN_10`, cap 10, exact reviewed count 4 or 5, and exact item ordinals/identities/statuses.
2. Require every selected item to be `APPLIED` with no skipped, failed, pending, or missing item. Require the attempt lifecycle and timestamps to be internally consistent.
3. Refresh league data and fetch another fresh Current preview. Confirm selected rows now produce `NO_CHANGE`, season context still matches, and no unselected roster row changed.
4. Compare all protected pre/post snapshots. Require exact equality outside the permitted status provenance/timestamp fields.
5. Run Data Health and the audit UI. Require accurate release, cap, terminal/recoverable counts, digest, actor/lifecycle information, and no new failure.
6. Submit the same exact manifest/digest once as an idempotency replay check. It must resolve to the existing attempt and perform zero player writes; terminal rows must remain non-replayable.
7. Inspect recovery state after replay. Require zero recoverable rows for a fully successful attempt. Do not inject a production failure merely to manufacture recovery evidence.
8. Disable the expanded opt-in immediately after verification. Confirm new expanded attempts are blocked while the exact durable attempt remains inspectable.
9. Restore GitHub Pages to `main`, verify restoration succeeds, rerun focused tests, the full suite, and `git diff --check`, then record all evidence.

## Rollback And Recovery Plan

- Operational stop: disable the league opt-in first. This blocks new expanded attempts without deleting audit evidence.
- Do not delete or rewrite attempt/item rows, alter digests, or manually mark outcomes.
- If no player write occurred, retain the failed/pending attempt for diagnosis and use the exact-manifest recovery path only after architect approval.
- If a subset applied, do not issue compensating roster writes automatically. Preserve terminal `APPLIED`/`SKIPPED` rows, inspect `FAILED`/`PENDING` rows and all repeated guards, and request architect direction before exact-manifest recovery.
- Recovery may address only the original failed/pending rows, with the original digest and selected set, after a fresh matching Current preview proves owner/status/identity/manual/season/release guards. It may never broaden or replace the manifest.
- Any protected-field difference, authorization contradiction, cross-league visibility, audit inconsistency, or uncertain outcome is an immediate stop. Preserve evidence; do not retry or clean up destructively.

## Explicitly Prohibited

- Selecting 6–10 players, a second batch, Select All, background/automatic retries, or a full eligible-set synchronization.
- Release candidates, unknown statuses, manual overrides, ownership conflicts, free-agent or ownership changes, fuzzy/name/MLBAM fallback, unmapped teams, or ambiguous identities.
- Imports, player/team creation, identity repair, ownership repair, score recalculation, HKB/metric writes, manager changes, migration/schema changes, audit deletion, or unrelated cloud writes.
- Merging into `main` without completed acceptance and architect review.

## Definition Of Done

Gate 3 is accepted only when one exact 4–5 player status-only manifest completes with all items applied, replay performs zero writes, recovery inspection is clean, the refreshed Current preview reports no remaining differences for the selected rows, every protected comparison matches, Data Health and audit rendering are accurate, the opt-in is disabled, Pages is restored to `main`, automated validation passes, and architect review approves the evidence. A successful Gate 3 does not authorize ten players or any later batch.
