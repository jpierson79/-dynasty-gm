# V5.5B-6G1 Prospect / MLB Archetype & Context Classification Repair

## Status

**ACTIVE / LOCAL IMPLEMENTATION ONLY**

G0A is complete, checkpointed, and production accepted at `b01efa7b909b257034a6e17db7539ccdee285a71`. The prospect evidence foundation is accepted. G1 is the first post-foundation calibration repair slice; it does not authorize deployment, production access, persistence, migration work, or later calibration phases.

## Required baseline

- Work only in `C:\Users\joshu\Documents\-dynasty-gm-architect` on `feature/manager-intelligence`.
- Require clean matching local/remote HEAD and read all repository governance before editing.
- Preserve the alternate `C:\Users\joshu\Documents\-dynasty-gm` worktree, its `codex/v5-season-rollover-reconciliation` branch, and untracked `.codex/`.
- G0A is **COMPLETE / PRODUCTION ACCEPTED**; G0F/G0G/G0H/G0I are complete.
- Migrations 014/015 are **APPLIED / HEALTHY / DO NOT REAPPLY**.
- Pages is healthy on GitHub Actions.
- Calibration remains `CALIBRATION_REQUIRED`; V5.5C remains blocked.

Stop on any material contradiction.

## Accepted G0A foundation

Preserve the accepted evidence: immutable G0F target `f67088c84eb79eab227a4a5759a37269e6c9f631`, deployment run `33281357581`, manifest `a18a6290730a6b56b2e71a7d427ff388bc76ae565d541057b3172d20cbdfd7ae`, 8,809 provider rows, 5,374 exact UUID/MLBAM matches, 33 factual updates, 5,341 no-ops, 3,369 unmatched rows, 66 identity/non-writable conflicts, zero invalid/stale rows, zero residual false positives, zero observed-time false updates, zero raw-representation false updates, Data Health 0 failures / 42 warnings, and canonical Player Intelligence READY for 10,363 players. G0A performed no Review or Apply.

## Objective

Repair only the canonical upstream archetype/developmental-context classification boundary so factual MLB/minor status and canonical prospect level meaningfully distinguish MLB players, recent call-ups, near-MLB prospects, distant prospects, and conservative unknown/conflict cases. Prevent young age alone from classifying minor leaguers as `YOUNG_MLB_OR_RECENT_CALLUP`.

Historical calibration evidence to correct structurally—not by targeting named players—was 6,162 `YOUNG_MLB_OR_RECENT_CALLUP` players with near-MLB and distant-prospect groups effectively absent. Do not set arbitrary target counts; require plausible non-degenerate groups from deterministic fixtures.

## Canonical implementation path

Trace and preserve one authoritative path:

`playerIntelligenceInputService.buildCanonicalPlayerIntelligenceInput`
→ canonical `prospectContext` / `ageDevelopment` evidence
→ `playerIntelligenceContext.evaluatePlayerContextComponents`
→ context evidence (`level`, `distanceStage`, `recentTransition`)
→ `playerIntelligenceComposite.classifyPlayerArchetype`
→ composite evaluation
→ `playerIntelligenceInspectionService` as a read-only consumer.

Do not add classification logic to the UI, inspection view, ranking table, recommendation code, or another service.

## Evidence priority and classification rules

Use canonical factual signals in this order:

1. MLB/minor-league status and contradiction state.
2. Canonical `currentLevel`: MLB, AAA, AA, A_PLUS, A, ROOKIE, COMPLEX, or DSL.
3. Canonical roster/call-up context already present in the input.
4. Age only as supporting context.

Use existing vocabulary where applicable: `MLB_HITTER`, `MLB_STARTING_PITCHER`, `MLB_RELIEVER`, `MLB_VETERAN`, `YOUNG_MLB_OR_RECENT_CALLUP`, `NEAR_MLB_PROSPECT`, `DISTANT_PROSPECT`, `CONSERVATIVE_UNKNOWN`, and `TWO_WAY_DEFERRED`.

