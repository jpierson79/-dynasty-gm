# Next Task: V5.4.6E Gate 4D Deterministic Acceptance Harness for Maximum Sync

## Status And Authority

- Status: implementation plan for a separate architect-reviewed task. This checkpoint is planning-only and does **not** authorize implementation, deployment, migration, Supabase writes, release-setting changes, preview acquisition, audit creation, roster synchronization, imports, ownership or identity changes, or score recalculation.
- Baseline: `feature/manager-intelligence` after the Gate 4D planning commit. Preserve the accepted migrations 009-011, Gate 4A audit visibility, Gate 4C authentication/shared-state repairs, Gate 4B hosted audit acceptance, Gate 3 production acceptance, and all historical Gate 4 stop evidence.
- Gate 4 remains unaccepted. A later execution task may authorize exactly one 10-player batch only after the harness itself is implemented, tested, hosted-accepted read-only, and separately approved for persistence.
- `docs/WORKFLOW.md` Rule 20 remains authoritative: 1-3 is the default; an expanded batch requires explicit, gate-specific architect approval and every accepted safeguard. No authority carries forward automatically.

## Objective

Implement a deterministic, production-safe Gate 4 acceptance harness that replaces fragile click-by-click orchestration with explicit, inspectable checkpoints while using the same authenticated V5 production services, repositories, Supabase client, RLS, triggers, and database constraints as the normal UI. The harness is orchestration and evidence collection only. It must not create a second business-logic path or weaken any existing guard.

The harness must allow a human to review the exact ten candidates, Preview B manifest-v2 digest, protected-field summary, and every readiness result before one separately authorized persistence call. Implementation and read-only hosted acceptance of the harness do not themselves authorize that call.

## Architecture Contract

### Hosted Surface And Authentication

1. Add a narrowly scoped Gate 4 acceptance surface inside the hosted V5 module graph, reachable only through an explicit acceptance-mode entry selected by the approved artifact. It must use the canonical Supabase singleton and canonical `appState` module instance already used by authentication, league loading, repositories, and UI rendering.
2. Obtain identity only from the normal hosted V5 authentication flow. Never accept a user ID, JWT, refresh token, cookie, localStorage dump, service key, or session object as harness input. Never copy credentials between origins.
3. Require the authenticated user, active league UUID, and loaded league membership to remain unchanged at every checkpoint. The active league must be Reddit Phanatics UUID `6573ac24-f433-48c7-a834-ffe6b58726bc`; a different or missing league fails closed.
4. Use only normal authenticated repository calls subject to production RLS and database actor stamping. No service-role client, direct privileged database connection, public authorization wrapper, RLS bypass, or alternate origin is permitted.

### Reuse, Not Duplication

5. Reuse `fantraxPublicPreviewService.js` for Preview A, Preview B, normalization, exact player identity, exact persisted team identity, and preview comparison.
6. Reuse `fantraxSeasonContextService.js` for reviewed/observed context comparison and the immediate season write guard.
7. Reuse `fantraxRosterSyncService.js` for release policy/signature, Current-period guard, exact controlled selection, candidate validation, status normalization, exclusions, and result summaries.
8. Reuse `fantraxSyncAuditService.js` and `fantraxSyncAuditRepository.js` for canonical manifest-v2 construction, deterministic serialization/digest, durable attempt preparation, immutable item validation, lifecycle outcomes, replay prevention, and audit reads.
9. Reuse the canonical player/league/team repositories and the existing guarded roster-status persistence repository. Do not issue raw status updates or recreate grouped-write predicates in the harness.
10. Move any orchestration currently embedded only in `v5/js/main.js` that is needed by both the normal UI and harness into one shared production coordinator. Both callers must invoke that same coordinator. Do not copy or fork the apply sequence.
11. Acceptance-only code may format checkpoint evidence and compute deterministic read-only projections/hashes. It may not decide eligibility, identity, release policy, manifest content, recovery, or write predicates independently.

## Deterministic Checkpoint Model

Each checkpoint produces a frozen, serializable evidence object with checkpoint version, artifact commit, authenticated user UUID, active league UUID, release signature, timestamp, prerequisite checkpoint digests, result status, and explicit failure reasons. A checkpoint is `PASS`, `FAIL`, or `UNAVAILABLE`; missing/error data is never zero or pass. Later checkpoints accept only the exact digest of their immediate prerequisites.

The harness must expose these checkpoints in order:

