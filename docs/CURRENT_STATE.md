# Current State

Generated: 2026-07-30 America/Chicago.

## Git State

- Active branch: `feature/manager-intelligence`
- Current HEAD: `c11c84a`
- Current HEAD subject: `Stabilize V5 UI workflow and data health`
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
