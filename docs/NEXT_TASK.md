# V5.5B-6G3 Post-G1/G2 Deterministic Calibration Diagnostic

## Status

**ACTIVE / LOCAL DIAGNOSTIC ONLY**

G0A is complete and production accepted. G1 is complete/checkpointed at implementation `c659056ace2fe0c7e5175c8724b50983e9ad7ac8` and checkpoint `cb7b00fd647c415a172c0b66b4b3ab930910d4f1`. G2 is complete/checkpointed at implementation `9caea5ab4eacb5ba57bcbd1445b1ad08a7f37bee` and checkpoint `2115674ced67e93b7737095fda998c1b9618d22d`. Calibration remains `CALIBRATION_REQUIRED`; V5.5C remains blocked.

## Baseline and boundaries

- Work only in `C:\Users\joshu\Documents\-dynasty-gm-architect` on clean, matching local/remote `feature/manager-intelligence` after reading all repository governance.
- Preserve the alternate `C:\Users\joshu\Documents\-dynasty-gm` worktree, its `codex/v5-season-rollover-reconciliation` branch, and untracked `.codex/`.
- Use current post-G1/G2 local code. Do not use the historical G0F immutable artifact for this diagnostic.
- Migrations 014/015 remain applied, healthy, and unchanged. Do not create Migration 016.
- Pages remains healthy on GitHub Actions. This task does not authorize deployment, browser/cloud/production access, provider collection, Preview/Review/Apply, import, refresh, persistence, or data mutation.
- Stop on any material repository or governance contradiction.

## Objective

Establish a deterministic post-G1/G2 calibration baseline before selecting another repair. Measure current archetype distribution, canonical Statcast/Underlying Skill coverage, component applicability/confidence/contribution, sparse-evidence composite behavior, Prospect Opportunity Cost, Age/Trajectory influence, reliever evidence, Risk, and scenario invariants. Identify exactly one highest-priority remaining upstream defect from measured evidence, but do not implement or automatically activate it.

Historical pre-G1/G2 observations—including 6,162 `YOUNG_MLB_OR_RECENT_CALLUP` rows, absent near/distant prospect groups, broad missing Statcast, sparse-evidence inflation, Age/Trajectory dominance, and reliever-confidence concerns—are comparison evidence only. Do not assume they persist.

## Formula and behavior freeze

G3 is diagnostic only. Do not change classifiers, component formulas, component/composite weights, confidence or renormalization, breakout/regression thresholds, Prospect Opportunity Cost, Age/Trajectory, Role Stability, Risk, Statcast lookup, provider/import behavior, floor/expected/ceiling, HKB semantics, Engine 5.1.1, schema, or migrations. Named players may be inspected only after aggregate diagnostics and cannot establish thresholds or tuning rules.

## Required trace

Trace and record the current path:

`canonical Player Intelligence inputs`
→ archetype classification
→ component calculation and status
→ component confidence
→ composite confidence renormalization
→ floor/expected/ceiling
→ inspection records
→ group/calibration aggregation.

Record exact files, functions, canonical group definitions, component confidence/status fields, missingness fields, contribution calculations, aggregate outputs, and how missing components expand the normalized share of remaining evidence.

## Deterministic diagnostic cohorts

Use generic deterministic fixtures representing at least a high-evidence MLB hitter, high-evidence MLB pitcher, low-evidence MLB player, recent call-up, AAA prospect, AA prospect, A prospect, Rookie prospect, conservative unknown/conflict player, reliever, and starter. Do not tune formulas or select desired rankings from named players.

Measure counts and percentages for every canonical archetype, including MLB hitter/starter/reliever/veteran groups, `YOUNG_MLB_OR_RECENT_CALLUP`, `NEAR_MLB_PROSPECT`, `DISTANT_PROSPECT`, `CONSERVATIVE_UNKNOWN`, and any existing deferred group. Require near/distant groups when the input contains the corresponding factual levels and confirm generic minor leaguers no longer enter the young-MLB group.

## Evidence and component coverage

For each archetype, report:

- player count;
- Underlying Skill applicable count, evidence-present count, genuine-missing/not-applicable count, confidence distribution, median confidence, and p25/p75 where practical;
- availability and confidence for League Production, Underlying Skill, Role Stability, Age/Trajectory, Prospect Opportunity Cost, and Risk;
- average/median effective contribution for League Production, Underlying Skill, Role Stability, Age/Trajectory, Prospect Opportunity Cost, and Risk Safety after the existing confidence renormalization;
- the most frequent largest effective contributor, using an explicitly documented contribution comparison.

