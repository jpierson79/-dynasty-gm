# Dynasty GM Front Office Version 4 Audit

Phase 1 prepares the current browser-only application for a future cloud database and cross-device sync layer. This audit records the current local storage surface, duplicated stores, and the first compatibility data-access boundary.

## LocalStorage Keys

### Active keys

- `dynasty_players`: canonical player store. Phase 1 keeps this as the only active player object store.
- `dynasty_managers`: manager profiles and team tendency data.
- `dynasty_trades`: imported and manually tracked trade history.
- `dynasty_snapshots`: player snapshot history, now limited to the latest 3 snapshots.
- `dynasty_settings`: league settings, import timestamps, view preferences, storage warnings, and app settings.
- `dynasty_workflow`: compact workflow status records only.

### Legacy or migration keys

- `dynasty_gm_front_office_v3`: old monolithic database payload.
- `dynasty_gm_front_office_v2`: older monolithic database payload.
- `dynasty_gm_front_office_v1`: older monolithic database payload.
- `dynasty_gm_master_players_v1`: former duplicate master player cache. Useful data is migrated into `dynasty_players`, then the key is removed.
- `dynasty_statcast`: former separate Statcast payload cache. Useful metric fields are merged into `dynasty_players`, then the key is removed on save.
- `dynasty_gm_score_cache_v1`: former score cache. Current code removes it instead of persisting duplicate player-score data.
- `dynasty_gm_analysis_cache_v1`: view analysis cache. Still used by analysis-cache compatibility code in Phase 1 and removed by compact-storage flows.
- `dynasty_gm_startup_guard_v1`: small startup recovery guard.

## Storage Functions

- `storageKeys()`: returns the active split-store keys. Phase 1 now reads these from `DynastyDataStore` when available.
- `storageReadJSON(key, fallback)`: low-level JSON reader for compatibility and legacy reads.
- `storageSafeSet(key, value, opts)`: low-level JSON writer with quota warning handling.
- `storageSaveWarning(error)`: records a compact storage warning and shows "Storage limit reached. Please compact storage."
- `loadDB()`: bootstraps the app from split storage, legacy monoliths, and master-player migration.
- `saveDB(doRender)`: app-level save entry point.
- `readSplitDB()`: reads players, managers, trades, snapshots, and settings. Phase 1 now routes core reads through `DynastyDataStore`.
- `writeSplitDB(data, opts)`: writes players, managers, trades, snapshots, settings, and compact workflow. Phase 1 now routes core writes through `DynastyDataStore`.
- `dataLayerSave(method, key, value, opts)`: compatibility wrapper added in Phase 1 for data-layer saves with existing quota handling.
- `migrateMasterPlayersIntoData(data)`: migrates useful master-player data into the canonical player list and removes `dynasty_gm_master_players_v1`.
- `mergeStatcastIntoPlayers(players, statcast)`: legacy merge from `dynasty_statcast` into player objects.
- `compactPlayerForStorage(player)`: strips player records down to used normalized fields, mapped metrics, and calculated score fields before persistence.
- `playerStatcastPayload(player)` and `compactStatcastStore(players)`: legacy Statcast compaction helpers. The separate Statcast store is no longer written.
- `trimSnapshots(snapshots, limit)`: keeps only the latest 3 snapshots.
- `workflowStore(data)`: saves only compact workflow step name, status, last updated, and summary.
- `recordImportSnapshot(source)`, `cleanupSnapshots()`: create and trim snapshots.
- `compactStorage()`: removes old raw imports, legacy monoliths, old snapshots beyond 3, duplicate player caches, score caches, and analysis caches while keeping managers, trades, settings, and current players.
- `downloadJSON()`, `restoreJSON(event)`, `resetDB()`: backup, restore, and local reset flows.
- `loadScoreCache()`, `persistScoreCache()`, `invalidateScoreCache()`: score cache compatibility. `persistScoreCache()` removes the old cache key.
- `loadAnalysisCache()`, `analysisSet()`, `clearAnalysisCache()`: analysis cache compatibility. This remains a direct localStorage dependency in Phase 1 and should move behind the data layer or become memory-only in a later phase.
- `localStorageSizeEstimate()`: estimates browser storage usage.
- `setPerformanceMode(value)`, `setSafeMode(value)`, `approveHeavyViews()`: settings writes.
- Import and editing flows that save data: `importHKB()`, `importFantrax()`, `importAdvancedStats()`, `importTradeHistoryCSV()`, `addTradesWithSummary()`, `savePlayer()`, `deletePlayer()`, `setMyOwnerFromSelect()`, and league/settings forms that call `saveDB()`.

