# Next Task: V5.4.6D Durable Fantrax Synchronization Audit And Recovery Boundary

## Status And Baseline

- Status: authorized for design and implementation only after architect review of this phase definition.
- Branch baseline: `feature/manager-intelligence` at `26d6b02299b2e3e35b427532c5ba6c28281329e4`.
- V5.4.6C season-rollover safety is merged, tested, and authenticated-deployment accepted.
- This phase must not merge into `main` or authorize broad roster synchronization by itself.

## Objective

Create a durable, league-scoped audit and recovery boundary for reviewed Fantrax roster-status synchronization attempts. Every attempt must record the exact reviewed manifest and season context, the acting authenticated user, lifecycle state, grouped write outcomes, classified skips, failures, and completion time so an interrupted or partial operation can be inspected and safely reconciled without replaying successful writes.

## Why This Phase Is Next

The guarded V5.4.6B apply path has controlled production acceptance for one exact three-player subset, and V5.4.6C now prevents cross-season misuse. Broader production use remains unauthorized. The current UI retains only the latest apply result in browser session state; there is no durable operation record, idempotency key, or recovery view for partial and interrupted attempts. Expanding synchronization before that boundary would make support, review, and safe retry weaker precisely when the write set becomes larger.

## Authorized Scope

1. Design a minimal Supabase schema for immutable synchronization-attempt identity and append-only or otherwise tamper-resistant per-row outcomes.
2. Scope every attempt and outcome to the active league and reviewed Fantrax season context.
3. Generate a deterministic manifest digest from the exact reviewed player UUID, expected owner, previewed status, target status, and relevant external identity fields.
4. Require an authenticated actor and database-controlled timestamps; browser input must not spoof audit identity.
5. Record attempt lifecycle states that distinguish prepared, applying, completed, partially completed, and failed/interrupted outcomes.
6. Make retries replay-safe: previously successful rows must not be written again, and every remaining row must still pass the current season, period, identity, owner, status, and manual-override guards immediately before persistence.
7. Add a read-only V5 audit/recovery view and Data Health diagnostics for incomplete or inconsistent attempts.
8. Add focused migration, repository, service, UI, RLS, idempotency, partial-failure, and recovery tests.
9. Perform controlled authenticated acceptance with a deliberately bounded manifest only after migration review and explicit authorization.

## Required Safety Invariants

- Current-period-only synchronization remains mandatory.
- The reviewed and observed Fantrax season contexts must match at preparation, immediately before each write group, and during recovery.
- Exact Fantrax player and team identity remains mandatory; names and fuzzy matching are prohibited.
- Manual overrides, owner changes, status changes, unmatched identities, ownership conflicts, and unclassified Fantrax statuses remain excluded or classified for review.
- Write payloads remain limited to roster status, Fantrax provenance, and the established update timestamp. Ownership, free-agent state, UUIDs, external identities, scores, HKB values, metrics, managers, and team identity are never synchronization payload fields.
- Audit records must be league-scoped under RLS and must not contain credentials, sessions, cookies, private keys, or Supabase service-role keys.
- Preview and Data Health remain read-only.
- No automatic ownership repair, player/team creation, import, score recalculation, or unrelated cloud write is permitted.
- The approved mapping-first/settings-second season-review sequence remains unchanged.

## Required Design Decisions Before Migration

1. Define attempt and row-outcome tables, keys, constraints, lifecycle transitions, retention, and rollback.
2. Define the deterministic manifest serialization and digest version.
3. Define which transitions are database-enforced and how authenticated actor identity is stamped.
4. Define recovery semantics for browser closure, network failure, partial group success, stale season context, and a newly created manual override.
5. Prove that replay cannot broaden the originally reviewed UUID set or bypass any write-time guard.
6. Decide how an operator explicitly abandons an incomplete attempt without deleting its evidence.

## Required Validation

- Migration and RLS tests.
- Manifest determinism and tamper-detection tests.
- Duplicate-attempt and duplicate-row idempotency tests.
- Interrupted and partial-group recovery tests.
- Current-period, season-context, exact-identity, expected-owner, previewed-status, and manual-override regression tests.
- Data Health and audit-view rendering tests.
- Focused auth tests and every `tests/*.test.mjs` file.
- `git diff --check`.
- Authenticated acceptance must prove bounded success, deliberate partial/interrupted recovery, replay safety, newly protected-row skipping, durable results after reload, and unchanged protected-field hashes.

## Dependencies

- ADR-015 team identity and the persisted 10-of-10 mappings.
- ADR-016 database-stamped manual-override provenance.
- ADR-017 exact reviewed-set and write-time roster-status guards.
- ADR-018 reviewed Fantrax season-context matching and rollover remapping.
- The deployed `fantrax-public-league-preview` Edge Function and current-period guard.
- Existing league membership/RLS boundaries and authenticated user identity.
- Explicit approval before creating or applying a migration and before any controlled production write.

## Explicitly Out Of Scope

- Applying the remaining broad eligible roster-status set.
- Increasing or removing the existing three-player controlled-selection limit.
- Ownership synchronization or repair.
- Player, team, manager, score, metric, HKB, or free-agent writes.
- Fantrax credentials, cookies, Selenium, Python, or undocumented authenticated endpoints.
- Reworking the V5.4.6C season-review save ordering.

## Definition Of Done

A reviewed migration and application boundary durably records every bounded Fantrax roster-status attempt and per-row outcome, interrupted or partial attempts are recoverable without duplicate writes, all existing guards are repeated during recovery, authenticated acceptance and the full automated suite pass, and protected data remains unchanged. Completion does not authorize broader synchronization or a merge into `main`.
