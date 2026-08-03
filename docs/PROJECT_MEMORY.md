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
- The current production schema has neither an authoritative Fantrax team-ID field nor structured Fantrax league-integration storage.
- Production roster synchronization has not been implemented and is not safe until required external-identity fields and reviewed one-to-one team assignments exist.

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
- The current player schema has no reviewed manual roster-status override marker, source, override timestamp, synchronization timestamp, or durable `updated_by` audit field. Production roster synchronization remains blocked until an override policy is designed and implemented.
- Chrome acceptance verified persisted 10-of-10 team identity, zero unmapped teams, duplicate blocking, resolved roster-team identity, read-only ownership/status differences, responsive controls, no Apply Sync action, no console errors, and accurate Data Health reporting. V5.4.6B remains blocked by absent reviewed manual roster-status override protection.

Evidence: `supabase/migrations/007_fantrax_team_identity.sql`, `v5/js/services/fantraxTeamIdentityService.js`, `v5/js/repositories/teamRepository.js`.

## Fantrax Identity Graph

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
