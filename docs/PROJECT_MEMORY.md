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

Evidence: user-supplied authoritative facts, `docs/cloud-player-identity.md`, `supabase/migrations/006_player_external_identity.sql`, `js/services/PlayerIdentityResolver.js`, `tests/PlayerIdentityResolver.test.mjs`, `tests/cloudStoreSerialization.test.mjs`.

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
