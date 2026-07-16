# Architecture Decisions

## ADR-001: Keep `players.id` As Permanent Internal Identity

Status: accepted.

Context: Player-related records include metrics, scores, preferences, trades, snapshots, notes, manager intelligence, and roster history. External source IDs can change or be absent.

Decision: `public.players.id` remains the permanent internal UUID. External IDs do not replace it.

Consequences: Updates must preserve UUIDs. Related records must reference internal UUIDs, not Fantrax or MLBAM IDs.

Evidence paths: `supabase/migrations/001_initial_schema.sql`, `docs/cloud-player-identity.md`, `tests/PlayerIdentityResolver.test.mjs`.

## ADR-002: Prefer Fantrax ID, Then MLBAM ID

Status: accepted.

Context: Fantrax is the canonical player-pool and roster source. The user supplied that Fantrax `ID` has been manually verified as stable across multiple exports.

Decision: Fantrax imports prefer `league_id + fantrax_id`; MLBAM is secondary.

Consequences: Fantrax `ID` maps to `fantrax_id` as trimmed text. Generic `ID` must not populate `mlbam_id`.

Evidence paths: user-supplied facts, `docs/cloud-player-identity.md`, `js/services/cloudCsvImportService.js`, `tests/PlayerIdentityResolver.test.mjs`.

## ADR-003: Normalized Names Are Not Unique Identity

Status: accepted.

Context: Names can collide, vary by accents/punctuation/suffixes, or change. The initial schema had `unique (league_id, normalized_name)`, but the identity migration removes that constraint.

Decision: `normalized_name` is search and cautious fallback metadata only.

Consequences: The final migrated database should have a non-unique lookup index on `league_id, normalized_name`, not a uniqueness constraint.

Evidence paths: `supabase/migrations/001_initial_schema.sql`, `supabase/migrations/006_player_external_identity.sql`, `docs/cloud-player-identity.md`.

## ADR-004: Restrict Fallback Eligibility

Status: accepted.

Context: Fallback matching can preserve data when stable IDs are absent, but can corrupt identity when stable IDs are present but nonmatching.

Decision: Fallback is permitted only when both Fantrax ID and MLBAM ID are absent. It requires normalized name, team or organization, and overlapping position. Ambiguity returns unmatched or conflict rather than a guessed update.

Consequences: A row with a populated nonmatching stable ID must not be reinterpreted through fallback.

Evidence paths: user-supplied facts, `tests/PlayerIdentityResolver.test.mjs`, `js/services/PlayerIdentityResolver.js`.

## ADR-005: Persist Missing MLBAM As NULL

Status: accepted.

Context: Serializing missing MLBAM as `0` causes uniqueness collisions under `league_id + mlbam_id`.

Decision: Missing, zero-like, invalid, non-integer, negative, and unsafe MLBAM values serialize as `null`.

Consequences: Persistence sanitization must use MLBAM serialization before player writes.

Evidence paths: `js/services/cloudStore.js`, `js/services/cloudCsvImportService.js`, `tests/cloudStoreSerialization.test.mjs`.

## ADR-006: Require Preview Before Fantrax Upload

Status: accepted.

Context: Fantrax imports are high-impact player-pool changes. The user requires review and data preservation over automatic action.

Decision: Fantrax upload requires a successful preview and explicit review confirmation. Changing the file invalidates the preview.

Consequences: The UI must not expose a direct one-click Fantrax upload path.

Evidence paths: user-supplied facts, `index.html`, `js/services/authUi.js`, `tests/fantraxPreviewUi.test.mjs`.

## ADR-007: Paginate Cloud Player Preload

Status: accepted.

Context: A single PostgREST request can be truncated by row limits and make the identity resolver miss existing players.

Decision: `cloudStore.getPlayers` loads league players through deterministic `id` ordering and Supabase `.range(from, to)` pagination.

Consequences: Fantrax preview/import should build the in-memory identity repository from the full paginated preload.

Evidence paths: `js/services/cloudStore.js`, `tests/cloudStorePagination.test.mjs`, `tests/fantraxImportPipeline.test.mjs`.

## ADR-008: Use Batched Persistence For Fantrax Player Writes

Status: accepted.

Context: Per-player writes and duplicate update IDs cause performance and correctness problems.

Decision: Fantrax import classifies rows in memory, collapses safe duplicate updates, reports unsafe conflicts, and writes updates/inserts through batch persistence.

Consequences: Update batches must not contain duplicate internal IDs. Conflicting rows are not silently selected or merged.

Evidence paths: `js/services/cloudCsvImportService.js`, `js/services/cloudStore.js`, `tests/fantraxImportPipeline.test.mjs`.

## ADR-009: No Automatic Identity Merges

Status: accepted.

Context: Automatic deletion or merging can destroy accumulated notes, intelligence, valuations, and history.

Decision: Duplicate or conflicting identities are reported; no player rows are deleted or merged automatically to repair identity conflicts.

Consequences: Duplicate repair is a manual or explicitly requested process.

Evidence paths: user-supplied facts, `supabase/migrations/006_player_external_identity.sql`, `docs/cloud-player-identity.md`, `tests/PlayerIdentityResolver.test.mjs`.
