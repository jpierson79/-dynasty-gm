# V5.5B-6G2 Statcast Canonical Evidence Resolution Repair

## Status

**ACTIVE / LOCAL IMPLEMENTATION ONLY**

G0A is complete and production accepted. G1 is complete/checkpointed at implementation `c659056ace2fe0c7e5175c8724b50983e9ad7ac8` and checkpoint `cb7b00fd647c415a172c0b66b4b3ab930910d4f1`. Calibration remains `CALIBRATION_REQUIRED`; V5.5C remains blocked.

## Required baseline and boundaries

- Work only in `C:\Users\joshu\Documents\-dynasty-gm-architect` on clean, matching local/remote `feature/manager-intelligence` after reading all repository governance.
- Preserve the alternate `C:\Users\joshu\Documents\-dynasty-gm` worktree, its `codex/v5-season-rollover-reconciliation` branch, and untracked `.codex/`.
- Migrations 014/015 are applied, healthy, unchanged, and must not be reapplied. Do not create Migration 016.
- Pages remains healthy on GitHub Actions. G2 does not authorize deployment, browser/cloud/production access, provider collection, Preview, Review, Apply, import, refresh, persistence, or any data mutation.
- Stop on any material repository or governance contradiction.

## Objective

Determine whether valid already-imported canonical Statcast evidence is being lost between persistence and canonical Player Intelligence input. If a real resolution defect is reproducible, repair only the UUID/MLBAM lookup, hitter/pitcher selection, metric indexing, or narrowly required canonical plumbing that causes false missingness.

Do not manufacture a defect. If deterministic evidence does not reproduce false missingness, stop and record that the calibration assumption was wrong and identify the actual cause.

## Required trace before implementation

Trace and record in `docs/NEXT_TASK_RESULT.md`:

`Statcast import/persistence`
→ canonical metric storage
→ player UUID / exact MLBAM association
→ metric repository loading and pagination
→ Player Intelligence metric indexing
→ hitter/pitcher record selection
→ canonical metric extraction
→ Underlying Skill input
→ missingness/confidence interpretation
→ calibration inspection output.

Inventory exact files, functions, metric keys, identity keys, source/type discriminators, index construction, duplicate precedence, fallback behavior, and the exact point where evidence becomes missing. Inspect for naming/casing mismatches, UUID-versus-MLBAM or string-versus-number mismatches, source/type filtering, omitted pagination/index rows, and duplicate-resolution defects without assuming which is responsible.

Before changing application code, add or extend a deterministic regression demonstrating valid canonical Statcast evidence that the current Player Intelligence path resolves as missing or unavailable because of the proven defect.

## Identity and evidence rules

- Internal player UUID remains authoritative; exact MLBAM is used only where provider identity requires it.
- No player-name, normalized-name, fuzzy, team-plus-name, or position-plus-name matching is permitted.
- Unresolved or ambiguous identity remains unresolved with an explicit reason.
- Keep hitter and pitcher Statcast evidence separate. Starter/reliever classification must not alter raw metric resolution unless the existing canonical contract requires it.
- Preserve the existing two-way-player policy; do not invent aggregation semantics. Hitter and pitcher evidence must remain separately addressable.
- Genuine missingness remains missing. Do not synthesize MLB Statcast for prospects, small/unavailable samples, unresolved identities, or absent provider rows.
- Missing individual metrics remain excluded from normalization/weighting rather than becoming zero.

## Existing Underlying Skill contract to preserve

Do not change scoring formulas, curves, thresholds, or weights. Hitters continue to use existing canonical evidence including xwOBA, xSLG, xBA, barrel rate, hard-hit rate, exit velocity, and sprint speed. Pitchers continue to use xERA, xwOBA allowed, barrel rate allowed, hard-hit rate allowed, and exit velocity allowed. The breakout/regression comparison threshold remains 20 percentile points.

Confidence may change only naturally because previously hidden valid evidence becomes visible to the unchanged calculation. Do not redesign confidence.

## Explicit exclusions

Do not change:

- Underlying Skill or Statcast scoring formulas and metric weights;
- breakout/regression thresholds;
- composite weights, confidence renormalization, Risk Safety, HKB treatment, floor/expected/ceiling;
- G1 prospect/MLB classification;
- Prospect Opportunity Cost, Age/Trajectory, Role Stability, or Risk formulas;
- provider acquisition/source snapshots except narrowly proven resolution plumbing;
- Engine 5.1.1, identity, ownership, roster state, positions, scarcity, or replacement logic;
- migrations, schema, production data, persisted metrics, or calculated scores.

Reliever confidence, POC calibration, missing-evidence/composite inflation, age dominance, and weight review remain later separate decisions.

## Required deterministic coverage

Cover at minimum:

1. Complete hitter evidence resolves.
2. Partial hitter evidence resolves and missing metrics are excluded, not zeroed.
3. Genuine missing hitter evidence remains missing.
4. A hitter regression reproduces and repairs the proven false-missing lookup.
5. Hitter identity mismatch remains unresolved.
6. Complete pitcher evidence resolves.
7. Partial pitcher evidence resolves.
8. Genuine missing pitcher evidence remains missing.
9. A pitcher regression reproduces and repairs the proven false-missing lookup where applicable.
10. Pitcher identity mismatch remains unresolved.
11. UUID association and exact MLBAM provider identity remain canonical.
12. No name matching exists.
13. Hitter/pitcher evidence stays separated.
14. Existing two-way policy is preserved.
15. Metric-name canonicalization and source/type filtering are deterministic.
16. Duplicate/ambiguous resolution follows the existing fail-closed policy.
17. Existing confidence naturally reflects only resolved evidence.
18. The 20-point breakout/regression threshold is unchanged.
19. Underlying Skill formula is unchanged.
20. G1 archetype and G0 prospect-evidence behavior remain unchanged.

Run a deterministic/local calibration inspection and report Underlying Skill coverage by established MLB, young/recent MLB, near prospect, distant prospect, and conservative unknown groups. Do not require 100% coverage or invent evidence for prospects; improvement should be limited to MLB players with valid evidence that was previously unresolved.

## Performance and validation

- Build/load metric evidence once and use an in-memory index. No per-player DB/provider reads, repeated full metric scans, per-player async, or O(n²) behavior.
- Run focused Statcast/input/index/Underlying Skill/inspection tests, identity tests, G1 and G0 regressions, the 10,326+ player performance regression, JavaScript syntax checks, trusted deployment graph validation if application modules change, all sorted `tests/*.test.mjs`, and `git diff --check`.
- Confirm formulas, weights, threshold, POC, composite behavior, migrations, and production boundaries remain unchanged.

## Completion state

G2 is ready for architect review only if the actual false-missing resolution defect is proven and repaired, valid hitter/pitcher evidence resolves, genuine missingness remains missing, identity and type separation remain exact, formulas remain unchanged, and focused/full/performance validation passes.

After local success:

- G2: **LOCAL IMPLEMENTATION COMPLETE / ARCHITECT REVIEW REQUIRED**
- Calibration: `CALIBRATION_REQUIRED`
- Next calibration slice: not automatically active
- V5.5C: blocked

Record the trace, defect proof, exact repair, fixture outcomes, coverage distribution, validation, unchanged boundaries, and no-production-operation evidence in `docs/NEXT_TASK_RESULT.md`. Leave implementation unstaged/uncommitted unless a later architect instruction authorizes checkpointing.
