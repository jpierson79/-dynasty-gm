# Project Memory

This file contains durable project facts only. Do not use prior chat history as source material.

## Project Purpose

Dynasty GM Front Office is a browser-based dynasty baseball command center. Repository evidence shows local browser storage, Supabase cloud services, Fantrax cloud import workflows, HarryKnowsBall value import support, Statcast import support, manager intelligence, trade history, local backup/export, and roster/player analysis views.

Evidence: `README.txt`, `index.html`, `js/app.js`, `js/services/cloudCsvImportService.js`, `js/services/customIntelligenceExport.js`.

## Technology Stack

- Vanilla HTML, CSS, and JavaScript.
- Browser localStorage remains part of the application through the V4 data layer.
- Supabase is used for cloud authentication and cloud database access.
- Supabase JavaScript client is loaded in the browser from ESM CDN sources.
- Tests are Node `.mjs` scripts using `node:assert/strict`.
- Supabase schema is managed through SQL migration files under `supabase/migrations`.

Evidence: `index.html`, `css/styles.css`, `js/data/*.js`, `js/services/supabaseClient.js`, `tests/*.mjs`, `supabase/migrations/*.sql`.

## Domain Requirements

- Fantrax is the canonical player-pool and roster source.
- HarryKnowsBall supplies player value and ranking data.
- Statcast supplies hitter and pitcher metrics.
- Reliability and data preservation take priority over maximizing automatic matches.
- League-specific local settings include Reddit Phanatics defaults for roster limits, lineups, scoring, draft settings, and playoff settings.

Evidence: user-supplied authoritative facts, `js/app.js`, `js/services/cloudCsvImportService.js`, `README.txt`.

## Player Identity Invariants

- `public.players.id` is the permanent internal UUID.
- Related notes, intelligence, valuations, roster data, history, metrics, scores, preferences, trades, and snapshots must remain attached through `players.id`.
- `fantrax_id` is the preferred external identity for Fantrax imports.
- `mlbam_id` is the secondary stable identity.
- `normalized_name` is search and cautious fallback metadata only.
- `normalized_name` must not be unique after the external identity migration is applied.
- Fantrax CSV column `ID` maps to `fantrax_id`, never to `players.id` and never to `mlbam_id`.
- Missing MLBAM IDs must persist as `NULL`, never `0`.
- Fallback identity matching is permitted only when both stable IDs are absent.
- Fallback requires normalized name, team or organization, and overlapping position.
- Ambiguous matches are not guessed.
- Fantrax CSV `ID` values currently stored in `players.fantrax_id` use the verified wrapper format `*API_ID*`.
- The Fantrax API player identity is derived only by requiring exactly one leading ASCII `*` and exactly one trailing ASCII `*`, then preserving the inner value unchanged.
- The CSV/API join must validate the unwrapped value through Fantrax `getPlayerIds`. It must not strip arbitrary punctuation or use name, fuzzy, or MLBAM fallback.
- Fantrax `getTeamRosters.rosterItems[].id` is the Fantrax API player ID, not a separate roster-item identity. No `fantrax_roster_item_id` is needed.

Evidence: user-supplied authoritative facts, `docs/cloud-player-identity.md`, `supabase/migrations/006_player_external_identity.sql`, `js/services/PlayerIdentityResolver.js`, `tests/PlayerIdentityResolver.test.mjs`, `tests/cloudStoreSerialization.test.mjs`, verified V5.4.3A read-only Fantrax diagnostics.

## Fantrax Roster API Facts

- `GET https://www.fantrax.com/fxea/general/getTeamRosters` is reachable with `leagueId` and an optional `period`; no authentication was observed.
- Browser CORS succeeds when credentials are omitted.
- Successful responses may use `text/plain` even though the body is valid JSON.
- Invalid league IDs may return HTTP 200 with `INVALID_LEAGUE_ID`, so callers must inspect the parsed body rather than relying on HTTP status alone.
- The verified response contains a returned period, dynamic Fantrax team-ID keys, team names, and roster items with Fantrax API player ID, position, and raw status.
- Verified raw status mapping is exact: `ACTIVE` to `ACTIVE`, `RESERVE` to `RESERVE`, `INJURED_RESERVE` to `IL`, `MINORS` to `MINORS`, and every other value to `UNCLASSIFIED`.
- Ownership, roster status, player identity, and team identity are separate concepts. Unknown or missing roster status never implies free agency, and an owned player with an unknown status remains owned.
- In the verified current snapshot, all 566 roster API player IDs matched normalized stored Fantrax IDs, all 566 cloud-owned players appeared in the snapshot, and there were no duplicate normalized IDs.
- Of 10,170 stored Fantrax IDs, 10,134 normalized IDs appeared in the global `getPlayerIds` catalog. The remaining 36 historical/catalog misses did not affect the current 566-player roster snapshot.
- Fantrax team IDs were authoritative within the tested league: 10 distinct 16-character alphanumeric IDs matched across `getLeagueInfo`, `getTeamRosters`, `getDraftResults`, `getStandings`, and `getMatchupScores`, including tested current and historical periods.
- Cross-season Fantrax team-ID stability is not proven.
- At the V5.4.3 discovery checkpoint, the production schema had neither an authoritative Fantrax team-ID field nor structured Fantrax league-integration storage; V5.4.6A later added and populated `teams.fantrax_team_id`.
- Production roster synchronization has not been run. The B-2 apply path is local-only pending authenticated acceptance; exact external identities and reviewed one-to-one team assignments remain mandatory.

