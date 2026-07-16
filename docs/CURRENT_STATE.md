# Current State

Generated: 2026-07-16 America/Chicago.

## Git State

- Active branch: `fix/reliable-repeat-import`
- Current HEAD: `acee731`
- Current HEAD subject: `Fix Fantrax MLBAM persistence serialization`
- Tags pointing at current HEAD: `v4-fantrax-import-success`
- Most recent known-good tag or commit, provable from Git metadata only: `v4-fantrax-import-success` at `acee731`. This tag name is evidence of intent, not proof that all workflows currently pass.

## Working Tree Status

Uncommitted changes present before this memory task:

- Fantrax preview UI restoration:
  - `index.html`
  - `js/services/authUi.js`
  - `tests/fantraxPreviewUi.test.mjs`
- Paginated cloud player preload and actionable Fantrax error reporting from prior work:
  - `js/services/cloudStore.js`
  - `tests/cloudStorePagination.test.mjs`
  - `tests/fantraxImportPipeline.test.mjs`

Uncommitted documentation created by this task:

- `AGENTS.md`
- `docs/PROJECT_MEMORY.md`
- `docs/CURRENT_STATE.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/WORKFLOW.md`
- `js/services/AGENTS.md`

## Verified By Repository Evidence

- The repository contains a standalone `PlayerIdentityResolver` with tests for update, insert, conflict, unmatched, Fantrax priority, MLBAM fallback, fallback ambiguity, missing identity, and zero-like MLBAM handling.
- The Fantrax import pipeline source uses `PlayerIdentityResolver` and `InMemoryPlayerIdentityRepository` for Fantrax classification.
- The Fantrax preview source path exists and is scoped separately from Fantrax import.
- Tests assert Fantrax preview does not call player persistence helpers or import-job creation within the `previewFantrax` scoped body.
- Tests assert the Fantrax UI contains a Preview button, review checkbox, disabled Upload button, file-change invalidation, and no old one-click `Import Fantrax Players` label.
- Tests assert `serializeMlbamId` serializes missing and invalid MLBAM values to `null`.
- Tests assert `getPlayers` uses deterministic range pagination and reports range-specific preload failures.

Evidence: `tests/PlayerIdentityResolver.test.mjs`, `tests/fantraxImportPipeline.test.mjs`, `tests/fantraxPreviewUi.test.mjs`, `tests/cloudStoreSerialization.test.mjs`, `tests/cloudStorePagination.test.mjs`.

## Incomplete Or Operationally Unproven

- Current database contents were not inspected for this memory task.
- No live browser validation was performed for this memory task.
- No production or development import was run for this memory task.
- No migration was applied for this memory task.
- Repeat Fantrax import success is not proven by current command evidence in this task.
- The current working tree contains uncommitted app-code changes, so HEAD alone does not represent the full working application state.

## Known Current Failures

- None verified during this memory task.

## Needs Verification

- Whether the active Supabase database has applied `supabase/migrations/006_player_external_identity.sql`.
- Whether the runtime database currently has `players.fantrax_id`.
- Whether the runtime database has non-unique `league_id, normalized_name` lookup behavior after migrations.
- Whether a repeated Fantrax upload against the selected cloud league updates existing players without duplicate-key failures.
- Whether the restored Fantrax preview UI works in a browser session with real files and a signed-in Supabase user.
- Whether temporary diagnostic strings in current import or resolver code should remain.

## Next Single Recommended Validation Step

Run the focused Node tests for the current uncommitted work:

```powershell
& 'C:\Program Files\nodejs\node.exe' tests/fantraxPreviewUi.test.mjs
& 'C:\Program Files\nodejs\node.exe' tests/fantraxImportPipeline.test.mjs
& 'C:\Program Files\nodejs\node.exe' tests/cloudStorePagination.test.mjs
& 'C:\Program Files\nodejs\node.exe' tests/cloudStoreSerialization.test.mjs
```
