# V5.5B-6G4 Missing-Evidence / Composite Inflation Repair

## Status

**ACTIVE / LOCAL IMPLEMENTATION ONLY**

G0A is complete and production accepted. G1, G2, and G3 are complete/checkpointed. G3 diagnostic implementation is `63eadf00c3c484f77228822aa53430d2f24d8ec8`; its documentation checkpoint is `e66b5ecbb68e7aed3a1920db245e7d759c2d6106`. Calibration remains `CALIBRATION_REQUIRED`, and V5.5C remains blocked.

## Baseline and boundaries

- Work only in `C:\Users\joshu\Documents\-dynasty-gm-architect` on clean, matching local/remote `feature/manager-intelligence` after reading all repository governance.
- Preserve `C:\Users\joshu\Documents\-dynasty-gm`, its `codex/v5-season-rollover-reconciliation` branch, and untracked `.codex/`.
- Migrations 014/015 remain applied and unchanged. Migration 016 remains absent.
- Pages remains healthy on GitHub Actions, but G4 is local only. Do not deploy, access browser/cloud/production data, collect provider data, Preview/Review/Apply, import, refresh, persist, migrate, or mutate data.
- Stop on any material repository or governance contradiction.

## Accepted G3 evidence

- The deterministic population contained 10,326 players. Exactly 1,549 had reported overall confidence 0 while retaining three calculated components.
- That zero-confidence cohort had median expected 72.42 and median ceiling 81.32. Representative rows assigned Age/Trajectory a 50% normalized share.
- Current normalization computes `effectiveWeight = baseWeight * componentConfidence / 100`, renormalizes surviving effective weights to 100%, and does not attenuate expected value by overall confidence. No minimum evidence floor exists.
- Missing-evidence/composite inflation is a **BLOCKING STRUCTURAL DEFECT**. Age/Trajectory dominance is a material downstream symptom, not the next component-formula repair.
- G1 and G2 passed. Prospect Opportunity Cost is expected behavior with near/distant medians 63/34. No distinct reliever defect was proven. Global weights are not ready for tuning. Floor/expected/ceiling ordering had zero violations.

## Objective

Repair the composite evidence-authority boundary so sparse profiles cannot turn a tiny surviving evidence set into a full-strength dynasty score. Less reliable evidence must yield less composite authority and certainty without treating missing evidence as bad performance or arbitrarily collapsing legitimate prospect value.

Preserve component formulas and base weights. Change only the narrow confidence/evidence gating and renormalization behavior required to eliminate inflation.

## Required trace before implementation

Trace and record:

`component score`
→ component confidence
→ confidence-adjusted eligibility/effective weight
→ renormalization denominator
→ expected
→ floor/ceiling
→ overall confidence.

Record the exact files, functions, base weights, denominator, zero-confidence behavior, surviving-weight expansion, relationship between overall confidence and composite authority, and the smallest viable evidence gate in `docs/NEXT_TASK_RESULT.md`.

Before implementing, add or extend a deterministic fixture that reproduces a zero/near-zero meaningful-evidence profile receiving a strong expected/ceiling value because one or two surviving evidence sources expand to the full weight budget. Record its exact pre-fix result; it must fail before the repair and pass afterward.

## Authorized scope

G4 may change only:

- composite evidence gating;
- confidence-to-effective-weight behavior;
- minimum weighted-evidence requirements;
- sparse-evidence fallback behavior;
- a cap on renormalization when evidence authority is low;
- uncertainty/range widening if already supported by the current architecture; and
- aggregate composite-confidence semantics only as needed to represent evidence authority.

Trace first and choose the smallest architecture-consistent mechanism. A deterministic aggregate such as `sum(base_weight * component_confidence)` may represent supported model authority if the current design lacks one, but G4 must not add an independent scoring model.

Do not use a flat point penalty, manufacture zero scores for missing components, or invent an external prior without separate authorization. Preserve unallocated authority as uncertainty or otherwise bound redistribution in a way derived from evidence quality. Component count is supporting evidence only; weighted evidence quality is authoritative.

## Formula and behavior freeze

Do not change:

- League Production, Underlying Skill, Role Stability, Age/Trajectory, Prospect Opportunity Cost, or Risk formulas;
- component confidence formulas;
- component base weights;
- G1 archetype/context classification;
- G2 Statcast canonical resolution;
- prospect evidence, HKB, or provider/import behavior;
- reliever logic;
- final global weight tuning;
- Engine 5.1.1; or
- schema, migrations, persistence, or production behavior.