1. **Artifact and authenticated user**: exact hosted commit, canonical module graph, authenticated user, one shared state instance, and no auth/loading error.
2. **Active league and audit baseline**: exact Reddit Phanatics UUID, membership/RLS access, durable audit availability, exact attempt/item counts and IDs, lifecycle/recovery summary, and no unavailable-to-zero collapse.
3. **Gate A readiness**: authoritative team identity availability, audit/recovery readiness, manual-override protection, deployed release/cap boundary, Current-only capability, application health, and all non-preview-dependent Data Health checks. Preview-dependent season review may be `UNAVAILABLE` but cannot authorize a write.
4. **Preview A**: one fresh read-only Current preview from the production preview service, with fetched timestamp, normalized-input hash, returned period, external league ID, season year, history identity, endpoint/schema results, and release signature at fetch.
5. **Gate B A and exact candidate review**: canonical season/period guards, exact identity/team coverage, known statuses, no release/removal, no ownership conflict, no manual override, and exactly ten explicitly supplied UUIDs. Candidate selection is never automatic and never substitutes another player. Jared Jones or any other ambiguous name is rejected unless the stable authoritative identity independently resolves the exact UUID.
6. **Protected baseline**: deterministic counts, exact selected-player projections, and hashes covering all protected player fields, teams, managers/mappings, scores, metrics, imports/HKB data, and pre-existing audit history. Status, source, and timestamp are recorded separately as the only potentially authorized changes.
7. **Expanded opt-in transition**: through the canonical authenticated league-settings repository and RLS, enable only the reviewed `V5.4.6E_OPT_IN_10` setting for the exact league. This is a separately armed mutation. It immediately invalidates Preview A and every downstream acknowledgement. It cannot create a manifest or audit attempt.
8. **Preview B**: a new fresh Current preview after opt-in, with a different checkpoint identity and its own timestamp/hash. Preview B is the only write-eligible preview.
9. **Repeated Gate B B**: rerun every season, period, league, release, player/team identity, owner, status, manual-provenance, conflict, exclusion, and stale-preview guard. Require the same exact ten UUIDs and the same bound candidate fields as the reviewed set. Any difference stops; no substitution or partial continuation is allowed.
10. **Manifest review**: use the canonical audit service to construct and serialize manifest version 2 from Preview B only. Display the complete ordered rows 0-9, release tier, cap 10, reviewed count 10, season context, Current period, Preview B identity, and digest. Prove 11 rows are rejected by application/service/repository/database design without creating an attempt.
11. **Human approval pause**: render a stable review artifact containing candidate names and UUIDs, Fantrax IDs, persisted Fantrax team IDs, expected owners, current/target statuses, override state, manifest digest, protected hashes, audit baseline, and all checkpoint digests. Require an explicit exact-digest acknowledgement. Closing, refreshing, changing input, changing selection, or recomputing any prerequisite invalidates approval.
12. **Immediate pre-write guards**: immediately before any attempt creation, refresh the necessary authenticated rows and repeat active user/league, release signature, Preview B freshness, season/current period, exact ten UUIDs, identities, owners, statuses, targets, manual provenance, candidate set, manifest serialization/digest, and protected baseline preconditions. Any mismatch stops before persistence.
13. **One authorized sync call**: expose exactly one call into the shared production coordinator. The harness must have no loop, automatic retry, smaller fallback batch, split operation, or second-call affordance. This checkpoint remains disabled unless a later NEXT_TASK explicitly authorizes Gate 4 persistence.
14. **Audit outcomes**: load the attempt and items through the canonical audit repository; require one manifest-v2 attempt, ten ordered items, database actor stamping, exact digest/release/cap, ten terminal `APPLIED` outcomes, `COMPLETED`, terminal count 10, and recoverable count 0.
15. **Protected comparison**: recapture the same projections/counts/hashes and require equality outside the reviewed roster-status, `FANTRAX` provenance, and expected update timestamp fields. Require exactly the ten selected rows and no unselected row to have changed.
16. **Replay/idempotency**: use the canonical lookup/coordinator path with the same exact digest to prove duplicate-manifest resolution performs zero player writes and creates no second attempt/items. Verify terminal items cannot replay. Do not manufacture a failure or recover unrelated history.
17. **Opt-in disablement**: after success, failure, cancellation, timeout, or uncertain state, disable the expanded opt-in through the canonical authenticated settings repository as the first safe cleanup action. Verify it is false and new expanded attempts are blocked while the completed attempt remains readable.
18. **Final evidence**: post-write Current preview agreement, Data Health, audit UI model, console diagnostics, focused/full tests, Pages restoration, and a machine-readable plus human-readable acceptance report.

## Human Review And Arming Boundary

- Separate read-only preparation from mutation with an explicit `PREPARED_FOR_HUMAN_REVIEW` state. The harness may progress through Preview B, repeated Gate B, manifest digest, and protected summary without creating an audit attempt.
- The write control remains absent or disabled during implementation and read-only hosted acceptance. A later architect-approved execution task must provide the exact artifact commit, exact ten UUIDs or reviewed report digest, and one-call authority.
- Human acknowledgement binds the artifact commit, authenticated user, league, Preview B hash/timestamp, release signature, exact ordered candidate rows, manifest serialization/digest, protected baseline digest, and checkpoint-chain digest.
- The harness must show the candidate list, digest, and protected-field summary without requiring navigation across multiple views. Browser UI remains a secondary visual confirmation layer for authentication, league selection, Data Health/audit rendering, and clean console; it is not the primary source of orchestration truth.

## Fail-Closed Stop Conditions

Stop before persistence on any of the following:

