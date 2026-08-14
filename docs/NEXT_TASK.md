# Next Task: V5.5B-4 Role Stability, Age/Trajectory, Risk, And Prospect Opportunity Cost

## Status And Authority

- V5.5B-1 canonical inputs and component envelopes, V5.5B-2 League Production/scarcity/replacement advantage, and V5.5B-3 Underlying Skill/breakout/regression are complete and checkpointed.
- This task authorizes local, read-only, in-memory V5.5B-4 implementation only.
- Do not deploy, persist Player Intelligence, modify `player_metrics` or `calculated_player_scores`, replace Engine 5.1.1, run imports or refreshes, create migrations, implement overall Player Intelligence, or implement V5.5C.

## Objective And Separation

Implement only `roleStability`, `ageTrajectory`, `risk`, and `prospectOpportunityCost`. Keep them independent from completed components:

- League Production: canonical Fantrax FPts with FP/G support.
- Underlying Skill: canonical Statcast evidence.
- Scarcity and replacement: empirical league population.
- Role Stability: opportunity and role security.
- Age/Trajectory: development stage.
- Risk: contextual downside uncertainty, not poor production.
- Prospect Opportunity Cost: dynasty roster-slot economics.
- Market Value: separate HKB evidence.

Do not calculate overall Player Intelligence, floor, expected, or ceiling.

## Canonical Input Audit

Before formulas, audit and document the exact canonical availability of age/date of birth, MLB/MiLB and active status, organization/team, roster/minors state, position eligibility, level/league, recent promotion/demotion or option evidence, playing-time and pitcher-role evidence, HKB market value, production, Statcast, and current injury/IL evidence. Do not infer fields that are unavailable. Missing evidence must lower confidence and remain visible.

## Role Stability

Measure how secure the player's opportunity is to generate fantasy points. Use only canonical evidence for roster security, playing time/usage, role clarity, recent promotion/demotion risk, and bounded position-flexibility support.

- Do not assume MLB means everyday, SP eligibility means rotation lock, RP eligibility means closer, or youth means imminent promotion.
- Keep hitter and pitcher role evidence distinct. Saves/holds or rotation/bullpen evidence may support a role only when canonical.
- An RP with strong production but incomplete leverage evidence must not receive automatic elite stability and must expose `RELIEF_ROLE_EVIDENCE_LIMITED` or equivalent.
- Age, HKB, Statcast skill, and poor production do not enter the raw Role Stability score.
- Confidence depends on freshness, known roster state, evidence coverage, usage evidence, and recent role changes.

## Age And Trajectory

Measure how favorable the player's current development stage is for dynasty value while remaining independent of current skill and role. Use broad, transparent, bounded stages such as development, early prime, prime, late prime, and decline-risk, interpreted alongside MLB/MiLB stage. Youth alone is not sufficient: a young MLB regular and a same-age distant prospect may have different context and risk. Preserve age, stage, MLB/MiLB status, score, confidence, explanations, and warnings. Do not use HKB directly or pretend to have precise immutable age cliffs.

## Prospect Opportunity Cost

For prospects, measure whether the player is worth a dynasty roster slot relative to alternatives—not whether he is merely a good baseball prospect. Use canonical evidence where available: age, level and distance to MLB, readiness, MLB/MiLB state, market support, bounded scarcity support, replacement environment, production/Statcast availability, and roster/minors slot context.

- Support evidence that can later inform `PROTECTED`, `INVESTMENT`, and `CHURN`; do not assign those labels from reputation.
- Treat levels such as MLB, AAA, AA, A+/A, and complex/rookie only when canonical. Greater distance generally raises uncertainty and opportunity cost; do not invent ETA years.
- HKB is bounded supporting market evidence and cannot erase development risk or dictate the result.
- Scarcity is bounded supporting evidence and must not be double-counted.
- A prospect without MLB production or Statcast is `NOT_APPLICABLE`/`INSUFFICIENT_DATA` for those components, never fake zero; prospect opportunity cost may still calculate from valid prospect context.
- Established MLB players normally receive Prospect Opportunity Cost = `NOT_APPLICABLE`.

## Risk

Measure contextual downside uncertainty from valid evidence such as role instability, MiLB distance, recent promotion/demotion, incomplete or stale data, pitcher-prospect volatility, current canonical injury/IL state, unclear playing time, and unclear roster state. Poor production itself is not risk. Do not invent injury prognosis. Any pitcher-prospect adjustment must be bounded, transparent, and supported rather than an arbitrary penalty.

## Missing Data, Explanations, And Confidence

Never fabricate playing time, role certainty, injury prognosis, ETA, scouting grade, or closer hierarchy. Each component has independent confidence. Preserve factual supporting values and structured explanations/warnings, including accepted equivalents of role established/uncertain, promotion/demotion, limited relief evidence, favorable/aging trajectory, near/distant prospect, high/low slot cost, scarcity/deep-position support, incomplete role/prospect data, and unavailable injury evidence.

## Required Fixtures And Isolation

Add focused regression coverage for:

1. Near-MLB scarce-position prospect versus distant deep-position prospect, with the first materially better on opportunity cost without a fixed position bonus.
2. Young MLB regular versus a same-age AA prospect: higher Role Stability and lower Risk for the MLB regular while Age/Trajectory may remain favorable for both.
3. Aging productive veteran: strong League Production and potentially strong Role Stability remain intact while Age/Trajectory is lower than a young MLB star.
4. Recently promoted and recently demoted players, including lower stability/higher risk for demotion without changing identical Underlying Skill.
5. RP with strong production but limited leverage evidence.
6. Same Statcast/different role: same Underlying Skill, different Role Stability.
7. Same age/different role: same Age/Trajectory, different Role Stability.
8. Same role/different age: same Role Stability, different Age/Trajectory.
9. MLB veteran Prospect Opportunity Cost = `NOT_APPLICABLE`.
10. Prospect without MLB production is not assigned fake zero production.
11. Bounded pitcher-prospect risk.
12. Missing and stale evidence reduces confidence and fails safely.

## Implementation Shape And Validation

Prefer narrow modules such as `v5/js/engine/playerIntelligenceContext.js`, `v5/js/services/playerIntelligenceContextService.js`, and `tests/v5PlayerIntelligenceContext.test.mjs`, plus only minimal canonical-input/foundation changes proven necessary. Avoid repeated per-player repository reads and reuse the V5.5B-2 league/scarcity context where applicable. Do not build final UI.

Run the new context tests; V5.5B foundation, League Production, Underlying Skill, Fantrax production, Statcast, MLBAM identity, scoring, Data Health, architecture, authentication, and Fantrax regression tests; the complete `tests/*.test.mjs` suite; JavaScript syntax checks; and `git diff --check`.

## Deliverable And Stop

Update `docs/NEXT_TASK_RESULT.md` with exact canonical inputs, component algorithms, hitter/pitcher distinctions, prospect distance and market/scarcity support, missing-data/confidence behavior, known limitations, fixtures, files, and validation. Stop uncommitted for architect review. Do not stage, commit, push, deploy, migrate, import, refresh, persist, or perform cloud/data writes.

After V5.5B-4 is checkpointed, repository governance must be advanced to a new explicit `docs/NEXT_TASK.md` before any later implementation slice begins. Do not treat a completed V5.5B-4 contract as authority for subsequent work.