Evidence: Fantrax v1.3 beta developer documentation, verified V5.4.3/V5.4.3A read-only endpoint and cloud-join diagnostics, `supabase/migrations/001_initial_schema.sql`.

## Fantrax Public Preview Architecture

- The unofficial FantraxAPI Python wrapper is not a production dependency. Its richer `/fxpa/req` scoring methods required an authenticated browser session for the configured league, while the documented REST endpoints remained credential-free.
- Production Fantrax reads use JavaScript/TypeScript through the `fantrax-public-league-preview` Supabase Edge Function. Python, Selenium, Fantrax credentials, browser cookies, arbitrary Fantrax URLs, and `/fxpa/req` are prohibited.
- The approved public operations are league info, team rosters, matchup scores, current standings, draft picks, and draft results.
- `getMatchupScores` is period-specific and represents team matchup scores. Player-level Fantrax fantasy points remain unresolved and must not populate Dynasty Intelligence scores.
- `getStandings` is treated only as `CURRENT_ONLY`; its historical-period semantics remain unverified.
- League scoring snapshots and Dynasty Intelligence scores are separate domains.

Evidence: verified V5.4.5 investigation and `supabase/functions/fantrax-public-league-preview/index.ts`.

## Fantrax Team Identity Foundation

- V5.4.6A stores authoritative Fantrax team identity as nullable text in `teams.fantrax_team_id`; migration 007 was applied and schema-verified in production.
- The identity is unique within a league through a partial unique index on `(league_id, fantrax_team_id)` and must be a trimmed 16-character alphanumeric value.
- Existing team UUIDs, names, manager assignments, ownership, roster status, player identity, and scores are preserved. The migration performs no backfill.
- Team names are suggestions only. A user must review and confirm every mapping, and one Fantrax team cannot map to multiple cloud teams or vice versa.
- Mapping writes are constrained by active league UUID and team UUID and update only `teams.fantrax_team_id`.
- Ten reviewed one-to-one Fantrax team mappings are persisted, with zero duplicate mapping groups. Pre/post hashes proved team UUID, league UUID, team name, manager assignment, player ownership/status/identity, HKB values, calculated scores, and player metrics unchanged.
- At the V5.4.6A checkpoint, the player schema had no reviewed manual roster-status override marker, source, override timestamp, synchronization timestamp, or durable `updated_by` audit field. V5.4.6B-1 subsequently added and deployed the narrow override provenance model.
- V5.4.6A Chrome acceptance verified persisted 10-of-10 team identity, zero unmapped teams, duplicate blocking, resolved roster-team identity, read-only ownership/status differences, responsive controls, no Apply Sync action, no console errors, and accurate Data Health reporting.

Evidence: `supabase/migrations/007_fantrax_team_identity.sql`, `v5/js/services/fantraxTeamIdentityService.js`, `v5/js/repositories/teamRepository.js`.

## Fantrax Identity Graph

## Manual Roster-Status Override Foundation

