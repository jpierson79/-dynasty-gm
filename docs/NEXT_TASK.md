# Next Task: V5.5B-6 Real-Player Inspection and Calibration

## Status and authority

- V5.5B-5 is complete and checkpointed at implementation commit `bf781b2ecf20ff6915f97db564fea5cad806a840` and documentation commit `901d46c7f3fb6777d9f6db8be94d24885a44ed37`.
- This task authorizes local, read-only, in-memory, unpersisted V5.5B-6 work only.
- Do not deploy, persist Player Intelligence, modify `player_metrics` or `calculated_player_scores`, replace or recalculate Engine 5.1.1, run imports or Statcast refreshes, modify identity/ownership/roster state, create migrations, execute waiver actions, or perform production/cloud writes.

## Objective

Inspect the accepted Player Intelligence composite against real Reddit Phanatics players before any waiver engine consumes it. The purpose is to detect systematic model defects, not to tune named players toward preconceived rankings.

Preserve the accepted V5.5B-5 architecture: archetype-aware applicability; confidence-adjusted effective weights; penalty-free `NOT_APPLICABLE`; confidence reduction for missing applicable evidence; `riskSafety = 100 - risk`; Prospect Opportunity Cost direction `HIGHER_IS_BETTER_LOWER_COST`; scarcity subordinate to Replacement Advantage; HKB excluded from the MLB core composite and bounded for prospects; normalized floor/expected/ceiling; market divergence outside the core score; and unchanged Engine 5.1.1.

## Canonical read-only inspection

Use the existing canonical read-only Player Intelligence services. Do not hard-code player scores or introduce a parallel evaluator. The inspection evidence for each player must expose:

- player identity and archetype;
- expected, floor, ceiling, and overall confidence;
- League Production, Underlying Skill, Role Stability, Positional Scarcity, Replacement Advantage, Age/Trajectory, Risk/Risk Safety, and Prospect Opportunity Cost where applicable;
- HKB market percentile and market divergence;
- warnings; and
- strongest positive and negative contributors.

All results remain in memory and unpersisted.

## Representative calibration groups

Inspect representative real-player groups rather than cherry-picked stars:

1. Elite MLB hitters.
2. Middle infielders.
3. Outfielders.
4. Catchers.
5. Starting pitchers.
6. Relievers and closers.
7. Young MLB players.
8. Aging productive veterans.
9. Near-MLB prospects.
10. Distant prospects.
11. Free agents.
12. Below-replacement rostered players.

## Model audit questions

The inspection must determine whether:

- elite current producers rank highly;
- strong-Statcast/weak-production players surface as breakout candidates;
- regression-risk players retain legitimate current-production value;
- scarce-position premiums are useful but bounded;
- free agents above replacement and rostered players below replacement remain identifiable;
- reliever role/replacement value and starter treatment are appropriate for this league;
- missing Statcast preserves a valid composite with lower confidence rather than a fake zero;
- prospects without MLB production avoid fake-zero penalties;
- near-MLB prospects generally outrank similarly valued distant prospects when roster-slot economics support it;
- productive older veterans retain appropriate current value; and
- market divergence remains plausible without altering the core league score.

Also look for systematic double counting or distortion, including excessive prospect market support, duplicated age/prospect rewards, duplicated scarcity/replacement rewards, production overwhelming every other component, availability-context errors, and recent-call-up ceiling without sufficient confidence cost.

## Calibration discipline

Real players are audit examples only. Never change a weight, threshold, or component to force a named player toward a preferred rank. Any proposed correction must identify a generic structural cause supported across a representative group.

Acceptable finding: `RP Role Stability is systematically low because canonical leverage evidence is unavailable.`

Unacceptable finding: `Increase reliever weight because a named reliever ranks too low.`

## Evidence and disposition

Produce a read-only inspection record with representative membership, component evidence, ranking explanations, confidence/warnings, systemic findings, and known data limitations. Classify the outcome as one of:

- `CALIBRATION_ACCEPTABLE`: no material structural defect was found; recommend that the architect consider advancing governance to V5.5C.
- `GENERIC_REPAIR_REQUIRED`: a material generic defect was found; define one narrow V5.5B-6A repair for architect review.

Do not start V5.5C or V5.5B-6A automatically. Either next step requires a separate architect decision and task.

## Validation and deliverable

Add focused coverage for the inspection/calibration surface and representative-group behavior without encoding preferred named-player ranks. Run applicable focused Player Intelligence tests, the complete `tests/*.test.mjs` suite, JavaScript syntax checks, and `git diff --check`.

Update `docs/NEXT_TASK_RESULT.md` with inspection groups, evidence, systemic findings, limitations, disposition, files, tests, and confirmation that no persistence or production operation occurred. Stop uncommitted for architect review unless a later task explicitly authorizes checkpointing.
