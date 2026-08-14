# Next Task: V5.5B-5 Player Intelligence Calibration And Explainable Composite

## Status And Authority

- V5.5B-1 through V5.5B-4 are complete and checkpointed. Independent components now exist for League Production, Underlying Skill, Role Stability, Positional Scarcity, Age/Trajectory, Risk, Replacement Advantage, and Prospect Opportunity Cost. HKB remains independent market evidence.
- This task authorizes local, read-only, in-memory V5.5B-5 implementation only.
- Do not deploy, persist Player Intelligence, modify `player_metrics` or `calculated_player_scores`, replace or recalculate Engine 5.1.1, run imports/refreshes, modify roster/ownership/identity, create migrations, or implement production waiver actions.

## Objective

Implement the first explainable Player Intelligence composite. Do not average every component. Select components that apply to the player's archetype, account transparently for component confidence and availability, preserve raw evidence, and explain why one player ranks above another in the active league.

Create an in-memory `overallPlayerIntelligence` or repository-consistent equivalent containing at least score, confidence, archetype, applicable components, component contributions, explanations, and warnings. Preserve all source component envelopes and do not persist the result.

## Archetypes And Applicability

Explicitly distinguish at least:

- MLB hitter
- MLB starting pitcher
- MLB reliever
- young MLB/recent call-up
- MLB veteran
- near-MLB prospect
- distant prospect

Define a transparent applicability matrix marking every component `REQUIRED`, `OPTIONAL`, or `NOT_APPLICABLE` per archetype. Do not use identical weights across all archetypes.

- Established MLB players should emphasize actual League Production, Underlying Skill, Role Stability, Replacement Advantage, bounded Positional Scarcity, Age/Trajectory, and Risk; Prospect Opportunity Cost is normally not applicable.
- Prospects may lack League Production and MLB Statcast without penalty-as-zero. They should emphasize Age/Trajectory, Risk, Prospect Opportunity Cost, and bounded market/scarcity/replacement context appropriate to their distance/readiness.
- Role Stability for prospects represents lack of an established MLB role; it must not invent zero MLB production or imminent promotion.

## Component Directions And Confidence

Preserve and document score direction before weighting:

- Higher League Production, Underlying Skill, Role Stability, Positional Scarcity, Age/Trajectory, Replacement Advantage, and Prospect Opportunity Cost scores are favorable.
- Prospect Opportunity Cost direction is `HIGHER_IS_BETTER_LOWER_COST`.
- Higher Risk means **more downside risk** and must be transformed consistently rather than treated as favorable.

Define how `CALCULATED`, stale, partial, insufficient, unavailable, and `NOT_APPLICABLE` components affect applicability, normalization, confidence, and the denominator. `NOT_APPLICABLE` and missing evidence are never zero. Missing Statcast must not behave like zero skill. Low-confidence evidence may contribute less, but do not blindly multiply score by confidence without documenting and testing the mathematical behavior.

Overall confidence must remain separate from the overall value score and reflect required-component coverage, component confidence, freshness, and warnings.

## Starting Weights And Overlap Controls

Use named, transparent starting weights defined generically before player examples. Do not optimize against named players.

Explicitly prevent double counting:

- Positional Scarcity describes league depth; Replacement Advantage describes this player's gap over a realistic alternative. Do not give both full overlapping weight.
- Role Stability supports sustainability/confidence but must not duplicate already-realized League Production.
- Age/Trajectory is developmental runway; Prospect Opportunity Cost is roster-slot economics. Youth cannot earn the same reward twice.
- Risk must not be subtracted repeatedly through score, floor, and confidence without distinct documented purposes.
- HKB is bounded market/liquidity evidence, not a league-performance authority and not a dominant composite weight.

Preserve market divergence: high league intelligence with lower HKB and lower league intelligence with high HKB must both remain representable for future trade intelligence.

## Floor, Expected, And Ceiling

Implement first meaningful normalized Player Intelligence outcome bands, not scouting grades and not fantasy-point projections:

- **Floor:** conservative value under realistic role/skill/development disappointment.
- **Expected:** most likely value based on applicable current production, skill, role, age, scarcity/replacement, and risk.
- **Ceiling:** credible upside under favorable skill/role/development outcomes.

Document how Risk, confidence, and breakout/regression evidence affect score versus band width. Breakout/regression signals may change explanations, spread, or confidence but must not become large blind fixed bonuses. Require `floor <= expected <= ceiling`, bounded outputs, and traceable assumptions.

## Required Generic Fixtures

Cover at least elite productive SS, equally productive replaceable OF, Statcast breakout hitter, high-production regression-risk hitter, ace SP, volatile productive RP, young MLB regular, aging productive veteran, near-MLB elite prospect, distant high-risk prospect, below-replacement rostered MLB player, and high-value available free agent.

Critical regressions:

1. Two players with similar production/skill: the scarce-position player with stronger replacement advantage must outrank the replaceable player for visible league-specific reasons.
2. High league intelligence with low/moderate HKB must remain distinct from lower league intelligence with high HKB; HKB cannot force the ranking.
3. A near-MLB prospect with favorable trajectory, low slot cost, scarcity, and strong market support must outrank a similar-market distant/high-risk/deep-position prospect without fake MLB production.
4. Unavailable and `NOT_APPLICABLE` components do not become zero or silently depress the composite.
5. Archetypes receive different applicability/weights; Risk and Prospect Opportunity Cost directions remain correct.
6. Scarcity/replacement, role/production, and age/prospect overlap controls remain bounded.
7. Engine 5.1.1 output and version remain unchanged.

Named players may be used only as post-formula audit examples. Never add player-specific calibration bonuses.

## Implementation Shape And Validation

Prefer a narrow pure composite engine plus a read-only service that consumes the existing canonical V5.5B evaluation pipeline. Preserve component evidence and avoid new repository reads or any write path. Do not build final production UI unless a minimal read-only inspection surface is explicitly required by repository evidence.

Run focused composite, V5.5B foundation, League Production, Underlying Skill, context, Fantrax production, Statcast, MLBAM identity, scoring, Data Health, architecture, auth, and Fantrax regression tests; the complete `tests/*.test.mjs` suite; JavaScript syntax checks; and `git diff --check`.

## Deliverable And Stop

Update `docs/NEXT_TASK_RESULT.md` with the archetype matrix, component directions/weights/applicability, confidence and missingness rules, overlap controls, market treatment, floor/expected/ceiling semantics, fixture outcomes, known limitations, files, and validation. Stop uncommitted for architect review.

After V5.5B-5 is checkpointed, advance repository governance in a separate documentation-only task before V5.5B-6 or V5.5C begins. Do not decide the next implementation slice prematurely.
