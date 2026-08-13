# Next Task: V5.5B Player Intelligence Engine 2.0 Audit And Architecture

## Status And Authority

- V5.5A implementation is complete; its first coordinated production refresh remains unexecuted and live acceptance is suspended on external exact-artifact publication.
- V5.5B is active. This task is documentation-only audit and architecture.
- Do not change scoring formulas, application code, tests, schema, calculated scores, metrics, identity, ownership, roster state, imports, or Fantrax behavior.
- V5.5C remains the separate Waiver vs. Roster Decision Engine.

## Objective

Design an explainable player-intelligence foundation for the actual Reddit Phanatics scoring and roster environment—not a generic dynasty ranking. Audit every active and legacy player-value calculation, inventory trustworthy current data, identify league-specific gaps, and define small implementation slices that V5.5C can consume.

## Required Audit

1. Inventory Dynasty Asset Score, league fit, championship impact, liquidity, scarcity, appreciation, risk, prospect, roster-pressure, replacement-level, waiver/ranking, recalculation, HKB, Statcast, and Fantrax-stat logic. Record file/function, inputs, formula, weights, scale, persistence, league specificity, active/legacy status, weaknesses, and tests.
2. Compare current logic with documented Reddit Phanatics value drivers for hitters, pitchers, positional scarcity, defensive opportunity, role stability, dynasty timelines, prospect risk, and roster-slot opportunity cost.
3. Inventory usable Fantrax, Statcast, HKB, MLB Stats API, player, roster, score, and internal fields with identity, coverage, and freshness limitations. Do not build ingestion.
4. Design explainable components for league production, underlying skill, role stability, positional/defensive value, age trajectory, prospect risk, market evidence, replacement advantage, and future roster fit.
5. Separate floor, expected value, ceiling, and confidence. Define evidence-based breakout, regression, role, scarcity, replacement, and prospect signals.
6. Design actual league replacement levels by eligible position using teams, lineup slots, active/reserve depth, rostered players, free agents, and production. Treat multi-position eligibility explicitly.
7. Design prospect opportunity cost with `PROTECTED`, `INVESTMENT`, and `CHURN` classifications without hard-coded player bonuses.
8. Propose an auditable output contract and identify whether existing `calculated_player_scores` can hold it. Do not create a migration during audit.
9. Define a calibration set from documented players and representative roles, then specify V5.5C handoff requirements.

## Deliverable

Update `docs/NEXT_TASK.md`, `docs/NEXT_TASK_RESULT.md`, `docs/CURRENT_STATE.md`, and `docs/ARCHITECTURE_DECISIONS.md` with the evidence-backed audit and a concrete sliced implementation plan. Run `git diff --check`, commit documentation only, push `feature/manager-intelligence`, and stop for architect review.
