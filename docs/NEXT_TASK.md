# Next Task: V5.5B-6F Trusted Default-Branch Deployment Workflow

## Status and authority

- V5.5B-6E immutable module-graph implementation is checkpointed at `bbf9369213b7eb4606c63c7541369a7d7e0d8c6a`.
- V5.5B-6F registration review is checkpointed at `797c9de10a1897f380ed07142fc693fa75718c88` with classification `REGISTRATION_ARCHITECTURE_REQUIRES_REVIEW`.
- Proven defects are `MAIN_PUSH_WOULD_DEPLOY` and `TARGET_CODE_ENTERS_PAGES_TRUST_BOUNDARY`.
- Calibration remains `REAL_PLAYER_ACCEPTANCE_REQUIRED`; V5.5C remains blocked.
- This task authorizes local feature-branch implementation and validation only. It does not authorize modifying main, deploying, or retrying calibration.

## Objective

Design and implement the minimum trusted deployment infrastructure whose security model is:

```text
TRUSTED MAIN WORKFLOW
  + TRUSTED MAIN PACKAGER
  + TARGET SHA AS STATIC INPUT ONLY
```

The target application commit must never execute code merely because it is being packaged.

## Workflow and privilege contract

1. The acceptance workflow must use `workflow_dispatch` only. It must not contain a push-to-main trigger, so registering or updating it on main cannot deploy Pages.
2. Code executed with `pages: write` or `id-token: write` must come only from trusted default-branch deployment infrastructure.
3. Prefer an explicit full 40-character target SHA input. If a ref is accepted for convenience, resolve it once to an exact SHA before packaging and use only that resolved SHA afterward.
4. The resolved SHA must drive the separate target checkout, `/v5-builds/<sha>/` directory, trusted manifest commit identity, and acceptance evidence.
5. Keep trusted infrastructure and target input in separate directories. The workflow must preserve its main-sourced packager while checking the target SHA into a separate static-input directory.
6. Never import, invoke, source, or otherwise execute target-provided scripts, hooks, package lifecycle code, workflow code, or equivalent executable deployment tooling.

## Trusted packager contract

Implement a main-suitable trusted packager accepting only:

- target directory;
- exact resolved target SHA; and
- output directory.

It may copy approved static application content, statically parse JavaScript, construct the immutable V5 tree, validate the module graph, hash actual emitted bytes, and generate trusted deployment metadata. It must not execute target JavaScript or accept a target-supplied manifest as integrity evidence.

Define an explicit target-content allowlist containing only the required hosted application files: the V5 static application tree and each shared root static dependency proven necessary. Exclude `.git`, tests, documentation unrelated to the hosted application, local tooling, arbitrary scripts, repository-only configuration, and secrets.

## Path and input safety

Treat the target checkout as untrusted input. Fail closed on:

- `..` traversal or absolute target/output paths;
- input paths outside the resolved target root;
- generated paths escaping the output/deployment root;
- symlinks or junctions escaping the target root;
- unsupported file types or missing required static files;
- malformed or non-full target SHAs; and
- any attempt by target content to override generated deployment evidence.

Adopt and test an explicit symlink policy. The preferred policy is rejection of symlinks and junctions in copied input.

## Module and manifest invariants

Preserve all V5.5B-6E guarantees:

- immutable `/v5-builds/<exact-target-sha>/` namespace;
- complete required V5 and shared static dependency graph;
- every local V5 import remains within the same SHA namespace;
- no mutable `/v5/...` or `/js/...` JavaScript fallback;
- named-import contracts resolve, including `finishAutomatedStatcastJob` from `importJobRepository.js`;
- emitted-byte SHA-256 values match the trusted manifest; and
- different SHAs produce different non-colliding paths.

The trusted packager, not target content, generates the manifest from emitted bytes. The manifest must include exact target SHA, emitted paths, and SHA-256 hashes.

## Minimum main installation boundary

During local implementation, determine and document the smallest future main file set, expected to be the dispatch-only workflow and trusted packager only. Do not copy Player Intelligence application code, feature documentation, unrelated tests, or application changes to main.

Sequence is mandatory:

1. implement locally on `feature/manager-intelligence`;
2. run focused security/integrity tests and the required broader suite;
3. stop for architect review;
4. checkpoint the approved feature implementation;
5. obtain separate authorization for file-level installation on main;
6. verify registration produces no deployment side effect; and
7. only then schedule immutable hosted acceptance.

## Required regression coverage

Prove:

1. workflow is dispatch-only and has no push-to-main trigger;
2. target input resolves to an exact full SHA;
3. trusted packager source remains separate from the target checkout;
4. target scripts are never executed;
5. target and trusted roots are separate;
6. traversal, absolute paths, escaping symlinks/junctions, and output-root escape are rejected;
7. the target allowlist excludes repository/tooling content;
8. namespace and manifest use the exact target SHA;
9. the trusted packager generates and controls the manifest;
10. a target-supplied manifest cannot override trusted evidence;
11. the emitted module graph remains commit-coherent;
12. named imports and the Statcast finalizer contract resolve;
13. mutable module fallbacks are rejected;
14. different SHAs produce distinct paths; and
15. registering the workflow cannot itself deploy Pages.

Run focused workflow, packaging, path-security, manifest, module-graph, startup/import-contract, architecture, auth, Statcast, Data Health, and Player Intelligence inspection regressions; then the complete `tests/*.test.mjs` suite, JavaScript syntax checks, deterministic reproducibility checks, and `git diff --check`.

## Semantic and operational boundaries

Do not modify Player Intelligence, Engine 5.1.1, Statcast or Fantrax behavior, authentication, Data Health, application semantics, identity, ownership, roster state, metrics, scores, schema, or migrations. Do not deploy, modify main, retry calibration, access production application data, run imports/refreshes/synchronization, persist data, or implement V5.5C.

Update `docs/NEXT_TASK_RESULT.md` with the trust architecture, exact main file set, security evidence, tests, files changed, and remaining installation/hosted-acceptance gates. Stop uncommitted for architect review unless separately authorized to checkpoint.
