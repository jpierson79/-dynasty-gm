# Next Task: V5.5B-2 League Production, Positional Scarcity, And Replacement Advantage

## Status And Authority

- V5.5B-1 canonical inputs and component envelopes are accepted.
- The V5.5B-1A production-data prerequisite is complete: the 2026 Reddit Phanatics import produced 10,326 canonical `Fantrax` / `fantrax_league_production` rows through exact identity, and its idempotency preview produced 10,326 no-ops.
- V5.5B-1A-3 hosted acceptance remains incomplete because post-import Data Health timed out, the normal Player Intelligence UI did not expose the canonical FPts/FP-G envelope, and the CSV worker emitted fallback warnings. Do not claim those observability issues are resolved.
- This task authorizes **local, read-only V5.5B-2 implementation only**. It does not authorize deployment, production reads or writes, production score calculation/persistence, migrations, imports, identity/ownership/roster changes, Statcast refresh, Fantrax synchronization, or V5.5C recommendations.
- Engine 5.1.1 remains the authoritative production score path. Stop if implementation appears to require persistence or conflicts with the canonical production records.

## Objective

Implement the first meaningful Player Intelligence 2.0 components from actual league data:

1. League Production
2. Positional / Scarcity Value
3. Replacement Advantage

The model must answer how difficult a player's production is to replace in the configured Reddit Phanatics league. It must not encode generic positional assumptions.

## Canonical Inputs And Population

1. Inspect the V5.5B-1 input boundary and repositories before implementation. Use the accepted Fantrax league-production metric records as the initial canonical source for season fantasy points and FP/G. Preserve source, season, freshness, stable player UUID, and raw evidence.
2. Inventory reliable opportunity fields such as games, PA, IP, appearances, and starts. Do not invent unavailable fields. Missing opportunity context lowers confidence or produces insufficient-data status.
3. Build league-scoped sets for rostered active-eligible MLB players, rostered reserves, minor/prospect players, and free agents. Do not mix prospects without MLB production into MLB replacement pools.
4. Preserve every eligible position. Never select one arbitrary primary position before replacement analysis.
5. Obtain team count and lineup demand from canonical league settings. Required slots include C, 1B, 2B, 3B, SS, OF, UT, SP, RP, and P where configured. Missing configuration fails closed with `LEAGUE_CONFIGURATION_MISSING`; do not substitute hidden Reddit Phanatics constants.

## Calculation Contract

### League Production

- Normalize current-season Fantrax fantasy production against the relevant league population using the existing 0-100 component convention.
- Include raw points, FP/G where available, percentile/distribution evidence, season, freshness, status, confidence, inputs used, explanations, and warnings.
- Do not use HKB, Statcast, team matchup totals, or generic dynasty rankings.
- Total Fantrax points already include league scoring such as defensive double-play points; do not add those points again.

### Replacement Pools And Scarcity

- Precompute position-eligible pools for C, 1B, 2B, 3B, SS, OF, SP, and RP from actual league players, ownership/status, and lineup demand.
- Treat UT as additional hitter demand and P as additional pitcher demand, not as synthetic player positions. Keep SP and RP evidence separate even when P flex demand affects both pools.
- For each position, expose starter demand/frontier, viable supply, free-agent count, best available free-agent production, top-alternative distribution, replacement production, drop after the starter tier, sample size, freshness, and confidence.
- Scarcity must emerge from demand, eligible supply, free-agent depth, and replacement quality. Fixed bonuses such as `SS +10` or `OF -10` are prohibited.
- Use a transparent deterministic approximation; do not add a full combinatorial lineup optimizer unless repository evidence proves it necessary.

### Multi-Position And Replacement Advantage

- Calculate the production gap at every eligible position and preserve `bestReplacementPosition`, `replacementProduction`, `playerProduction`, and `rawReplacementGap`.
- Use the most favorable valid replacement comparison plus a conservative bounded flexibility adjustment. Do not add full scarcity values for multiple positions or allow a player to fill multiple simultaneous demand slots.
- Support both rostered players and free agents. Preserve negative raw gaps when a rostered player is worse than available replacement talent.
- Prospects with no MLB production remain `NOT_APPLICABLE` or `INSUFFICIENT_DATA`; they do not receive fabricated zero production.

## Output, Explanations, And Warnings

- Populate the existing V5.5B-1 envelopes for `leagueProduction`, `positionalScarcity`, and `replacementAdvantage`. Leave the other components and floor/expected/ceiling weighting uncalculated.
- Use structured factual explanations including `LEAGUE_PRODUCTION_ELITE`, `LEAGUE_PRODUCTION_ABOVE_AVERAGE`, `POSITION_SHALLOW`, `POSITION_DEEP`, `FREE_AGENT_DEPTH_HIGH`, `FREE_AGENT_DEPTH_LOW`, `REPLACEMENT_ADVANTAGE_STRONG`, `REPLACEMENT_ADVANTAGE_NEGATIVE`, and `MULTI_POSITION_FLEXIBILITY` when supported.
- Support fail-closed warnings including `SMALL_SAMPLE`, `MISSING_PRODUCTION`, `NO_ELIGIBLE_POSITION`, `REPLACEMENT_POOL_INCOMPLETE`, `LEAGUE_CONFIGURATION_MISSING`, and `STALE_FANTRAX_PRODUCTION`.
- Any development inspection surface must remain read-only and minimal. Do not build the final Player Intelligence UI.

## Safety And Performance

- Attach results only by permanent `players.id`; do not join by name.
- Keep calculations league-scoped and deterministic. Build league context and positional pools once rather than repeatedly rescanning the full population for every player.
- Do not change the Fantrax production importer, protected-baseline profile, Statcast provider, HKB path, score repository/schema, RLS, authentication, roster synchronization, identity rules, or normal V5 behavior.
- Do not write component results to `calculated_player_scores`. Do not replace or modify Engine 5.1.1.

## Required Tests

Add focused fixtures proving:

- canonical league production uses Fantrax fantasy production and excludes HKB/Statcast;
- all eight positional replacement calculations are league-scoped;
- lineup demand and UT/P flex behavior use configuration;
- free-agent depth changes empirical scarcity;
- multi-position eligibility is preserved without double-counting;
- negative rostered-player replacement gaps and positive free-agent gaps are preserved;
- a deep-OF/shallow-MI fixture favors MI, while the reverse-depth fixture reverses the result;
- prospects without MLB production do not receive fake zeroes;
- small samples lower confidence and stale production is warned;
- no production write occurs, V5.5B-1 remains green, and Engine 5.1.1 output is unchanged.

Run the new V5.5B-2 tests, V5.5B-1 foundation/scoring tests, Fantrax/import, Statcast, MLBAM, Data Health, architecture, and auth regressions, the complete `tests/*.test.mjs` suite, and `git diff --check`.

## Deliverable And Stop

Implement locally, update `docs/NEXT_TASK_RESULT.md` with algorithms, population and demand rules, free-agent/flex/pitcher/sample treatment, fixture results, files, tests, and deferred limits, then stop uncommitted for architect review.

Do not deploy, persist Player Intelligence results, recalculate production scores, create/apply migrations, rerun the production import, run a Statcast refresh, change ownership/rosters/identity, implement V5.5C, or perform any cloud/data write.