- MLB classification requires factual MLB context; young age, MLBAM presence, universe membership, or missing production is insufficient.
- Ground near-MLB prospect context primarily in factual developmental proximity such as AAA/AA under existing canonical semantics.
- Ground distant-prospect context primarily in farther factual levels such as A_PLUS/A/ROOKIE/COMPLEX/DSL under existing canonical semantics.
- `CONFLICT` must not yield a guessed level or proximity group.
- `UNKNOWN` remains distinct from `CONFLICT` and must not be classified from age alone.
- Material contradictions between `isMinorLeaguer`, MLB status, and level must fail closed with an explicit warning/fallback rather than guessing.
- Missing age with valid factual level must still permit level-driven classification.
- A young A-ball player must not become young MLB; an older AAA player must not become established MLB from age.

Do not use player names as evidence, create players, or alter UUID/MLBAM identity. Named players may be post-hoc sanity checks only after deterministic rules exist.

## Scope exclusions

Do not change:

- Age/Trajectory formulas or calibration.
- Prospect Opportunity Cost formulas or weights.
- Statcast providers or Underlying Skill resolution.
- League Production, Role Stability, Risk Safety, HKB/market treatment, floor/expected/ceiling, or composite weights.
- Engine 5.1.1 scoring formulas.
- Position eligibility, multi-position handling, scarcity, or replacement logic.
- Migrations 014/015; do not create Migration 016.
- Production data, calculated scores, provider population, or persisted Player Intelligence.

Broader missing-evidence composite inflation and later calibration repairs remain separate tasks.

## Required deterministic fixtures

Cover at minimum:

1. Established MLB veteran.
2. Young established MLB player.
3. Actual recent MLB call-up.
4. AAA minor leaguer.
5. AA minor leaguer.
6. A+ minor leaguer.
7. A minor leaguer.
8. Rookie-level player.
9. Complex-league player.
10. DSL player.
11. `CONFLICT` evidence.
12. `UNKNOWN` evidence.
13. Minor flag plus MLB-level contradiction.
14. MLB flag plus minor-level contradiction.
15. Missing age with valid level.
16. Young age with distant minor level.
17. Older minor leaguer at AAA.

Require non-zero meaningful `NEAR_MLB_PROSPECT` and `DISTANT_PROSPECT` groups in suitable deterministic populations. Preserve exact UUID and MLBAM values and prove no name matching. Preserve multi-position behavior.

## Regression boundaries

Prove the repair leaves League Production, Underlying Skill, Role Stability except naturally corrected context input, Age/Trajectory formulas, Prospect Opportunity Cost formulas, Risk, composite weights, floor/expected/ceiling, and Engine 5.1.1 unchanged. Keep G0 prospect evidence, G0E equality, and G0F diagnostics regressions green.

## Performance

Run the existing 10k-player Player Intelligence performance regression. Classification must remain in-memory/indexed, introduce no per-player database/provider read, and avoid O(n²) work. Historical accepted production scale is 10,363 evaluated players.

## Validation

Run focused classification/context/composite/inspection tests; G0 prospect evidence, G0E equality, and G0F diagnostic tests; related component and Engine 5.1.1 regressions; the 10k performance test; JavaScript syntax checks; all `tests/*.test.mjs`; and `git diff --check`.

Run deterministic calibration inspection and report archetype/group distributions against the historical degenerate result. G1 does not require final calibration PASS.

## Completion state

If implementation and validation pass:

- G1 becomes **LOCAL IMPLEMENTATION / ARCHITECT REVIEW REQUIRED**.
- Calibration remains `CALIBRATION_REQUIRED`.
- No next repair slice is automatically activated.
- V5.5C remains blocked.

Record exact files/functions, rules, distributions, tests, performance, unchanged formula/weight proof, and no-production-operation evidence in `docs/NEXT_TASK_RESULT.md`. Stop uncommitted unless a later architect instruction explicitly authorizes checkpointing.

## Prohibited operations

Do not deploy, access production/cloud data, run provider collection or population, Review, Apply, persist scores or Player Intelligence, alter migrations, implement later calibration slices, activate V5.5C, modify the alternate worktree, or touch `.codex/`.