For established and young/recent MLB groups, separately count canonical Statcast rows, resolved Underlying Skill, and genuine missingness with reason. Do not require 100% coverage. For near/distant prospects, lack of MLB Statcast is not automatically defective; distinguish `NOT_APPLICABLE` or genuine missingness from unexpected resolution failure. If the accepted G2 false-missing regression reappears, stop G3 before downstream conclusions.

## Sparse-evidence and confidence analysis

Identify zero-confidence or effectively absent components and players. Build diagnostic-only evidence-coverage buckets using the existing confidence representation and document the temporary bucket definition. For each bucket report count, median expected/ceiling, and top-decile expected/ceiling. Inspect the top 25 expected, top 25 ceiling, top 25 lowest-evidence players by expected, and top 25 lowest-evidence players by ceiling only after aggregate results exist.

Where existing utilities permit, measure the relationship between total evidence confidence and expected/ceiling to find extreme low-evidence/high-score anomalies; do not require a target correlation. Determine whether confidence renormalization causes sparse evidence to receive an excessive effective share without changing it.

## Prospect Opportunity Cost

For every archetype, report POC applicability, confidence, score distribution, and effective composite contribution. Compare near-MLB and distant prospects directly. Determine whether POC applies only where intended, remains absent for appropriate MLB players, differentiates prospect proximity sensibly, or becomes excessive when other evidence is absent. Do not change the formula.

## Age, role, reliever, and risk analysis

- Report Age/Trajectory mean/median score, confidence, effective contribution, and share of total effective evidence by archetype. Separately inspect whether it dominates low-evidence players because production, skill, role, or POC is missing.
- Compare starters and relievers on Underlying Skill evidence/confidence, Role Stability confidence, League Production confidence, overall confidence, and composite behavior. Lower confidence alone is not a defect; require proof that valid evidence is systematically under-credited before recommending a role-specific repair.
- Report Risk and Risk Safety distributions by archetype without changing their formulas.
- Verify `floor <= expected <= ceiling` for every inspected player. Any violation is a blocking defect.
- Confirm HKB remains only its existing bounded market/prospect support and never becomes skill evidence.

## Scale and performance

Run the existing 10,326+ local Player Intelligence inspection using loaded in-memory fixtures. Record player count, elapsed time, yield count, archetype distribution, and component coverage. Diagnostic aggregation may scan completed inspection output, but it must not add population scans inside per-player classifier/component logic, per-player I/O, provider calls, or O(n²) production behavior.

## Classification and next-slice decision

Classify each candidate issue as `BLOCKING STRUCTURAL DEFECT`, `MATERIAL CALIBRATION DEFECT`, `MINOR CALIBRATION ISSUE`, or `EXPECTED BEHAVIOR / NO REPAIR`:

1. Prospect Opportunity Cost.
2. Missing-evidence/composite inflation.
3. Age/Trajectory dominance.
4. Reliever confidence.
5. Final weights.

Choose exactly one next repair based on severity, upstream dependency, breadth, and deterministic evidence. Structural evidence defects precede weight tuning; upstream causes precede downstream symptoms; global weights remain last. A POC repair requires proven incorrect application or material prospect distortion. A missing-evidence repair requires proven sparse-evidence inflation from renormalization. An Age/Trajectory repair requires dominance after controlling for sparse evidence and corrected archetypes. A reliever repair requires a distinct reproducible evidence/confidence defect. The selected slice is identified only and is not automatically active.

## Validation

- Add diagnostic tests/utilities only if required; do not change semantic expectations or the production runtime path.
- Re-run the G1 archetype and G2 Statcast resolution regressions first.
- Run focused inspection, composite, component, confidence, POC, age/trajectory, role, risk, Statcast, and prospect tests relevant to the diagnostic.
- Run the complete sorted `tests/*.test.mjs` suite; baseline is 60/60.
- Run syntax checks for changed diagnostic JS/test files, the 10,326+ performance regression, trusted deployment graph validation if runtime modules change, and `git diff --check`.
- Record every diagnostic result, limitation, invariant, and unchanged boundary in `docs/NEXT_TASK_RESULT.md`.

## Completion state

If the diagnostic succeeds:

- G3: **DIAGNOSTIC COMPLETE / CHECKPOINTED** after separate architect approval and checkpoint authority.
- Calibration: `CALIBRATION_REQUIRED`.
- Next repair slice: identified but not automatically active.
- V5.5C: blocked.

Leave any future diagnostic implementation unstaged and uncommitted unless a later architect instruction explicitly authorizes checkpointing.