## Duplicated Player Stores And Caches

- Canonical active player store: `dynasty_players`.
- Removed or legacy duplicate player stores: `dynasty_gm_master_players_v1`, `dynasty_statcast`, `dynasty_gm_front_office_v3`, `dynasty_gm_front_office_v2`, `dynasty_gm_front_office_v1`.
- Removed duplicate calculated score cache: `dynasty_gm_score_cache_v1`.
- Remaining direct analysis cache: `dynasty_gm_analysis_cache_v1`.
- Snapshots remain separate but should store only changing historical values, not complete player objects.

## Features Directly Depending On Browser Storage

- Application startup and recovery guard.
- Current database load/save.
- HKB import, Fantrax import, Statcast/advanced-stat imports, and trade-history imports.
- Player add, edit, delete, scoring recalculation, and canonical player compaction.
- Manager profiles, owner/team synchronization, and manager settings.
- Trade center and trade-history analysis.
- Backup, restore, reset, and compact-storage tools.
- Snapshot and trend generation.
- Workflow guide status.
- Storage usage, performance mode, safe mode, and heavy-view approval.

## Phase 1 Data Access Layer

New modules live in `js/data/`:

- `schema.js`: documents Version 4 entities and required fields.
- `localStore.js`: localStorage adapter for the Phase 1 data-store interface.
- `migrationService.js`: normalization helpers for players, managers, teams, and derived ids.
- `dataStore.js`: common interface for players, managers, trades, snapshots, settings, workflow status, storage status, and integrity checks.

Initial interface:

- `getPlayers()` / `savePlayers(players)`
- `getManagers()` / `saveManagers(managers)`
- `getTrades()` / `saveTrades(trades)`
- `getSnapshots()` / `saveSnapshots(snapshots)`
- `getSettings()` / `saveSettings(settings)`

`localStore.js` powers the interface in Phase 1. Supabase or another cloud database is intentionally not connected yet.

## Version 4 Entity Notes

Raw imported values and calculated values are kept conceptually distinct:

- Raw values belong to Player and PlayerMetrics: owner/status, positions, MLB team, age, HKB value, ranks, player ids, and mapped Statcast metrics.
- Calculated scores belong to CalculatedPlayerScore-style fields: championship impact, scarcity, liquidity, appreciation, breakout, risk, and dynasty asset score.
- PlayerSnapshot should hold only time-varying fields: player id, snapshot date, owner team id, HKB value, overall rank, and a small calculated score summary.
- Full raw CSV rows should not be persisted.

## Integrity Checks Added

The Version 4 status panel runs checks for:

- Duplicate player ids.
- Duplicate normalized player names.
- Orphaned player metrics.
- Trades referencing missing players.
- Teams referencing missing managers.
- Invalid numeric values.
- Missing required ids.

## Remaining Direct localStorage Calls

Direct localStorage access remains by design in Phase 1 for compatibility. The main remaining direct calls are:

- Startup guard reads/writes/removal.
- Legacy migration reads/removals.
- Low-level compatibility helpers `storageReadJSON()` and `storageSafeSet()`.
- Storage estimate and compact-storage key scanning/removal.
- Backup, restore, reset, and old-cache cleanup.
- Workflow status checks that look for existing browser data.

Future phases can replace these paths incrementally once the data access layer is tested.
