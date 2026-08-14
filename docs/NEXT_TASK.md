# Next Task: V5.5B-6C Hosted Inspection Performance Repair

## Status and authority

- V5.5B-6B is complete at diagnosis commit `fda1c416f6dde1674afba4994b567302f45693fc`.
- The accepted primary root cause is synchronous quadratic main-thread evaluation: repeated complete metric scans, percentile population sorting/scanning, production-range calculation, Statcast percentile work, and market percentile work, with no event-loop yielding.
- The accepted secondary defect is eager rendering at approximately 10,326 players: about 5.82 million HTML characters, 10,340 table rows, 20,691 option elements, and 33 MiB heap growth. It occurs after evaluation and is not the primary cause of the observed `LOADING` freeze.
- This task authorizes local performance repair only. Calibration remains `REAL_PLAYER_ACCEPTANCE_REQUIRED`; V5.5C remains blocked.

## Objective

Preserve the full canonical population and every accepted scoring and evidence semantic while replacing repeated population work with reusable indexed contexts, bounded asynchronous evaluation, visible progress, and bounded rendering. Do not reduce the population or treat performance work as model calibration.

## Target architecture

Load canonical league data once, index canonical evidence by stable `players.id` UUID once, and precompute production distribution/ranks/range, positional replacement and scarcity pools, hitter and pitcher Statcast distributions, and market/HKB distribution and ranks. Evaluate each player from indexed evidence and reusable contexts without rescanning full populations, periodically yielding to the event loop. Aggregate diagnostics once, render only the visible page, and defer additional rows, detailed decomposition, and large comparison candidate sets.

No second identity authority or parallel evaluation path is permitted. Repository access remains authenticated and league scoped, with no per-player query.

## Semantic invariant

For identical canonical inputs, optimized results must remain equivalent for archetype, League Production, Underlying Skill, Role Stability, Positional Scarcity, Replacement Advantage, Age/Trajectory, Risk and Risk Safety, Prospect Opportunity Cost, breakout/regression evidence, expected, floor, ceiling, confidence, applicability, weights, contributions, market percentile/divergence, and diagnostic classifications. No formula, weight, threshold, replacement methodology, identity rule, Engine 5.1.1 behavior, or evidence meaning may change.

Precomputed percentile lookup must exactly preserve minimum, median, maximum, tied, missing, and pitcher-inverted semantics. Replacement optimization must preserve free-agent and rostered-player self-exclusion, including multi-position behavior.

## Reusable contexts and bounded evaluation

- Index Fantrax production, Statcast hitter/pitcher metrics, HKB evidence, role/context evidence, and ownership/availability by stable player UUID once per run.
- Build production population, sorted ranks, percentile context, and range once.
- Build C, 1B, 2B, 3B, SS, OF, SP, and RP eligibility/available pools, replacement benchmarks, and depth/scarcity context once.
- Build hitter and pitcher Statcast percentile distributions once, preserving missing-value exclusion and metric direction.
- Build market distribution and percentile lookup once.
- Use an explicit named chunk-size constant selected from local measurement. Yield between bounded chunks and expose `evaluatedPlayers`, `totalPlayers`, and `progressPercent` while `LOADING`; phase/elapsed timing may also be exposed.
- Preserve stale-result invalidation on logout, session/user change, league change, and reload. A stale run must never publish across contexts.

## Aggregation and rendering

Preserve every diagnostic threshold and classification while reducing repeated scans where an equivalent accumulation is possible. Keep one evaluated population and sort the selected ranking dimension on demand or use justified cached indices with deterministic tie behavior.

Use explicit display pagination, initially 50 or 100 rows based on measurement. Filtering and ranking operate over the complete in-memory population; paging performs no cloud load. Replace the two full-population comparison selects with bounded search/autocomplete or selected-row comparison. Materialize detailed decomposition only for the selected player and defer large diagnostic sections where appropriate.

## Validation contract

Add structural performance evidence proving one canonical load, no per-player repository query or full metric scan, one construction of production/Statcast/market/replacement contexts, periodic yielding, bounded initial rows, and bounded comparison choices. Use a deterministic synthetic population around 10,326 players and record `contextBuildMs`, `evaluationMs`, `aggregationMs`, `rankingMs`, `viewModelMs`, `totalMs`, `yieldCount`, and `maxChunkMs` where measurable. Structural assertions are primary; avoid brittle wall-clock-only CI gates.

Add semantic-equivalence coverage for an MLB hitter, SP, RP, young MLB player, veteran, near-MLB prospect, distant prospect, free agent, below-replacement player, missing Statcast, multi-position player, and market divergence. Explicitly cover percentile edges/ties/missing values and pitcher inversion, plus replacement self-exclusion.

Run focused inspection/performance/view, composite, context, Underlying Skill, League Production, Fantrax production, Statcast, Data Health, architecture, auth, and Fantrax regression tests; then the complete `tests/*.test.mjs` suite, JavaScript syntax checks, and `git diff --check`.

## Boundaries and handoff

Do not deploy, retry hosted calibration, access production/cloud data, persist Player Intelligence, modify `player_metrics` or `calculated_player_scores`, change Engine 5.1.1 or model semantics, run imports/refreshes/synchronization, modify identity/ownership/roster state, execute waiver/drop/trade actions, or create migrations.

Update `docs/NEXT_TASK_RESULT.md` with contexts/indexes, removed repeated work, chunking/progress, aggregation/ranking/rendering strategies, before/after measurements, semantic-equivalence evidence, files, tests, and limitations. Stop uncommitted for architect review.

After an exact, clean V5.5B-6C checkpoint, the next separately authorized task is V5.5B-6 Real-Player Calibration Acceptance Retry. Only a real-player calibration pass may unblock V5.5C.