- V5.4.6B-1 models roster-status provenance on `players` with nullable `roster_status_source`, `roster_status_override_at`, and `roster_status_override_by` fields. Null legacy provenance is presented as `LEGACY`; it is never inferred from the status value.
- A manual save sets source `MANUAL`; a database trigger stamps `auth.uid()` and the current time so browser input cannot spoof audit identity. Existing owner, identity, free-agent, scoring, HKB, and metric fields are outside the write payload.
- Clearing an override preserves `roster_status`, sets source to `UNKNOWN`, and clears override metadata. It only makes the row eligible for a future reviewed sync.
- Fantrax preview recommendations are read-only: `NO_CHANGE`, `APPLY_FANTRAX_STATUS`, `PRESERVE_MANUAL_OVERRIDE`, or `REVIEW_CONFLICT`. No production roster synchronization is implemented by V5.4.6B-1.
- Migration 008 was applied once and schema-verified in production. It added no provenance backfill: all 10,197 existing players initially retained null source and override metadata.
- Controlled Chrome acceptance on Yoshinobu Yamamoto proved authenticated database stamping, persistence after reload, restoration to the original `UNCLASSIFIED` status, and clear-to-`UNKNOWN` with null override metadata. Live Data Health rendering and a configured Fantrax conflict preview remain pending.
- V5.4.6B-2 adds a local reviewed roster-status synchronization path. Only exact `APPLY_FANTRAX_STATUS` recommendations enter the review set; ownership differences are routed to `REVIEW_CONFLICT`; the UI requires review acknowledgement and a separate final confirmation.
- Fantrax status writes are grouped by current and target status, constrained by league and reviewed player UUIDs, require the previewed current status, and exclude `MANUAL` provenance again at write time. The payload changes only `roster_status`, `roster_status_source`, and `updated_at`.
- A successful apply refreshes league data and the Fantrax preview. Rows changed after preview or protected by a new manual override are reported as skipped. Ownership, free-agent state, player identity, scores, HKB values, and metrics are not written.
- V5.4.6B-2/B-3 is implemented, synthetically tested, and controlled-production accepted for an exact three-player status-only subset. No broader roster-status synchronization is authorized.
- Live corrective acceptance proved ownership differences are excluded from the status apply set: 566 exact roster identities produced 560 eligible updates and six `REVIEW_CONFLICT` rows. Three conflicts are cloud free agents and three have a different cloud owner; diagnostics show owner names and never repair ownership automatically.
- V5.4.6B-3 locally adds the expected cloud owner to every reviewed manifest row and requires it again in each grouped write. Skipped rows are classified as manual override, owner changed, status changed, not found/denied, write failure/not attempted, or no row updated; partial outcomes are never reported as full success.
- Data Health exposes a running state, blocks duplicate starts, retains the last successful report on failure, and surfaces a read-only 60-second timeout instead of appearing inert. The optimized path completed authenticated acceptance with zero failures.
- The first authenticated run reached that timeout. Repository inspection found duplicate full-league reads: score diagnostics reloaded players, metrics, and scores, and invalid-team diagnostics reloaded teams. The corrected local implementation reuses the initial rows and runs waiver/roster recommendation diagnostics concurrently.
- The post-correction authenticated run completed and rendered Data Health. Its sole failure was a diagnostic false positive: no Trade Center partner was selected in an otherwise valid idle state. Idle partner selection is now a warning; a missing resolved user team or an explicitly selected invalid partner remains a failure.
- Final read-only acceptance produced zero Data Health failures and reconfirmed the 566/560/6 Fantrax roster baseline with zero identity or team-mapping misses. Before any controlled apply, the protected hashes were recorded as players `e2ef7a71366281dd19d575b465b5cb87`, teams `16bdaf1ec9143a7331e69db87e344ee7`, scores `accc954d5dffaae8c3e13a64b502d69f`, and metrics `44940d299bb920b89563486de9b5dfbd`; player count was 10,197, owned count 565, and manual overrides zero.
- The first controlled-apply review screen could apply only the complete 560-row manifest. Local controlled-subset selection now defaults to empty, enforces a three-player maximum, resets acknowledgement after selection changes, and passes only the revalidated selected UUIDs to the existing status/owner/manual guarded write path.
- Controlled production acceptance applied Kevin McGonigle, Daylen Lile, and Nico Hoerner from `UNCLASSIFIED` to `ACTIVE` at `2026-08-03T20:55:53.031Z`. One guarded group returned 3 reviewed, 3 updated, 0 skipped, and 0 failed groups; the refreshed Fantrax preview dropped from 560 to 557 eligible rows. Post-apply protected hashes exactly matched the pre-apply baseline and Data Health reported zero failures.
- V5.4.6B-4 treats any explicit Fantrax scoring-period selection as historical and blocks roster-status review and apply. Only the `Current` preview, represented by an empty configured period, is eligible; the service guard is enforced in both UI rendering and the final apply handler.
- Live acceptance on historical period 13 showed 489 roster rows and 285 apparent eligible updates, but the review action remained disabled with an explicit warning. No historical status apply was possible.

