# Current State

Generated: 2026-08-01 America/Chicago.

## Git State

- Active branch: `feature/manager-intelligence`
- Current HEAD: `8291c980633c87840da05ebef3a98d46e32c767a`
- Current HEAD subject: `Add manual roster status override protection`
- Initial tracked working tree for V5.4.6B-2: clean; `.codex/` was already present as unrelated untracked workspace metadata.
- Recent completed commits:
  - `c11c84a` Stabilize V5 UI workflow and data health
  - `145e06a` Harden cloud imports and data workflow diagnostics
  - `ab8729a` Add V5 regression tests and cache refresh
  - `8aab34f` Preserve player identity during repeat Fantrax imports
  - `94fba81` Build Dynasty Front Office V5 through Trade Center
  - `8291c98` Add manual roster status override protection

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

## V5.4.6B-2 Local Implementation

- Reviewed Fantrax roster-status synchronization is implemented locally on top of the B-1 preview recommendations.
- Only exact `APPLY_FANTRAX_STATUS` rows enter the apply set. Manual overrides, unknown statuses, unmatched player identities, unmapped team identities, and ownership differences are excluded.
- The UI requires an exact update-set acknowledgement and a separate final confirmation.
- Writes are grouped by previewed current and target status, constrained by league and reviewed player UUID, and exclude `MANUAL` provenance at write time. Only roster status, `FANTRAX` provenance, and `updated_at` are written.
- Successful applies reload league data and fetch a fresh Fantrax preview. Stale or newly protected rows are reported as skipped and require another review.
- Synthetic tests pass. No migration was created for B-2. The guarded recommendation set passed authenticated live acceptance, followed by a successful three-player controlled production apply and post-apply verification.
- Live ownership-guard acceptance found 566 exact roster identities, six ownership differences, and 560 eligible status updates. The six conflicts are excluded as `REVIEW_CONFLICT`: three cloud free agents and three different-cloud-owner rows.
- Ownership-conflict diagnostics distinguish `CLOUD_FREE_AGENT` from `DIFFERENT_CLOUD_OWNER` and display cloud owner names rather than raw team UUIDs. No ownership repair is automatic.

## V5.4.6B-3 Local Controlled-Apply Hardening

- Reviewed rows now carry an expected cloud owner, and the apply query requires that owner as well as the previewed current status and non-manual provenance.
- Apply results classify skipped rows and report failed write groups. Incomplete outcomes are not presented as successful, and league data plus the Fantrax preview refresh after each returned attempt.
- Data Health now shows an immediate running state, prevents duplicate starts, preserves the last successful report on error, and returns a visible read-only timeout after 60 seconds.
- Authenticated browser acceptance exposed a real timeout in the initial implementation. The corrected path reuses the already-loaded players, metrics, scores, and teams for diagnostics instead of downloading them again, and runs independent recommendation checks concurrently.
- An authenticated browser rerun completed and rendered the full report, confirming the timeout correction. The report contained one false failure because an idle Trade Center had no selected partner; this is corrected locally to a warning while missing user teams or invalid selected partners remain failures.
- Final read-only acceptance reports zero Data Health failures. A fresh Fantrax preview reports 566 roster/status differences, 560 eligible status-only updates, six excluded ownership conflicts split evenly between cloud free agents and different owners, and zero unmatched players, unmapped teams, or unclassified Fantrax statuses.
- Pre-apply protected baseline: 10,197 players, 565 owned players, zero manual overrides, protected player hash `e2ef7a71366281dd19d575b465b5cb87`, team hash `16bdaf1ec9143a7331e69db87e344ee7`, score hash `accc954d5dffaae8c3e13a64b502d69f`, and metric hash `44940d299bb920b89563486de9b5dfbd`.
- Controlled-apply review initially exposed all 560 eligible rows as one indivisible manifest, contradicting the approved 1–3-row acceptance plan. The local UI now starts with no selected rows, permits at most three eligible UUIDs, invalidates acknowledgement whenever selection changes, names the selected players in final confirmation, and revalidates only that subset before the guarded repository call.
- The first controlled production apply succeeded at `2026-08-03T20:55:53.031Z`: Kevin McGonigle, Daylen Lile, and Nico Hoerner changed from `UNCLASSIFIED` to `ACTIVE` in one guarded group. The UI reported 3 reviewed, 3 updated, 0 skipped, and 0 failed groups; the refreshed preview reduced eligible updates from 560 to 557 and showed Nico Hoerner as `NO_CHANGE`.
- Post-apply player count, owned count, protected player hash, team hash, score hash, and metric hash exactly matched the pre-apply baseline. Data Health completed with zero failures. Controlled production acceptance is complete.
- V5.4.6B-4 locally blocks roster-status review and apply whenever an explicit historical scoring period is selected. Only the empty `Current` period configuration can enter the reviewed synchronization path; the guard is repeated immediately before apply.
- Authenticated browser acceptance selected historical scoring period 13, which contained 489 roster rows and 285 apparent eligible updates. The UI displayed the historical-period warning and disabled review, proving no historical snapshot could enter synchronization.
- The complete 31-file test suite passes locally after the corrections.

- Ten 16-character alphanumeric Fantrax team IDs matched across `getLeagueInfo`, `getTeamRosters`, `getDraftResults`, `getStandings`, and `getMatchupScores`.
- The same IDs appeared in tested current and historical periods.
- Cross-season team-ID stability is not proven.
- The current `teams` schema has no authoritative Fantrax team-ID field.
- The current league schema has no structured Fantrax league-integration field.
- No `userSecretId` is required or approved for storage.

## Historical Proposed Phase: V5.4.3B

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

## Remaining Constraints Before Broader Production Use

- Broader application of the remaining 557 eligible rows requires a new exact review and explicit authorization; controlled acceptance does not authorize a bulk apply.
- No active manual overrides existed during controlled acceptance, so the synthetic and write-query manual guard remains the evidence for that branch until a future reviewed conflict is available.
- Decide and test season rollover behavior because cross-season team-ID stability is unknown.

The B-3 controlled apply path is production-accepted for the exact three-player test above. No broader roster synchronization is authorized.

## Operations Not Performed During Documentation Reconciliation

- No source changes.
- No migrations created or applied.
- No cloud reads or writes.
- No imports.
- No score recalculations.
- No commits or pushes.
