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

## ADR-010: Distinguish Fantrax CSV And API Player-ID Representations

Status: accepted.

Context: `getTeamRosters.rosterItems[].id` initially appeared not to match `players.fantrax_id`. Read-only diagnostics proved that every stored CSV ID has one leading and trailing ASCII asterisk, while Fantrax API endpoints use the unwrapped inner value. All 566 current roster IDs joined after this strict transformation.

Decision: Preserve `players.fantrax_id` exactly as the trimmed CSV identity. A future `players.fantrax_api_player_id` may store the validated unwrapped identity. Unwrapping must require exactly one leading and trailing `*`, preserve the inner value, and validate it through `getPlayerIds`.

Consequences: Do not strip arbitrary punctuation. Do not use name matching, fuzzy matching, or MLBAM fallback for the Fantrax API join. `rosterItems[].id` is a player identity, so no separate roster-item ID column is needed. The 36 stored IDs absent from the current global catalog remain an explicit unresolved diagnostic.

Evidence paths: verified V5.4.3A read-only identity diagnostics, `docs/PROJECT_MEMORY.md`.

## ADR-011: Keep Ownership And Roster Status Independent

Status: accepted.

Context: Fantrax CSV ownership is authoritative but does not distinguish active, reserve, injured-reserve, and minors placement. The roster API provides explicit status values independently from application ownership.

Decision: Normalize only exact observed values: `ACTIVE`, `RESERVE`, `INJURED_RESERVE` to `IL`, and `MINORS`; every other value becomes `UNCLASSIFIED`.

Consequences: Missing or unknown API status never makes a player a free agent. Roster-status synchronization must preserve `owner_team_id` and `is_free_agent`. Status must not be inferred from position, age, injury metadata, or prospect classification.

Evidence paths: verified V5.4.3 read-only endpoint diagnostics, `v5/js/domain/rosterStatus.js`.

## ADR-012: Store Fantrax Team And League Identity Explicitly Before Sync

Status: proposed for V5.4.3B; migration not yet approved or created.

Context: Fantrax team IDs matched across all tested league endpoints and periods, but the current `teams` table has no Fantrax team-ID field. The current `leagues` schema also has no structured Fantrax league integration. Cross-season team-ID stability is not proven.

Decision: The proposed foundation adds nullable `teams.fantrax_team_id`, nullable `players.fantrax_api_player_id`, and structured league-integration metadata containing provider, external league ID, external league-history ID, season year, and timestamps.

Consequences: Team assignments require a reviewed one-to-one preview. Name-only automatic team matching is prohibited. Fantrax team IDs are treated as authoritative within a configured league/season, not silently assumed stable across seasons. No `userSecretId` is stored.

Evidence paths: verified V5.4.3A team/league diagnostics, `supabase/migrations/001_initial_schema.sql`.

## ADR-013: Require Read-Only Preview Before Fantrax Roster Writes

Status: accepted as the next-phase boundary; implementation pending.

Context: Player identity is now provable for the current roster, but required player API-ID, team-ID, and league-integration fields do not yet exist.

Decision: V5.4.3B is limited to a reviewed schema migration, strict ID normalization and validation, external-identity backfill preview, league configuration, reviewed team assignment, read-only roster-status preview, Data Health diagnostics, and synthetic tests.

Consequences: V5.4.3B must not write roster statuses or ownership, rewrite free agents, create players or teams, use automatic name matching, run production imports, or apply a remote migration without explicit approval. Production roster synchronization remains unsafe until the identity foundation and reviewed assignments are complete.

Evidence paths: verified V5.4.3A diagnostics and user-approved phase definition.

## ADR-014: Use Public REST Through An Edge Function

Status: accepted.

Context: The unofficial Python FantraxAPI wrapper exposed additional scoring objects but required authenticated browser cookies for the configured league. The documented REST endpoints supplied the required league, roster, matchup, standings, and draft preview data without credentials.

Decision: Production-shaped preview reads use the allowlisted `fantrax-public-league-preview` Supabase Edge Function and documented `/fxea/general/` endpoints. Python, FantraxAPI, `/fxpa/req`, Selenium, credentials, and cookies are excluded.

Consequences: The Edge Function enforces operation, timeout, size, HTTP, and JSON checks and returns normalized preview models. Standings are labeled `CURRENT_ONLY`; team matchup scores remain separate from player and Dynasty Intelligence scores. Preview performs no database writes.

Evidence paths: `supabase/functions/fantrax-public-league-preview/index.ts`, `supabase/functions/_shared/fantraxPreviewCore.js`, `tests/v5FantraxPublicPreview.test.mjs`.

## ADR-015: Persist Confirmed Fantrax Team Identity On Teams

Status: accepted, deployed, and live-validated for V5.4.6A.

Context: Application teams already have league-scoped permanent UUIDs and existing RLS. A separate external-team table would duplicate that ownership boundary for a single authoritative provider identity.

Decision: Add nullable `teams.fantrax_team_id` with a league-scoped partial unique index and strict trimmed 16-character alphanumeric validation. Persist only explicit user-confirmed mappings. Team names, manager names, roster similarity, and ownership overlap remain non-authoritative suggestions.

Consequences: The migration has no backfill and preserves every existing team row and relationship. The mapping repository updates only the identity column while constraining updates by active league and team UUID. Ten mappings passed live protected-field and Chrome validation. This establishes team identity only; V5.4.6B roster synchronization remains blocked by absent manual-override protection. Rollback requires dropping the unique index before the column.

Evidence paths: `supabase/migrations/007_fantrax_team_identity.sql`, `v5/js/services/fantraxTeamIdentityService.js`, `tests/v5FantraxTeamIdentity.test.mjs`.

## ADR-016: Protect Manual Roster-Status Overrides With Database-Stamped Audit Metadata

Status: accepted and migration deployed; controlled override persistence/clear validated, Data Health and live Fantrax conflict acceptance pending.

Decision: Store narrow provenance and override audit fields on `players`. Manual writes set `MANUAL`, while a database trigger—not browser input—records `auth.uid()` and time. Clearing preserves the current status, changes provenance to `UNKNOWN`, and clears override metadata. Null historic provenance is treated as `LEGACY` in application views without backfill.

Consequences: Future Fantrax synchronization must preserve differing active manual overrides, may recommend applying an explicit Fantrax status only where no override exists, and must route unknown Fantrax values to review. Existing league owner/editor RLS continues to scope updates. This decision does not authorize production synchronization.

Evidence paths: `supabase/migrations/008_manual_roster_status_overrides.sql`, `v5/js/services/rosterStatusManagerService.js`, `v5/js/services/fantraxPublicPreviewService.js`, `tests/v5RosterStatusManager.test.mjs`.
