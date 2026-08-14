# Next Task: V5.5B-3 Underlying Skill, Breakout, And Regression Intelligence

## Status And Authority

- V5.5B-1 canonical inputs and component envelopes are complete.
- V5.5B-2 League Production, empirical positional scarcity, and replacement advantage are complete and checkpointed.
- This task authorizes local, read-only V5.5B-3 implementation only. Do not deploy, run a production Statcast refresh, modify production data, persist Player Intelligence, replace Engine 5.1.1, or create migrations.

## Objective

Implement the existing `underlyingSkill` component and structured breakout/regression evidence. Determine whether independent Statcast skill supports, exceeds, or trails independent Fantrax league production while making coverage and freshness explicit.

## Independent Evidence Boundaries

- Actual League Production is Fantrax FPts/FP-G.
- Underlying Skill is Statcast.
- Market Value is HKB.
- HKB and Fantrax production cannot affect the raw Underlying Skill score. Production and skill may be compared only after both components are independently calculated.
- Use canonical V5.5B inputs; never read raw provider responses or assume fields merely because Baseball Savant offers them.

## Statcast Availability And Normalization

- Audit and document the exact canonical hitter and pitcher fields before formulas are implemented.
- Support `AVAILABLE`, `PARTIAL`, `STALE`, `MISSING`, and `NOT_APPLICABLE`, or accepted equivalents. Missing means unknown, never zero/bad skill/regression/low ceiling.
- Build separate current-season hitter and pitcher percentile contexts once per league/session. Preserve raw value, percentile, direction, population size, freshness, and availability.
- Exclude missing values from percentile populations and weighted denominators. Do not silently impute league average. Partial or stale evidence lowers confidence and emits structured warnings.

## Hitter Skill

- Use only canonical supported evidence, expected to include where present: xBA, xSLG, xwOBA, average exit velocity, hard-hit rate, barrel rate, and sprint speed.
- Expected production has the largest named weight; contact quality has substantial weight; sprint speed is a small supporting factor and cannot dominate elite offensive evidence.
- Do not invent unsupported chase, whiff, strikeout, walk, contact, or pitch metrics.

## Pitcher Skill

- Use a separate formula and only canonical supported evidence, expected to include where present: ERA, xERA, allowed exit velocity, allowed hard-hit rate, and allowed barrel rate.
- Explicitly invert lower-is-better metrics. Do not manufacture strikeout, walk, whiff, velocity, chase, pitch-usage, or Stuff+ evidence.
- Narrow evidence must lower confidence and emit `LIMITED_PITCHER_SKILL_INPUTS` rather than overstate certainty.

## Component And Signals

- Populate only the existing `underlyingSkill` envelope with score, confidence, status, player type, metrics used, metric percentiles, coverage ratio, freshness, explanations, and warnings.
- Do not calculate overall Player Intelligence or merge League Production and Underlying Skill into one score.
- Compare independent production and skill percentiles with a named material-gap threshold:
  - `BREAKOUT_SIGNAL`: skill materially exceeds production.
  - `REGRESSION_RISK`: production materially exceeds skill.
  - `SUPPORTED_PRODUCTION`: both are strong.
  - `WEAK_PRODUCTION_SUPPORTED`: both are weak.
  - neutral when the gap is small.
- Preserve production percentile, skill percentile, gap, confidence, and supporting metrics. A 72/74 difference must not trigger a dramatic signal.

## Isolation And Fail-Closed Rules

- Raw Underlying Skill must be invariant to age, position, HKB, Fantrax FPts, role security, and scarcity.
- Prospects without MLB Statcast evidence are `NOT_APPLICABLE` or `INSUFFICIENT_DATA`; do not substitute HKB, reputation, or scouting.
- If two-way handling cannot preserve distinct hitter/pitcher envelopes, mark it deferred rather than averaging unrelated evidence.
- Missing Statcast must not weaken a valid V5.5B-2 League Production component.

## Required Tests

Add focused coverage for breakout, regression, supported-star, small-gap/noise, partial coverage, missing xwOBA, sprint-speed non-dominance, pitcher lower-is-better direction, age neutrality, position neutrality, HKB isolation, production isolation, and no-Statcast behavior.

Run the new Underlying Skill tests; V5.5B foundation and League Production; Fantrax production; Statcast provider/session; MLBAM identity; Data Health; scoring; architecture; authentication; Fantrax regressions; the complete `tests/*.test.mjs` suite; JavaScript syntax checks; and `git diff --check`.

## Deliverable And Stop

Implement locally, update `docs/NEXT_TASK_RESULT.md` with exact canonical metrics, formulas/weights, normalization, missingness/freshness/confidence, signal thresholds, fixtures, limitations, files, and tests, then stop uncommitted for architect review.

Do not deploy, run production refresh/imports, modify `player_metrics` or `calculated_player_scores`, persist outputs, replace Engine 5.1.1, implement age/role/market/risk/final scoring, implement V5.5C, or create migrations.
