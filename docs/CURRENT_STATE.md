# Current State

Generated: 2026-08-01 America/Chicago.

## Git State

- Active branch: `feature/manager-intelligence`
- Current HEAD: `94e051a`
- Current HEAD subject: `Fix prospect visibility and roster recommendations`
- Initial working tree for this documentation reconciliation: clean.
- Recent completed commits:
  - `c11c84a` Stabilize V5 UI workflow and data health
  - `145e06a` Harden cloud imports and data workflow diagnostics
  - `ab8729a` Add V5 regression tests and cache refresh
  - `8aab34f` Preserve player identity during repeat Fantrax imports
  - `94fba81` Build Dynasty Front Office V5 through Trade Center

The July 16 operational snapshot that described branch `fix/reliable-repeat-import`, HEAD `acee731`, and uncommitted import work is superseded by this section. That older state remains represented in Git history and durable architecture decisions.

## Latest Completed V5 Work

- V5 cloud-first application shell, dashboard, Players, My Roster, Waiver Opportunities, Trade Center, Teams & Managers, Cloud Imports, and Settings & Data Health exist.
- Repeat Fantrax CSV imports preserve player UUIDs through stable identity resolution and paginated cloud preload.
- Cloud imports use preview/review safeguards and actionable diagnostics.
- V5.4.0/V5.4.1 Trade Center work uses UUID player identity, bounded searches, stored scores, package analysis, consolidation targets, trade fits, and session-only drafts.
- V5.4.2 UI stabilization covers Players search draft state, import filename controls, table containment, Teams & Managers empty-state guidance, and roster-status diagnostics.
- V5.4.3/V5.4.3A completed read-only Fantrax endpoint and identity discovery; no roster synchronization, preview implementation, or schema change was produced.
- The repository was clean before this documentation-only task.

## V5.4.5 Fantrax Public Preview Foundation

- A preview-only V5 workflow now requests six documented public Fantrax operations through an allowlisted Supabase Edge Function: league info, team rosters, matchup scores, current standings, draft picks, and draft results.
- The preview normalizes league, player, team, roster, scoring-period, matchup, standing, and draft data without database writes.
- Player identity uses only an exact populated `fantrax_api_player_id` or the strict `*API_ID*` transformation. Name and MLBAM fallback remain prohibited.
- Team-name equality is suggestion-only because the current schema has no `teams.fantrax_team_id`; suggestions are never authoritative or persisted.
- Roster status mapping remains exact for the four observed values, with unknown values shown as `UNCLASSIFIED`.
- Matchup scores are labeled team scores. Standings are labeled `CURRENT_ONLY`. No player-level fantasy scoring or Dynasty Intelligence integration exists.
- Data Health reports preview availability and identity diagnostics without claiming synchronization.
- Chrome validation on 2026-08-02 verified 10 teams, 10,161 exact player identity matches, 567 exact roster-player matches, 24 scoring periods, 15 current and period-1 matchup rows, 10 current-only standings rows, 6 draft picks, and 50 draft results. All 10 teams remain intentionally blocked because authoritative Fantrax team IDs are not persisted.
- The `fantrax-public-league-preview` Edge Function was deployed with explicit authorization for preview validation. It performs public HTTP reads only and has no database client or write path.

## V5.4.6A Fantrax Team Identity Foundation

- V5.4.6A implementation and deployment acceptance are complete. Migration 007 was applied once and verified as nullable text with its format constraint and league-scoped partial unique index.
- A narrowly scoped migration adds nullable `teams.fantrax_team_id`, validates its normalized 16-character format, and enforces uniqueness within each league without backfilling rows.
- The Fantrax Preview Identity tab includes a responsive Team Identity Manager with roster, matchup, and draft-presence context; cloud team, manager relationship, UUID, owned-player count, existing identity; pending review; cancellation; replacement confirmation; and an exact team-identity-only confirmation dialog.
- One-to-one and cross-league rules are validated before persistence. Name equality is displayed only as a non-authoritative suggestion.
- Saving is constrained to the active league/team UUID and writes only `teams.fantrax_team_id`; post-save preview recomputation reports ownership and roster-status differences without an Apply Sync action.
- Data Health now reports Fantrax team counts, persisted identities, duplicates, unmapped teams, valid roster-team joins, ownership/status differences, and an honest manual-override warning.
- The current roster-status manager writes only `players.roster_status` and `updated_at`. No reviewed manual override/source/timestamp/sync audit mechanism exists, so production roster synchronization remains blocked.
- Ten reviewed one-to-one mappings were persisted across the ten valid fantasy teams; two excluded/stale raw team rows remain unmapped. Database verification found 10 populated IDs, 10 distinct IDs, and zero duplicate mapping groups.
- Pre/post protected hashes matched exactly for teams, players, calculated scores, and player metrics. No player ownership, roster status, player identity, manager assignment, score, HKB value, or Statcast value changed.
- Chrome acceptance passed after versioning the team-repository browser import to prevent a stale-module export error. Reload persistence, 10 mapped/0 unmapped teams, duplicate blocking, roster identity joins, read-only difference reporting, responsive controls, Data Health, absence of Apply Sync, and a clean console were confirmed.
- Manual Override Protection Available remains `WARNING`; production roster synchronization and V5.4.6B readiness remain blocked until a reviewed override/source/timestamp policy exists.

## Verified HKB Matching Repair

