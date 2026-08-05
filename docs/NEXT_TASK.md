# Next Task: V5.4.6C Fantrax Season Rollover Safety

## Architect Status

- Status: ready for Codex implementation.
- Architect baseline branch: `feature/manager-intelligence`.
- Architect baseline commit: `35bede60e9330ee0a30b8be1ced72b6b293f5c27` (`feat(v5): harden reviewed Fantrax roster sync`).
- Prepared: 2026-08-05 America/Chicago.
- This document authorizes implementation only after Codex repeats the repository preflight. It does not authorize migrations, deployments, cloud writes, imports, or a broader roster-status synchronization.

## Why This Is Next

V5.4.6B-2 through B-4 are implemented and controlled-production accepted for an exact three-player status-only subset. The remaining 557 eligible status rows require a new exact review and explicit user authorization; they are not an unfinished implementation phase.

The unresolved architectural risk is season rollover. Fantrax team IDs were proven consistent across endpoints and tested periods within the configured 2026 league, but cross-season stability is not proven. The current preview accepts a bare 16-character external league ID, keeps it only in browser state, and does not bind the reviewed team mappings or status-apply eligibility to a verified Fantrax season. Reusing stale mappings after a season change could attach a valid external team ID to the wrong season context.

## Objective

Add a fail-closed, read-only-first season rollover guard around the existing Fantrax preview, team-identity review, and roster-status apply workflow. The application must identify the season returned by Fantrax, compare it with the last explicitly reviewed season context, visibly report rollover or configuration drift, and block all team-identity and roster-status writes until the new season context and all team mappings have been explicitly reviewed.

## Required Preflight

Before editing:

1. Read every applicable `AGENTS.md` plus `docs/PROJECT_MEMORY.md`, `docs/CURRENT_STATE.md`, `docs/ARCHITECTURE_DECISIONS.md`, `docs/WORKFLOW.md`, this file, and the previous `docs/NEXT_TASK_RESULT.md` if it contains a completed report.
2. Verify the active branch, exact HEAD, remote tracking state, and working tree.
3. Stop if the baseline has moved in a way that supersedes this phase, or if unrelated dirty files overlap the required work.
4. Inspect the current Fantrax Edge Function normalization, preview state, team identity service/repository, roster sync service/repository, Data Health diagnostics, views, and focused tests before designing changes.
5. Record the verified baseline in `docs/NEXT_TASK_RESULT.md`.

## Scope

### 1. Define a canonical season context

Create a small domain/service model derived only from normalized Fantrax league information. It must include:

- the exact external league ID supplied for the preview;
- the returned `seasonYear` as a validated integer;
- the returned league-history identity when the documented response supplies one;
- an explicit representation for unavailable optional identity rather than guessing it;
- a deterministic comparison result such as `MATCH`, `UNREVIEWED`, `ROLLOVER`, or `INVALID`.

Do not infer season from the current date, scoring-period number, team names, or cached application data. Do not treat a historical scoring-period selection as a season identity.

### 2. Persist only reviewed configuration through the existing application configuration boundary

Inspect the current league/settings persistence model and choose the narrowest repository-consistent location for reviewed Fantrax season context. If durable cloud schema is genuinely required, design a migration and tests locally, but do not apply it remotely. Do not add credentials, cookies, `userSecretId`, arbitrary URLs, or raw Fantrax payloads.

Any save must be an explicit, separately confirmed configuration action. A preview fetch remains read-only. The write payload must contain only the reviewed Fantrax integration fields required by the selected design and must be constrained to the active application league.

### 3. Fail closed on drift and rollover

When no reviewed season context exists, or when the fetched league/season context differs from it:

- keep preview and diagnostics available;
- show the expected and observed external league and season identities;
- block team-identity saves;
- block roster-status review and final apply in both UI and service-level validation;
- clear any pending team mapping review, roster selection, acknowledgement, and confirmation state when the context changes;
- never clear, rewrite, or auto-remap existing `teams.fantrax_team_id` values.

An explicit scoring period must continue to trigger the independent B-4 historical-period block even when season context matches.

### 4. Add a reviewed rollover workflow

For a new or changed season context, require the user to:

1. review the returned league name, external league ID, season year, optional league-history identity, and full external team list;
2. acknowledge that existing team identities are not assumed stable across seasons;
3. review a complete one-to-one mapping for every active cloud team using authoritative IDs; and
4. confirm the season context and mappings in a final summary before any configuration write.