- missing/changed authenticated user, league, membership, artifact, canonical module identity, RLS access, or audit availability;
- any unavailable, permission-blocked, failed, timed-out, malformed, incomplete, or stale checkpoint;
- non-Current or changed period; external league, season, history, or reviewed-context mismatch;
- Preview A reused after opt-in, Preview B missing/stale, or configuration/release/league/input change after Preview B;
- candidate count other than exactly 10, an attempted 11th row, evidence of a larger intended operation, split-batch intent, automatic substitution, duplicate UUID, or unordered/mismatched manifest row;
- fuzzy/name/MLBAM fallback, ambiguous identity, missing/mismatched persisted team identity, ownership difference, free agent, release/removal, unknown or `UNCLASSIFIED` source status, manual override/provenance, or changed current/target status;
- manifest version other than 2, cap other than 10, wrong release tier, digest mismatch, request/manifest mismatch, existing incompatible attempt, terminal replay, or database boundary contradiction;
- any protected-field baseline mismatch before write or protected-field difference after write;
- any unexpected skip, failure, pending/recoverable item, partial attempt, actor mismatch, duplicate attempt/item, or repository error;
- failure to disable opt-in or restore temporary hosted configuration.

No stop condition permits improvisation, candidate replacement, smaller fallback, automatic retry, compensation, audit deletion, or a second batch.

## Security And Persistence Boundaries

- Keep SECURITY INVOKER behavior, reviewed search paths, private authorization helpers, RLS, actor stamping, immutable manifests, lifecycle transitions, replay constraints, cross-league isolation, default cap 3, and expanded cap 10 unchanged.
- The harness must never write player ownership, free-agent state, UUIDs, Fantrax/MLBAM identity, names, teams, managers, manual overrides, HKB/import fields, metrics, or scores.
- The only future authorized player payload remains `roster_status`, `roster_status_source = 'FANTRAX'`, and the established update timestamp through the existing guarded repository.
- Do not add a migration unless implementation proves a missing database invariant. Any such contradiction stops Gate 4D and requires a separate architect task; the harness plan assumes migrations 009-011 remain sufficient.
- Do not persist auth material or sensitive checkpoint data. Reports may include UUIDs, non-secret manifest metadata, counts, hashes, and status evidence, but never tokens, cookies, keys, passwords, or session storage.

## Implementation And Regression Plan

1. Identify the smallest shared coordinator boundary that removes apply orchestration duplication from `v5/js/main.js` without changing behavior.
2. Implement the acceptance checkpoint state machine and deterministic evidence serializer as a thin caller of canonical modules.
3. Implement a compact hosted review surface showing checkpoint status, exact candidates, manifest digest, protected summary, and the explicit human pause. Keep persistence disabled until a separate task authorizes execution acceptance.
4. Add dependency-injected tests proving the harness calls the canonical services/repositories and cannot replace them with raw Supabase writes or alternate identity logic.
5. Add regression coverage for every checkpoint transition/invalidation, unavailable versus zero, canonical state/auth identity, exact league scoping, two-preview opt-in invalidation, exact ten rows, 11th rejection, no substitution, no releases/overrides/unknown statuses, period/season drift, stale Preview B, manifest-v2/digest binding, protected snapshots, one-call latch, replay rejection, cleanup, and report redaction.
6. Prove the normal V5 UI and harness both call the same shared coordinator and guarded repositories. Existing Fantrax, season-context, audit, roster-sync, roster-manager, Data Health, auth, and configuration tests must remain unchanged in intent and pass.
7. Run focused Gate 4D tests and the complete sorted `tests/*.test.mjs` suite, then `git diff --check`.
8. Publish an exact implementation commit only for read-only hosted acceptance. Verify normal authentication, Reddit Phanatics selection, Gate A, Preview A, candidate review, protected baseline, and report rendering without changing production data. Exercise the opt-in transition, Preview B, manifest review, one-call latch, and cleanup deterministically with injected repository fixtures in tests; the hosted run must stop before the real transition unless a later NEXT_TASK separately authorizes that specific production setting change. Create no attempt and restore Pages to main.
9. Stop for architect review. Do not execute Gate 4's ten-player write in the implementation or read-only hosted-acceptance task.

## Explicitly Prohibited

- Implementing or executing synchronization during this planning checkpoint.
- A CLI or script that accepts copied tokens, cookies, service keys, database credentials, user IDs, or untrusted candidate names.
- Raw Supabase status updates, direct audit inserts, direct lifecycle manipulation, alternate manifest/digest code, alternate preview fetches, or duplicated eligibility/write predicates.
- Automatic candidate discovery/substitution, Select All, more than 10 players, 1-9 fallback, split batches, retries, releases, ownership or identity repair, imports, migrations, score recalculation, or unrelated cloud writes.
- Treating browser UI as the authoritative checkpoint state or treating the harness as authority for routine synchronization.

## Definition Of Done For Gate 4D

Gate 4D implementation is complete only when the deterministic harness demonstrably reuses the canonical authenticated production paths, exposes every required checkpoint and human-review artifact, fails closed on every enumerated contradiction, cannot call persistence more than once, contains no alternate sync/identity/audit implementation, passes focused and full tests, completes read-only hosted acceptance, restores Pages to main, and stops for architect review. Completion of Gate 4D does not accept Gate 4 and does not authorize the ten-player synchronization.