```text
public.players.id (application UUID)
  -> players.fantrax_id (preserved CSV identity: *API_ID*)
     -> strict wrapper removal
        -> proposed players.fantrax_api_player_id
           -> getPlayerIds key/fantraxId
           -> getLeagueInfo.playerInfo key
           -> getTeamRosters.rosterItems[].id
           -> getDraftResults.playerId

public.players.mlbam_id
  -> independent MLB identity; not a fallback for the Fantrax API join

public.leagues.id (application UUID)
  -> proposed league integration row
     -> Fantrax external league ID
     -> Fantrax leagueHistoryId and seasonYear

public.teams.id (application UUID)
  -> proposed teams.fantrax_team_id
     -> getLeagueInfo/getTeamRosters/getDraftResults/getStandings/getMatchupScores team ID

public.managers.id
  -> current application team assignment only; not a Fantrax identity
```

The graph does not make ownership equivalent to roster status: `owner_team_id` identifies the application owner team, while Fantrax raw status identifies placement within that roster.

## Import Invariants

- Fantrax preview is read-only.
- Fantrax preview must occur before upload.
- Upload requires a successful preview and explicit review confirmation.
- Selecting a different file invalidates the Fantrax preview.
- Existing league players must be preloaded through deterministic pagination.
- Network reads and writes should scale by pages and batches, not individual players.
- Imports preserve existing UUIDs.
- Fantrax inserts and updates are batched through resolved player rows.
- Errors should expose the actual exception message rather than only generic text.
- Partial failures must never be reported as complete success.

Evidence: user-supplied authoritative facts, `js/services/cloudCsvImportService.js`, `js/services/cloudStore.js`, `js/services/authUi.js`, `tests/fantraxImportPipeline.test.mjs`, `tests/fantraxPreviewUi.test.mjs`, `tests/cloudStorePagination.test.mjs`.

## Data Preservation Invariants

- No player row may be automatically deleted or merged to repair identity conflicts.
- Identity conflicts must be surfaced rather than guessed.
- Existing UUIDs and related records are preserved during synchronization.
- Local browser data is not deleted by cloud authentication or migration workflows.
- Custom intelligence export excludes recreatable player pools, raw Statcast data, import progress, credentials, sessions, and raw caches.
- Fantrax roster-status work must not alter ownership, player UUIDs, external IDs, scoring, metrics, or free-agent state.
- Unknown Fantrax roster statuses remain visible and normalize to `UNCLASSIFIED`; they are never guessed from position, age, injury, prospect status, or profile data.

Evidence: user-supplied authoritative facts, `supabase/migrations/006_player_external_identity.sql`, `docs/cloud-player-identity.md`, `js/services/customIntelligenceExport.js`, `js/services/authUi.js`.

## Major Modules

- `js/app.js`: local-first application UI, analysis engines, local import screens, league defaults, and view rendering.
- `js/data/localStore.js`: localStorage adapter and legacy key list.
- `js/data/dataStore.js`: browser data access facade and integrity checks.
- `js/data/migrationService.js`: V4 normalization helpers.
- `js/data/schema.js`: documented V4 entity schemas.
- `js/services/supabaseClient.js`: Supabase browser client initialization and timeout helper.
- `js/services/authService.js`: authentication service wrapper.
- `js/services/authUi.js`: cloud account and cloud import wizard UI wiring.
- `js/services/cloudStore.js`: Supabase data access, player preload, serialization, and batched player persistence.
- `js/services/cloudCsvImportService.js`: cloud CSV parsing, preview, Fantrax import, HKB import, Statcast import, trade import, custom migration, and verification.
- `js/services/PlayerIdentityResolver.js`: standalone player identity resolver.
- `js/services/identity/InMemoryPlayerIdentityRepository.js`: in-memory identity lookup repository for the resolver.
- `js/services/identity/playerIdentityUtils.js`: shared identity normalization utilities.
- `js/services/playerIdentity.js`: legacy/shared identity helper functions still referenced by import code.

Evidence: repository file layout and module imports.

## Test Conventions

- Tests are standalone Node `.mjs` files under `tests/`.
- Tests use `node:assert/strict`.
- Several tests perform static source assertions against current files.
- Focused tests exist for player identity resolution, identity migration SQL, Fantrax import pipeline wiring, Fantrax preview accounting, Fantrax preview UI wiring, cloud player pagination, and MLBAM serialization.

Evidence: `tests/*.mjs`.

## Git and Deployment Conventions

- The repository has tags `v4.0` and `v4-fantrax-import-success`.
- The application is intended to run in a browser; README currently describes opening the HTML locally, while cloud authentication UI requires Live Server behavior in current code.
- Do not commit or push unless explicitly requested.
- Avoid broad staging commands; stage only intentionally selected files when committing is requested.

Evidence: `README.txt`, `js/services/authUi.js`, Git tag list, repository instructions.