For identical inputs, all raw component scores and confidences must remain unchanged. POC behavior and near/distant differentiation must remain structurally equivalent. Age/Trajectory may retain importance, but sparse missingness must no longer allow it to acquire half or more of total authority merely because other evidence is absent. HKB remains bounded market/prospect support and cannot substitute for missing skill or production evidence.

## Evidence semantics and fairness

- Missing evidence is not zero or negative evidence.
- A zero-confidence player need not have a score of zero; the goal is uncertain, not worthless.
- High-evidence MLB hitters and pitchers must remain identical or nearly identical within a narrow, explained tolerance.
- Low-evidence MLB profiles must not receive full composite authority from Age/Trajectory or one surviving component.
- AAA/AA and more distant prospects may retain differentiated value from valid Age/Trajectory, POC, and existing bounded market/context evidence while reflecting limited confidence.
- Do not hard-code archetype penalties. Let available weighted evidence determine authority.
- `CONSERVATIVE_UNKNOWN` remains fail-closed and cannot be inflated by one component.
- Do not double-count uncertainty through Risk or range handling.

## Deterministic fixture matrix

Cover at minimum:

1. high-evidence MLB hitter;
2. high-evidence MLB pitcher;
3. zero/near-zero-evidence player;
4. one-component player;
5. two-component low-confidence player;
6. multiple medium-confidence components;
7. high-confidence prospect-context-only player;
8. AAA prospect;
9. distant prospect;
10. recent call-up with partial evidence;
11. conservative unknown;
12. reliever;
13. starter;
14. missing Statcast with valid League Production; and
15. valid Statcast with missing League Production.

Required regressions:

- one surviving component cannot automatically receive 100% effective authority;
- adding valid evidence cannot reduce model authority/confidence;
- removing valid evidence cannot increase authority through renormalization;
- missing remains distinct from numeric zero;
- prospects do not collapse into one undifferentiated low score;
- AAA/AA versus distant-level differentiation remains intact;
- raw Age/Trajectory, POC, League Production, Underlying Skill, Role Stability, and Risk outputs remain unchanged;
- exact base weights remain unchanged;
- G1 archetypes and G2 Statcast resolution remain unchanged;
- `floor <= expected <= ceiling` has zero violations; and
- normal high-evidence behavior remains within the narrow accepted tolerance.

## Calibration rerun and acceptance evidence

After implementation, rerun the G3 deterministic diagnostic and compare before/after evidence groups (`very low`, `low`, `medium`, `high`). Require:

- material reduction in inflated expected/ceiling values for the zero-confidence cohort;
- fewer extreme top-25 expected results among the bottom evidence quartile;
- no broad distortion of high-evidence profiles;
- reduced Age/Trajectory monopoly when caused by sparse evidence;
- plausible, unchanged raw POC behavior;
- no reliever regression;
- zero floor/expected/ceiling ordering violations; and
- no requirement for perfect group ordering or a zero score at zero confidence.

Named players may be inspected only after aggregate results as sanity checks. Do not derive thresholds or tuning from them.

## Performance

Composite evidence gating must remain O(1) per player. Do not add database/provider I/O, population scans, async work per player, or O(n²) behavior. Run the existing 10,326+ inspection and document player count, elapsed time, yields, and diagnostic aggregation.

## Validation

- Run focused composite, confidence, component, inspection, G3 diagnostic, G1, G2, POC, age/trajectory, role, risk, Statcast, prospect, and performance regressions.
- Run the complete sorted `tests/*.test.mjs` suite; activation baseline is 61/61.
- Run syntax checks for changed JavaScript/test files.
- Run trusted deployment graph validation if runtime modules change.
- Run `git diff --check`.
- Record exact commands/results, files changed, limitations, and every unchanged safety boundary in `docs/NEXT_TASK_RESULT.md`.

## Completion state

If local implementation and validation succeed:

- G4: **LOCAL IMPLEMENTATION COMPLETE / ARCHITECT REVIEW REQUIRED**;
- calibration: `CALIBRATION_REQUIRED`;
- next diagnostic or calibration slice: not automatically active; and
- V5.5C: blocked.

Leave implementation unstaged and uncommitted for architect review unless a later explicit instruction authorizes checkpointing.
