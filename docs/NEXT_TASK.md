# Next Task: V5.5B-6G Real-Player Calibration Repair Foundation

## Status and authority

- Immutable deployment integrity and hosted inspection performance have passed for exact application target `7130399b4162989e5b1f6ed893e3158f2e411b23`.
- Real-player calibration is `CALIBRATION_REQUIRED`; V5.5C remains blocked.
- V5.5B-6G is local implementation first. It does not authorize deployment, production writes, imports, refreshes, persistence, score recalculation, identity/ownership/roster changes, or V5.5C activation.

## Objective

Repair the generic evidence-resolution and calibration defects demonstrated by the 10,363-player real population without changing Engine 5.1.1 or tuning for named players. Preserve canonical UUID/MLBAM identities, missing-data semantics, league scoping, empirical replacement logic, and explainable component evidence.

## Required repair order

Work must proceed in this order and stop when evidence contradicts the next step:

1. Repair archetype and context classification.
2. Repair canonical persisted Statcast evidence resolution.
3. Verify whether Prospect Opportunity Cost becomes populated for correctly classified prospects.
4. Repair missing-evidence and zero-confidence composite inflation with a generic evidence-sufficiency rule.
5. Rerun deterministic calibration fixtures.
6. Only then assess Age/Trajectory dominance.
7. Only then assess reliever confidence suppression.
8. Only then consider any composite-weight adjustment.

Do not skip directly to weights or bundle speculative weight tuning into the early repair slices.

## V5.5B-6G1: Archetype Classification Repair

Diagnose why 6,162 players were classified `YOUNG_MLB_OR_RECENT_CALLUP` while both `NEAR_MLB_PROSPECT` and `DISTANT_PROSPECT` had zero players. Use canonical MLB/MiLB status, level, roster status, promotion/recent-call-up evidence, missing-context fallback, and reviewed archetype precedence.

- Do not classify from player names, HKB ranks, or arbitrary age thresholds.
- Preserve conservative unknown behavior when authoritative context is missing.
- Cover MLB veterans, young MLB players, recent call-ups, near-MLB hitters and pitchers, distant hitters and pitchers, missing context, and retired/inactive players where relevant.

## V5.5B-6G2: Statcast Canonical Input Repair

Determine why inspection reported 100% missing Statcast despite persisted coverage. Inspect source value/casing, metric type, season, league scope, MLBAM-to-UUID resolution, reviewed aliases, hitter/pitcher selection, freshness filters, and the optimized UUID index.

- Consume existing persisted evidence before considering any refresh.
- Never fabricate metrics or guess identity.
- Keep hitter and pitcher contexts separate.
- Prove known hitter and pitcher UUIDs resolve `AVAILABLE`, missing evidence remains `UNAVAILABLE`, reviewed aliases are bounded, and indexing does not drop valid rows.

## Prospect Opportunity Cost verification

Treat blank Prospect Opportunity Cost as potentially downstream from the zero-prospect defect. After archetype repair, verify the accepted formula against canonical prospect populations before proposing formula changes.

## V5.5B-6G3: Evidence Sufficiency and Composite Missingness Repair

Prevent extreme missingness from raising a player through renormalization of the few remaining components. Define a generic, archetype-aware sufficiency boundary using reviewed approaches such as minimum usable evidence, confidence-adjusted shrinkage, bounded outcomes, or `INSUFFICIENT_EVIDENCE`.

- Missing production remains missing, never numeric zero.
- Missing Statcast lowers confidence.
- Partial evidence remains usable when sufficient.
- Prospects without MLB production are not treated as zero-production MLB players.
- A zero-confidence player cannot rank as elite solely because missing components were omitted.

## Deferred calibration review

After G1-G3 and deterministic fixtures pass, rerun the demonstrated population and pairwise cases. Assess Age/Trajectory only if it still structurally overwhelms current value across populations. Assess reliever confidence only after Statcast resolution is repaired; do not add a closer bonus because canonical Fantrax production already contains league saves/holds value.

Named players from acceptance, including Sal Stewart, Manny Machado, Juan Soto, Ronald Acuna Jr., Francisco Lindor, and Brice Turang, are regression examples only. No branch, threshold, formula, or weight may target a named player or force a preferred ordering.

## Suggested slicing

- V5.5B-6G1: Archetype Classification Repair
- V5.5B-6G2: Statcast Canonical Input Repair
- V5.5B-6G3: Evidence Sufficiency / Composite Missingness Repair
- V5.5B-6G4: Post-Repair Real-Player Recalibration

Create a later slice only when evidence from the prior slice justifies it.

## Real-player acceptance gate

After repairs are implemented, reviewed, checkpointed, and deployed through the trusted immutable path, rerun real-player calibration. Acceptance must demonstrate meaningful near-MLB and distant prospect populations, nonzero Statcast coverage where persisted evidence exists, populated Underlying Skill and applicable Prospect Opportunity Cost, no elite inflation of zero-confidence/missing-production rows, justified Age/Trajectory behavior, and reliever confidence reassessed after evidence repair.

Only that acceptance may return `PASS` or retain `CALIBRATION_REQUIRED`. Until then, V5.5C remains blocked.

## Safety boundaries

Do not persist Player Intelligence, alter Fantrax production, refresh Statcast to mask a read defect, modify MLBAM identity, ownership, or rosters, recalculate Engine 5.1.1, create a migration without a separately proven and reviewed schema deficiency, or activate V5.5C.
