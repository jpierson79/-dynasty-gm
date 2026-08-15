# Next Task: V5.5B-6E Deployment Module-Graph Integrity Repair

## Status and authority

- V5.5B-6D is complete at diagnosis commit `00fef1770d066101be2a34c5b502a790b06a531a`.
- Accepted diagnosis: `MIXED_VERSION_MODULE_GRAPH_CONFIRMED`.
- Retained Pages artifact result: `ARTIFACT_MATCHES_COMMIT` for feature commit `7130399b4162989e5b1f6ed893e3158f2e411b23` after line-ending normalization.
- Calibration remains `REAL_PLAYER_ACCEPTANCE_REQUIRED`; V5.5C remains blocked.
- This task authorizes local deployment-integrity implementation only. Deployment and calibration remain separately gated.

## Objective

Guarantee architecturally that one hosted V5 session cannot assemble JavaScript modules from more than one deployment version. Replace mutable cross-deployment module identity with a deterministic, inspectable, immutable deployment namespace without changing application behavior.

## Required architecture

Prefer immutable commit-versioned static asset paths, conceptually:

```text
/v5-builds/<commit-sha>/index.html
/v5-builds/<commit-sha>/js/main.js
/v5-builds/<commit-sha>/js/services/...
/v5-builds/<commit-sha>/js/repositories/...
/v5-builds/<commit-sha>/js/views/...
```

Preserve the V5 relative directory structure so every nested relative ES-module import remains within the same immutable `/v5-builds/<commit-sha>/` namespace. An equivalent immutable namespace is acceptable only when required by existing Pages packaging and proven equally coherent.

Mutable asset URLs such as `/v5/js/main.js`, `/v5/js/services/foo.js`, and `/v5/js/repositories/bar.js` are unsafe across feature/main publications because caches can combine valid bytes from different commits. Immutable URLs may remain cacheable; commit identity makes cached bytes correct for that URL.

## Prohibited partial fixes

- Do not rely only on `main.js?v=<commit>`. Native nested relative imports do not inherit the entry query token.
- Do not manually edit version strings throughout source files for each deployment.
- Do not version only selected modules or allow nested imports to fall back to mutable `/v5` paths.
- Do not rename, duplicate, or modify `finishAutomatedStatcastJob`; its source contract is valid.

If copying the complete V5 tree under an immutable root is infeasible, build-time rewriting/version propagation across every static import may be considered only with evidence that it is safer and complete.

## Deterministic packaging and entry point

Implement deterministic packaging that:

1. determines the exact deployment commit SHA;
2. copies/builds the complete V5 static tree into the immutable version namespace;
3. preserves relative module resolution within that namespace;
4. generates an integrity manifest;
5. publishes the exact static artifact; and
6. routes the hosted entry to the selected versioned `index.html` without importing a versioned entry whose nested modules resolve to mutable paths.

The hosted inspection surface must expose the exact deployment commit before calibration begins. A small generated root redirect/loader is permitted only if it selects one explicit immutable version and cannot mix module roots.

## Integrity manifest

Generate deterministic deployment evidence containing at minimum:

- exact deployment commit SHA;
- emitted module path; and
- SHA-256 of emitted bytes.

Prioritize the complete V5 static dependency graph and make the manifest inspectable during hosted acceptance. It is deployment evidence, not a runtime scoring feature.

## Static module-graph regression

Add tooling/tests that walk or validate the emitted V5 static module graph and prove:

1. every named import resolves;
2. every emitted module belongs to the selected deployment namespace;
3. nested import resolution cannot fall back to mutable shared V5 asset URLs;
4. no accidental unversioned cross-deployment import is introduced; and
5. `main.js`, `statcastProviderService.js`, `importJobRepository.js`, and `playerIntelligenceInspectionService.js` match the same manifest/commit.

## Pages workflow and restoration

Preserve the approved ability to publish an exact feature artifact temporarily and restore GitHub Pages to the approved `main` application afterward. The workflow must make the deployed SHA, immutable namespace, integrity-manifest SHA, and restored SHA easy to verify. A feature acceptance deployment must never remain active after acceptance.

## Hosted acceptance contract

After local validation, architect review, and checkpointing, a separate hosted acceptance must verify:

- exact feature commit and immutable namespace;
- integrity-manifest SHA and sampled module hashes;
- coherent `main.js`, Statcast service, import-job repository, and Player Intelligence inspection service bytes;
- no sampled module matches restored/older `main` bytes;
- normal V5 startup completes; and
- Pages restores to the approved `main` commit.

Only after module integrity and startup pass may real-player calibration be retried. V5.5B-6E itself cannot produce calibration `PASS`.

## Semantic invariants and boundaries

Do not change Statcast collection/refresh behavior, import-job lifecycle, protected baselines, Player Intelligence formulas/weights/thresholds/archetypes/performance architecture, Fantrax behavior, Data Health semantics, authentication, league scoping, Engine 5.1.1, or production data semantics.

Implementation may modify only deterministic static packaging/build tooling, GitHub Pages deployment workflow, immutable versioned paths, root/version-selection plumbing, integrity evidence, and static module-graph tests.

Do not deploy, retry calibration, run imports or refreshes, persist Player Intelligence, modify `player_metrics` or `calculated_player_scores`, modify identity/ownership/roster state, implement waiver logic, or create migrations during the local implementation checkpoint.

## Validation and handoff

Run focused packaging, manifest, module-graph, startup-import, architecture, auth, Statcast, Data Health, and Player Intelligence inspection regressions; then the complete `tests/*.test.mjs` suite, relevant syntax checks, deterministic build reproducibility checks, and `git diff --check`.

Update `docs/NEXT_TASK_RESULT.md` with emitted structure, deployment identity, manifest/hash evidence, graph validation, semantic-preservation evidence, tests, files, and remaining hosted acceptance. Stop uncommitted for architect review unless separately authorized to checkpoint.

Sequence after implementation: local validation, architect review, checkpoint, exact immutable hosted deployment acceptance, coherent module/startup verification, real-player calibration retry, and only then a possible V5.5C unblock after calibration `PASS`.