- HKB uses a dedicated canonical name normalizer for fallback matching; Fantrax and MLBAM identity precedence is unchanged.
- Diacritics, apostrophes, hyphens, periods in initials, and whitespace normalize consistently while suffix tokens remain meaningful.
- Duplicate canonical names require a unique result from explicit MLB-team and position context. Unknown cloud team metadata does not override a unique position result; explicit conflicting team metadata remains unsafe.
- Draft-pick assets matching the narrow year plus Early/Mid/Late plus round pattern are reported separately and never treated as players.
- Preview and upload share the reviewed match decisions. HKB upload is limited to batched value/rank updates for existing player UUIDs and performs no player insert.
- Read-only preview of `harryknowsball_players (12).csv` loaded 10,197 cloud players and improved matching from 1,652 to 1,693 rows. It classified 18 non-player assets, 1,652 unique name matches, 6 normalization repairs, 41 contextual matches, 35 players absent from cloud, and no ambiguous, conflicting, or invalid rows.
- The live preview did not run an upload and produced no browser console errors.

Evidence: recent Git history, `v5/`, `tests/v5*.test.mjs`, `tests/fantrax*.test.mjs`.

## Verified Fantrax Roster API State

- `getTeamRosters` is reachable with `leagueId` and optional `period`; no authentication was observed.
- CORS works from the local V5 browser origin with credentials omitted.
- Responses may be `text/plain` containing valid JSON.
- Invalid league IDs may return HTTP 200 with `INVALID_LEAGUE_ID`.
- Current verified response structure:

```text
{
  period,
  rosters: {
    [fantraxTeamId]: {
      teamName,
      rosterItems: [{ id, position, status }]
    }
  }
}
```

- Exact status mapping is `ACTIVE` to `ACTIVE`, `RESERVE` to `RESERVE`, `INJURED_RESERVE` to `IL`, `MINORS` to `MINORS`, and unknown to `UNCLASSIFIED`.
- Ownership remains independent. Unknown or missing status never implies `FREE_AGENT`.
- No production roster-status synchronization exists.

## Verified Fantrax Player Identity

- Stored source field: `players.fantrax_id`.
- Verified stored representation: `*API_ID*`.
- Strict API transformation: require exactly one leading and trailing ASCII `*`, remove only those wrappers, and preserve the inner value.
- The unwrapped identity must be validated with `getPlayerIds`.
- No name, fuzzy, or MLBAM fallback is permitted for this API join.
- `getTeamRosters.rosterItems[].id` is the Fantrax API player ID, not a separate roster-row ID.

Verified diagnostics:

- Current roster API players: 566
- Normalized stored IDs matching current roster API IDs: 566
- Cloud-owned players matching current roster snapshot: 566
- Duplicate normalized IDs: 0
- Owned cloud players absent from snapshot: 0
- Cloud players with `fantrax_id`: 10,170
- Normalized IDs found in the global `getPlayerIds` catalog: 10,134
- Historical/catalog misses: 36
- Catalog misses affecting current roster: 0

## Verified Fantrax Team And League Identity

## V5.4.6B-1 Local Implementation

- Manual roster-status override protection is implemented locally with migration 008, authenticated save/clear paths, source and audit UI, read-only Fantrax conflict recommendations, and Data Health coverage.
- Migration 008 is applied and schema-verified. A controlled Chrome save/restore/clear test passed without leaving a changed roster status; the tested row now has explicit `UNKNOWN` provenance and no active override metadata.
- Existing cloud roster statuses, ownership, identities, managers, scores, HKB values, and metrics have not been changed by this local implementation.
- Remaining acceptance is live Data Health rendering and Fantrax conflict-preview validation with the league configuration. Production Fantrax roster synchronization remains out of scope and blocked until that validation succeeds.

- Ten 16-character alphanumeric Fantrax team IDs matched across `getLeagueInfo`, `getTeamRosters`, `getDraftResults`, `getStandings`, and `getMatchupScores`.
- The same IDs appeared in tested current and historical periods.
- Cross-season team-ID stability is not proven.
- The current `teams` schema has no authoritative Fantrax team-ID field.
- The current league schema has no structured Fantrax league-integration field.
- No `userSecretId` is required or approved for storage.

## Next Proposed Phase: V5.4.3B

Fantrax External Identity Foundation and Read-Only Roster Preview:

- reviewed schema migration;
- central strict CSV-ID unwrap;
- `getPlayerIds` validation;
- player API-ID backfill preview;
- structured Fantrax league integration configuration;
- reviewed one-to-one team assignment preview;
- read-only roster-status preview;
- focused Data Health diagnostics;
- synthetic tests.

V5.4.3B must not include roster-status writes, ownership writes, free-agent rewrites, automatic team-name matching, player or team creation, production imports, or remote migration application without explicit approval.

## Current Blockers Before Production Synchronization

- Add and review a nullable player API-ID field or equivalent explicit identity bridge.
- Add and review authoritative Fantrax team-ID storage.
- Add and review structured Fantrax league integration metadata.
- Resolve the 36 global catalog misses or keep them explicitly excluded from validated operations.
- Establish a reviewed team assignment for all configured teams.
- Decide and test season rollover behavior because cross-season team-ID stability is unknown.
- Complete a read-only preview phase before designing any Apply operation.

Production roster synchronization is not currently safe. It becomes eligible for design only after these blockers are addressed and verified.

## Operations Not Performed During Documentation Reconciliation

- No source changes.
- No migrations created or applied.
- No cloud reads or writes.
- No imports.
- No score recalculations.
- No commits or pushes.