Team names, manager names, roster overlap, and prior mappings may be displayed as suggestions only. They must never be accepted automatically. Duplicate, missing, cross-league, ambiguous, or incomplete mappings block confirmation.

After a successful reviewed save, refresh league data and Fantrax preview before enabling any status review. A rollover review does not itself apply roster statuses.

### 5. Extend Data Health

Add diagnostics for:

- reviewed versus observed external league ID;
- reviewed versus observed season year;
- optional league-history identity availability and mismatch;
- season-context review status;
- complete, unique team mapping coverage for the reviewed season;
- whether team-identity and roster-status writes are currently blocked and why.

Routine Data Health rendering must not initiate new Fantrax network calls. Reuse already loaded preview/configuration data and distinguish unavailable evidence from a passing check.

### 6. Preserve all existing guards

The implementation must preserve:

- exact `*API_ID*` player-ID transformation and validation;
- no name, fuzzy, or MLBAM fallback for Fantrax API identity;
- separation of ownership, free-agent state, and roster status;
- exact status normalization with unknown values routed to review;
- manual override protection and database-stamped audit behavior;
- expected owner/current status/manual provenance write-time guards;
- current-period-only roster synchronization;
- empty-by-default selection, one-to-three-player controlled selection, review acknowledgement, and separate final confirmation;
- partial failure and reasoned-skip reporting;
- no player/team creation, identity merging, ownership repair, or score recalculation.

## Explicitly Out of Scope

- Applying any of the remaining 557 roster-status recommendations.
- Increasing or removing the controlled one-to-three-player apply limit.
- Automatically accepting previous team mappings for a new season.
- Automatically changing ownership or free-agent state.
- Player-level Fantrax fantasy-point ingestion.
- Fantrax authentication, browser cookies, Selenium, Python Fantrax clients, `/fxpa/req`, or private endpoints.
- Remote migration application, Edge Function deployment, production configuration writes, imports, or any production acceptance write without a separate explicit authorization.
- Broad UI redesign or unrelated authentication/import changes.

## Required Tests

Add focused synthetic tests that prove at minimum:

1. canonical season context accepts valid normalized league evidence and rejects missing/invalid season identity;
2. matching reviewed and observed context permits the existing gates to continue evaluating;
3. missing review, external league drift, season-year rollover, and available league-history mismatch each fail closed;
4. preview remains readable while configuration/team/status writes are blocked;
5. changing league ID, season context, or period clears pending review/confirmation/selection state;
6. a historical scoring period remains blocked independently of the season guard;
7. rollover confirmation requires complete one-to-one team mappings and rejects duplicates, cross-league rows, and incomplete coverage;
8. names and roster overlap remain non-authoritative suggestions;
9. reviewed configuration writes are league-scoped and field-limited;
10. Data Health reports match, unreviewed, rollover, invalid, and unavailable states without issuing new Fantrax reads;
11. the existing B-2 through B-4 roster-sync, team-identity, manual-override, preview, and Data Health regression tests still pass.

Run focused tests first, then the complete repository test suite. If a migration is created, add static SQL tests for constraints, RLS compatibility, idempotence, and documented rollback, but do not apply it.

## Validation And Acceptance

Codex must complete local implementation and automated validation, then stop before any remote or production operation requiring separate authority.

Local acceptance requires:

- a clean reload with no console errors;
- a matching current-season preview that accurately shows the reviewed state;
- a synthetic or safely mocked rollover showing preview access but blocked team/status writes;
- explicit complete remapping and final confirmation behavior;
- retained B-4 historical-period blocking;
- responsive review and confirmation controls;
- Data Health results that explain every block without claiming unverified success.

Do not claim live or production acceptance unless it was separately authorized and actually performed.

## Documentation And Handoff

When implementation is complete:

1. Update `docs/CURRENT_STATE.md` with verified facts and remaining operational steps.
2. Update `docs/PROJECT_MEMORY.md` and `docs/ARCHITECTURE_DECISIONS.md` only for durable, evidence-backed decisions.
3. Replace the template content in `docs/NEXT_TASK_RESULT.md` with the completed report described there.
4. Report every changed file, unrelated dirty file, exact test command/result, browser validation, and every operation not performed.
5. Commit and push only if the active user instruction explicitly authorizes them. Report the exact commit SHA and push result.

## Definition Of Done

V5.4.6C is complete only when season context is explicit, reviewed, durable through the chosen application boundary, and enforced as an independent fail-closed guard for both team identity and roster-status writes; rollover requires complete reviewed team remapping; existing B-series protections pass regression; local UI/Data Health acceptance passes; and no unauthorized production operation has occurred.
