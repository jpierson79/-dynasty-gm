# Current State

## V5.5B-6G0A Prospect Level Production Acceptance Resumed With G0F Diagnostics (2026-08-27)

- V5.5B-6G0E is **COMPLETE / CHECKPOINTED** at implementation commit `cecbe15baa057a86a5cfc1da7a564ae23ac4534d` with documentation checkpoint `dee21ca57539caa9eaf484cbfb98011a9ce4151e`.
- The proven G0E cause was collection-level `fetchedAt` masquerading as factual `level_observed_at`. The accepted repair preserves null first-time no-timestamp evidence and existing factual timestamps, keeps collection time in audit metadata, and provides canonical five-field timestamp/JSONB-aware equality with deterministic change reasons.
- V5.5B-6G0F is **COMPLETE / CHECKPOINTED** at application commit `f67088c84eb79eab227a4a5759a37269e6c9f631` with documentation checkpoint `19366eb505d903d02de61cf3cc07590b8a7130db`. Its hosted surface displays planner-provided five-reason counts and bounded stored/incoming evidence without independent semantic comparison, provider recollection, or persistence.
- The active task is **V5.5B-6G0A Prospect Level Production Acceptance — RESUMED WITH G0F DIAGNOSTICS**, authorized for controlled post-migration, primarily read-only acceptance using the exact immutable G0F application artifact.
- Production is already post-migration: Migration 014 and Migration 015 are **APPLIED**. The initial governed population completed **5,440 successful / 0 failed / 0 unattempted** player writes, audit finalization completed, and protected comparison passed. A second Apply was not performed and is not authorized merely to prove idempotency.
- The latest resumed G0A Preview reported **5,398 exact UUID/MLBAM matches, 24 unverified updates, 5,374 no-ops, 0 invalid/stale, and 0 warnings/errors**. Data Health reported zero failures and 42 warnings; protected comparison passed unchanged; Review and Apply were not performed.
- The 24 historically observed updates remain unverified until a fresh Preview and complete G0F diagnostic inspection. G0A must not automatically Review or Apply them.
- G1 remains **BLOCKED PENDING RESUMED G0A**. Calibration remains **`CALIBRATION_REQUIRED`** and V5.5C remains **BLOCKED**.
- This governance handoff is documentation-only. It does not deploy, access production, run Preview/Review/Apply, reapply migrations, or mutate data.

## V5.5B-6G0E Prospect Level Idempotency Repair Completed (2026-08-24)

- This historical section records the now-completed local repair of the canonical prospect-level planner equality boundary; the active authority is the resumed G0A section above.
- G0A completed one governed population Apply for **5,440 / 5,440** exact UUID/MLBAM matches. Player writes and audit finalization completed, and protected-domain comparison passed. No second Apply occurred.
- G0A was **BLOCKED ON G0E / IDEMPOTENCY** because the mandatory fresh post-Apply Preview reported 5,440 updates and zero no-ops for already-persisted evidence.
- Migration 014 and Migration 015 are **APPLIED**. Production is not pre-migration, and the 5,440 successful writes remain present.
- G0E must identify the exact differing field among `current_level`, `level_source`, `level_availability`, `level_observed_at`, and `level_raw_evidence`; establish canonical semantic comparison; and preserve factual-change, stale-evidence, conflict, identity, five-field mutation, batching, retry, audit, protected-baseline, G0C, and G0D boundaries.
- G1 remains **BLOCKED**. Data Health and canonical Player Intelligence production-input acceptance remain pending G0A gates. Calibration remains **`CALIBRATION_REQUIRED`** and V5.5C remains **BLOCKED**.
- This activation is documentation-only; no deployment, provider collection, production/cloud access, migration, or data mutation occurred.

## Historical V5.5B-6G0A Pre-Migration Activation (2026-08-24)

- V5.5B-6G0D is **COMPLETE / CHECKPOINTED** at implementation commit `f9079ddc7174ad5f0ab87ccdf713fa099df0e1ce` with documentation checkpoint `1476d98a352507a45299e51553df9fbe0c80ce91`. Mandatory bootstrap no longer requires Migration 014; optional prospect evidence is UUID-joined in bounded batches with `SCHEMA_ABSENT`, `PRESENT`, and fail-closed partial/error semantics.
- At that historical activation, the task was **V5.5B-6G0A Prospect Level Migration / Data Population Acceptance**, authorized for the then-required ordered pre-migration sequence. The current authority is the G0F section at the top of this file.
- Production mutation is restricted to the five prospect-level evidence fields on existing exact UUID/MLBAM matches, with trigger-driven `updated_at`, batches of at most 250, and normal authenticated league-scoped controls. No player creation, name authority, identity, ownership, roster, score, or other protected mutation is authorized.
- Migration 014 and Migration 015 were **CREATED / NOT APPLIED** at that historical activation; both are now applied as recorded in the current section above. G1 was blocked pending G0A; calibration was `CALIBRATION_REQUIRED`; V5.5C was blocked.
- Any failed gate stops acceptance. Application/migration repair, ad hoc SQL, service-role bypass, provider inference, G1 implementation, model changes, and V5.5C activation are outside this acceptance.

## V5.5B-6G0D Pre-Migration Schema-Absence Bootstrap Completed (2026-08-23)

- V5.5B-6G0, G0B, and G0C are complete/checkpointed. The latest G0A production acceptance is checkpointed as **BLOCKED ON PRE-MIGRATION SCHEMA-ABSENCE BOOTSTRAP**; Migration 014 and Migration 015 remain created and unapplied.
- The exact G0C artifact authenticated and selected Reddit Phanatics, but the required pre-migration `PROSPECT_LEVEL_POPULATION` capture could not complete because normal league loading failed with `player intelligence paged query: column players_1.current_level does not exist`. Pages was restored to approved main and no migration or production-data write occurred.
- The completed task separated guaranteed core player/league bootstrap fields from optional Migration 014 evidence so complete absence reports `SCHEMA_ABSENT`, complete presence reports `PRESENT`, and partial schema or unrelated errors fail closed.
- Pre-migration authentication, league loading, Cloud Imports/Data Health navigation, protected-baseline capture, identity, ownership, roster behavior, and pagination must remain intact. Player Intelligence may expose missing factual level evidence but must not infer it from age, minor status, Fantrax, HKB, Statcast, names, or roster heuristics.
- G0D completed local implementation, testing, architect review, and checkpointing. G0A must restart from the beginning with a fresh immutable deployment and deterministic pre-migration baseline before either migration is applied.
- G0A is now blocked on G0F under the newer section above. Calibration remains **`CALIBRATION_REQUIRED`**; G1 remains **BLOCKED**; V5.5C remains **BLOCKED**.

## V5.5B-6G0C Prospect Level Population Workflow Activated (2026-08-15)

- G0 and G0B are checkpointed. G0A stopped safely before deployment, cloud access, or migration because no reviewed canonical prospect-level population workflow exists; that blocker evidence is checkpointed.
- The active task is **V5.5B-6G0C Prospect Level Population Workflow**, a local-only implementation of a preview/review/apply path using the accepted MLB provider, canonical level normalizer, existing player UUIDs, exact MLBAM identity, normal RLS, and fixed `PROSPECT_LEVEL_POPULATION` protection.
- Preview must be read-only and bind user, league, provider snapshot, exact identity/normalized evidence, write plan, and baseline readiness. Apply requires explicit review, rejects drift, and remains blocked while Migration 014 is absent.
- Persistence is limited to the five Migration 014 level fields on existing UUID rows, in batches of at most 250; `updated_at` is trigger-driven. No player creation, name matching, upsert, identity, ownership, roster, age, position, organization, or `is_minor_leaguer` mutation is permitted.
- Outcomes must expose completed/partial/failed batches and UUID-level success/failure evidence. Identical evidence must preview as no-op. The UI must separate preview, approval, and apply and expose no profile selector or auto-apply.
- Migration 014 remains unapplied. Calibration remains **`CALIBRATION_REQUIRED`**; G1 remains **`BLOCKED ON PROSPECT LEVEL EVIDENCE FOUNDATION`**; V5.5C remains **BLOCKED**.

## V5.5B-6G0B Prospect Level Protected Baseline Profile Activated (2026-08-15)

- V5.5B-6G0 is checkpointed. Migration 014 remains unapplied, additive, and scoped to five prospect-level evidence columns.
- V5.5B-6G0A stopped safely before migration, schema verification, provider collection, preview, population writes, Data Health, or canonical-input checks because no canonical prospect-level-population protected-baseline profile exists. The blocker evidence is checkpointed.
- The active task is **V5.5B-6G0B Prospect Level Protected Baseline Profile**. Its proposed provider-neutral profile is `PROSPECT_LEVEL_POPULATION`.
- The future profile must derive its exact allowed set from Migration 014: `current_level`, `level_source`, `level_availability`, `level_observed_at`, and `level_raw_evidence`. `is_minor_leaguer` remains protected. Whether `updated_at` is protected or expected mutable must be proven from the canonical write path; protection is preferred.
- Baseline capture must work before Migration 014 is applied, separate protected player evidence from expected-mutable evidence, protect scores/metrics/teams/managers/settings and all other domains, use normal authenticated league-scoped RLS, and preserve fail-closed comparison states.
- Existing `STRICT`, `MLBAM_BACKFILL`, `STATCAST_REFRESH`, and `FANTRAX_PRODUCTION_IMPORT` semantics remain independent and unchanged.
- Calibration remains **`CALIBRATION_REQUIRED`**. G1 remains **`BLOCKED ON PROSPECT LEVEL EVIDENCE FOUNDATION`** and V5.5C remains **BLOCKED**. After G0B is validated, reviewed, and checkpointed, G0A may restart.

## V5.5B-6G0 Prospect Level Evidence Foundation Activated (2026-08-15)

- V5.5B-6G1 stopped before editing with status **`BLOCKED ON PROSPECT LEVEL EVIDENCE FOUNDATION`**, not failed.
- The immediate repository/input defect is proven: `v5/js/repositories/playerIntelligenceRepository.js` does not load `players.is_minor_leaguer`, so canonical input normalizes the missing value to false and young non-MLB players can fall through to the age-based `YOUNG_MLB_OR_RECENT_CALLUP` rule.
- Restoring that boolean alone is insufficient. The current schema does not preserve authoritative minor-league level, the importer collapses level/minors/prospect evidence into a boolean, and canonical Player Intelligence sets level/readiness to null. AAA/AA therefore cannot safely be distinguished from A+/A/Rookie/Complex/DSL.
- The active task is **V5.5B-6G0 Prospect Level Evidence Foundation**: establish provider-neutral factual minor-league status, current level, source, freshness/availability, and unknown-state evidence before resuming archetype classification.
- Provider review must start with accepted capabilities, prioritizing MLB Stats API organizational/roster evidence and preserving explicit accepted import evidence when available. Fantrax must not be forced into level authority if its reviewed data lacks level.
- G0 must determine whether the existing schema can safely store canonical level evidence. Any required migration must be separately implemented and reviewed, additive, non-destructive, RLS-safe, identity-preserving, and must not rewrite ownership or rosters.
- Missing evidence remains unknown. Age, HKB, Fantrax production, Statcast, names, and reputation cannot infer level.
- Calibration remains **`CALIBRATION_REQUIRED`** and V5.5C remains **BLOCKED**. After G0 is locally validated, reviewed, and checkpointed, work resumes with G1, then G2, G3, and G4.

## V5.5B-6G Real-Player Calibration Repair Foundation Activated (2026-08-15)

- Immutable deployment integrity is **PASS** for target `7130399b4162989e5b1f6ed893e3158f2e411b23` through trusted workflow run `31906306902`: the 120-file manifest verified, the immutable module graph passed, and the prior mixed-version defect was absent.
- Hosted inspection performance is **PASS** for the 10,363-player population. Inspection advanced `NOT_LOADED -> LOADING -> READY`, reported 21,832 ms application duration, completed in approximately 22.4 seconds, and completed a clean retry in approximately 28 seconds while the browser remained responsive and the console stayed clean.
- Pages restoration succeeded and normal Pages serves main commit `a60ce3455b6da5077f5e799307112f36fc6ab6e5`.
- Real-player calibration is **`CALIBRATION_REQUIRED`** because of six demonstrated structural defects: archetype collapse, unresolved persisted Statcast inputs, blank Prospect Opportunity Cost, missing-evidence composite inflation, potential Age/Trajectory dominance, and reliever confidence suppression.
- The active task is **V5.5B-6G Real-Player Calibration Repair Foundation**, ordered as: archetype/context classification; canonical Statcast resolution; Prospect Opportunity Cost verification; missing-evidence sufficiency; deterministic fixtures; then age/trajectory and reliever review; and only then possible weight review.
- Repairs must be generic and evidence-based. Named players are regression examples only and cannot authorize special cases or preferred-rank tuning.
- Preferred implementation slices are V5.5B-6G1 archetype classification, V5.5B-6G2 Statcast canonical input resolution, V5.5B-6G3 evidence sufficiency/composite missingness, and V5.5B-6G4 post-repair real-player recalibration. Each later slice requires evidence from the preceding work.
- V5.5C remains **BLOCKED** until post-repair immutable hosted acceptance produces a new calibration decision. Player Intelligence persistence, production refreshes/imports, identity/ownership/roster changes, Engine 5.1.1 recalculation, and unreviewed schema changes remain unauthorized.

## V5.5B-6F Trusted Deployment Workflow Activated (2026-08-15)

- V5.5B-6E immutable module-graph implementation is checkpointed at `bbf9369213b7eb4606c63c7541369a7d7e0d8c6a`. The registration blocker and trust-boundary review are checkpointed through `797c9de10a1897f380ed07142fc693fa75718c88`.
- The accepted review classification is **`REGISTRATION_ARCHITECTURE_REQUIRES_REVIEW`**. The prior workflow would deploy on registration because it contained a main push trigger, and it executed target-provided packaging code with Pages/OIDC privileges.
- Active task: **V5.5B-6F Trusted Default-Branch Deployment Workflow**. Required model: dispatch-only trusted main workflow, trusted main-sourced packager, and an exact target SHA checked out separately and treated only as static input.
- The implementation must reject traversal and escaping links, use an explicit hosted-content allowlist, generate its own manifest from emitted bytes, preserve the immutable module-graph guarantees, and never execute target scripts.
- Local feature implementation and validation must precede architect review and a separately authorized minimal file-level main installation. Registering the eventual workflow must not deploy Pages.
- Pages remains source `main`, path `/`, status `built`, at `df89840de0ea8563968b99b7acc75b528e02983f`. Calibration remains **`REAL_PLAYER_ACCEPTANCE_REQUIRED`** and V5.5C remains **`BLOCKED`**.
- No deployment, main modification, calibration retry, production/data access, import, refresh, persistence, synchronization, application/model change, or migration is authorized during activation.

## V5.5B-6E Activated (2026-08-14)

- V5.5B-6D Hosted Module Integrity Diagnosis is complete at commit `00fef1770d066101be2a34c5b502a790b06a531a` with classification **`MIXED_VERSION_MODULE_GRAPH_CONFIRMED`** and retained feature artifact result **`ARTIFACT_MATCHES_COMMIT`**.
- The feature source and retained artifact contained the canonical `finishAutomatedStatcastJob` export. Missing source/export, corrupted feature artifact, service worker, Workbox, application CacheStorage, and wrong repository import path are ruled out absent new evidence.
- The failure mechanism was mutable shared Pages asset URLs plus unversioned nested ES-module imports and an unchanged entry token under cacheable responses, allowing a newer service module to resolve an older `main` repository module.
- The active slice is **V5.5B-6E Deployment Module-Graph Integrity Repair**. Its preferred architecture copies the complete V5 tree into an immutable commit-versioned namespace such as `/v5-builds/<commit-sha>/`, preserving relative imports within that namespace and generating an inspectable deployment identity plus SHA-256 integrity manifest.
- Entry-only query tokens and manual per-import version strings are not accepted. Static graph tooling must prove named imports resolve and no emitted nested import can escape to mutable shared V5 paths.
- Calibration remains **`REAL_PLAYER_ACCEPTANCE_REQUIRED`**. V5.5C remains **BLOCKED** until module-integrity acceptance and a later real-player calibration `PASS`. Pages remains restored to approved `main` commit `df89840de0ea8563968b99b7acc75b528e02983f`.
- Deployment, calibration retry, imports, refreshes, production persistence, Player Intelligence or Engine 5.1.1 semantic changes, identity/ownership/roster changes, and migrations remain unauthorized during documentation activation.

## V5.5B-6C Activated (2026-08-14)

- V5.5B-5 is complete and checkpointed at implementation commit `bf781b2ecf20ff6915f97db564fea5cad806a840` and documentation commit `901d46c7f3fb6777d9f6db8be94d24885a44ed37`.
- Its accepted composite remains archetype-aware and confidence-adjusted. `NOT_APPLICABLE` is excluded without penalty, missing applicable evidence lowers confidence, Risk is transformed once through `riskSafety = 100 - risk`, Prospect Opportunity Cost remains `HIGHER_IS_BETTER_LOWER_COST`, scarcity remains subordinate to Replacement Advantage, HKB remains outside the MLB core score and bounded for prospects, and market divergence remains outside normalized floor/expected/ceiling. Engine 5.1.1 is unchanged.
- V5.5B-6B diagnosis is complete at commit `fda1c416f6dde1674afba4994b567302f45693fc`. It proved synchronous quadratic main-thread evaluation as the primary `LOADING` blocker and eager full-population rendering as a secondary post-evaluation scalability defect.
- The active slice is **V5.5B-6C Hosted Inspection Performance Repair**. It is limited to computational reuse, UUID-indexed evidence, reusable percentile/replacement contexts, bounded yielding with progress, and bounded/lazy rendering for the complete canonical population.
- All model formulas, weights, thresholds, archetypes, identities, replacement and market semantics, composite outputs, and Engine 5.1.1 remain unchanged. Calibration remains `REAL_PLAYER_ACCEPTANCE_REQUIRED`; V5.5C remains blocked pending a separately authorized real-player acceptance retry after the repair is checkpointed.
- Deployment, production refresh/import, persistence, Engine 5.1.1 replacement/recalculation, migrations, production waiver actions, and changes to metrics, scores, identity, ownership, or roster state remain unauthorized.

## V5.5B Production Foundation Reconciliation (2026-08-13)

- **V5.5B-1A-3 hosted acceptance remains INCOMPLETE.** Unresolved observability items are the post-import Data Health timeout, absence of the canonical FPts/FP-G input envelope in the normal Player Intelligence UI, and three CSV-worker fallback warnings. These are not recorded as resolved.
- **V5.5B-1A production data prerequisite is COMPLETE.** The reviewed 2026 Reddit Phanatics import completed with 10,326 exact identity matches and 10,326 inserted `Fantrax` / `fantrax_league_production` metric rows, with zero unmatched, conflicts, invalid, or failed rows.
- The idempotency preview reported zero inserts, zero updates, and 10,326 no-ops; no second apply was performed.
- Protected evidence proved players, calculated scores, protected non-production metrics, teams, and managers unchanged. Only the expected Fantrax league-production metric partition changed from zero to 10,326 rows.
- **V5.5B-2 local read-only development is UNBLOCKED** and may consume these canonical production rows for league-production, scarcity, and replacement calculations.
- V5.5B-2 production persistence, score replacement, production score recalculation, deployment, and production rollout remain unauthorized. Engine 5.1.1 remains the authoritative production scoring path.

Generated: 2026-08-01 America/Chicago.

## Active Direction — V5.5 Baseball Intelligence

- V5.4.6E Gate 4E-1 is **SUSPENDED**, not accepted. Exact feature commit `c120a2f941c2f2e132a794b85ccc0da0712c889f` could not be published because GitHub Pages workflow `31551384970` failed externally during Jekyll metadata retrieval with a TLS certificate-verification error; one bounded retry did not produce a verified hosted artifact.
- Pages was restored to `main` at `df89840de0ea8563968b99b7acc75b528e02983f`. No hosted Gate 4E-1 application acceptance or ten-player synchronization occurred, and no production/data writes were made during the suspended attempt.
- Fantrax synchronization work is frozen at its current safe checkpoint until deployment infrastructure is healthy or a verified production defect requires reopening it. Do not create another synchronization acceptance phase by default.
- Active roadmap:
  1. **V5.5A Automated Statcast Data Provider**
  2. **V5.5B Player Intelligence Engine 2.0**
  3. **V5.5C Waiver vs. Roster Decision Engine**
  4. **V5.5D Roster Churn / Protected-Investment-Churn Classification**
  5. **V5.5E Consolidation and Trade Target Intelligence**
- The immediate next task is V5.5A only: establish automated, MLBAM-authoritative Statcast collection, raw snapshot preservation, validation, normalized metric persistence boundaries, and Data Health/audit reporting. Production ingestion and V5.5B scoring remain separately gated.

## Git State

- Active branch: `feature/manager-intelligence`
- Current HEAD: `8291c980633c87840da05ebef3a98d46e32c767a`
- Current HEAD subject: `Add manual roster status override protection`
- Initial tracked working tree for V5.4.6B-2: clean; `.codex/` was already present as unrelated untracked workspace metadata.
- Recent completed commits:
  - `c11c84a` Stabilize V5 UI workflow and data health
  - `145e06a` Harden cloud imports and data workflow diagnostics
  - `ab8729a` Add V5 regression tests and cache refresh
  - `8aab34f` Preserve player identity during repeat Fantrax imports
  - `94fba81` Build Dynasty Front Office V5 through Trade Center
  - `8291c98` Add manual roster status override protection

The July 16 operational snapshot that described branch `fix/reliable-repeat-import`, HEAD `acee731`, and uncommitted import work is superseded by this section. That older state remains represented in Git history and durable architecture decisions.

## Latest Completed V5 Work

- V5 cloud-first application shell, dashboard, Players, My Roster, Waiver Opportunities, Trade Center, Teams & Managers, Cloud Imports, and Settings & Data Health exist.
- Repeat Fantrax CSV imports preserve player UUIDs through stable identity resolution and paginated cloud preload.
- Cloud imports use preview/review safeguards and actionable diagnostics.
- V5.4.0/V5.4.1 Trade Center work uses UUID player identity, bounded searches, stored scores, package analysis, consolidation targets, trade fits, and session-only drafts.
- V5.4.2 UI stabilization covers Players search draft state, import filename controls, table containment, Teams & Managers empty-state guidance, and roster-status diagnostics.
- V5.4.3/V5.4.3A completed read-only Fantrax endpoint and identity discovery; no roster synchronization, preview implementation, or schema change was produced.
- The repository was clean before this documentation-only task.

## V5.4.5 Fantrax Public Preview Foundation

- A preview-only V5 workflow now requests six documented public Fantrax operations through an allowlisted Supabase Edge Function: league info, team rosters, matchup scores, current standings, draft picks, and draft results.
- The preview normalizes league, player, team, roster, scoring-period, matchup, standing, and draft data without database writes.
- Player identity uses only an exact populated `fantrax_api_player_id` or the strict `*API_ID*` transformation. Name and MLBAM fallback remain prohibited.
- Team-name equality is suggestion-only because the current schema has no `teams.fantrax_team_id`; suggestions are never authoritative or persisted.
- Roster status mapping remains exact for the four observed values, with unknown values shown as `UNCLASSIFIED`.
- Matchup scores are labeled team scores. Standings are labeled `CURRENT_ONLY`. No player-level fantasy scoring or Dynasty Intelligence integration exists.
- Data Health reports preview availability and identity diagnostics without claiming synchronization.
- Chrome validation on 2026-08-02 verified 10 teams, 10,161 exact player identity matches, 567 exact roster-player matches, 24 scoring periods, 15 current and period-1 matchup rows, 10 current-only standings rows, 6 draft picks, and 50 draft results. All 10 teams remain intentionally blocked because authoritative Fantrax team IDs are not persisted.
- The `fantrax-public-league-preview` Edge Function was deployed with explicit authorization for preview validation. It performs public HTTP reads only and has no database client or write path.

## V5.4.6A Fantrax Team Identity Foundation

- V5.4.6A implementation and deployment acceptance are complete. Migration 007 was applied once and verified as nullable text with its format constraint and league-scoped partial unique index.
- A narrowly scoped migration adds nullable `teams.fantrax_team_id`, validates its normalized 16-character format, and enforces uniqueness within each league without backfilling rows.
- The Fantrax Preview Identity tab includes a responsive Team Identity Manager with roster, matchup, and draft-presence context; cloud team, manager relationship, UUID, owned-player count, existing identity; pending review; cancellation; replacement confirmation; and an exact team-identity-only confirmation dialog.
- One-to-one and cross-league rules are validated before persistence. Name equality is displayed only as a non-authoritative suggestion.
- Saving is constrained to the active league/team UUID and writes only `teams.fantrax_team_id`; post-save preview recomputation reports ownership and roster-status differences without an Apply Sync action.
- Data Health now reports Fantrax team counts, persisted identities, duplicates, unmapped teams, valid roster-team joins, ownership/status differences, and an honest manual-override warning.
- The current roster-status manager writes only `players.roster_status` and `updated_at`. No reviewed manual override/source/timestamp/sync audit mechanism exists, so production roster synchronization remains blocked.
- Ten reviewed one-to-one mappings were persisted across the ten valid fantasy teams; two excluded/stale raw team rows remain unmapped. Database verification found 10 populated IDs, 10 distinct IDs, and zero duplicate mapping groups.
- Pre/post protected hashes matched exactly for teams, players, calculated scores, and player metrics. No player ownership, roster status, player identity, manager assignment, score, HKB value, or Statcast value changed.
- Chrome acceptance passed after versioning the team-repository browser import to prevent a stale-module export error. Reload persistence, 10 mapped/0 unmapped teams, duplicate blocking, roster identity joins, read-only difference reporting, responsive controls, Data Health, absence of Apply Sync, and a clean console were confirmed.
- Manual Override Protection Available remains `WARNING`; production roster synchronization and V5.4.6B readiness remain blocked until a reviewed override/source/timestamp policy exists.

## Verified HKB Matching Repair

- HKB uses a dedicated canonical name normalizer for fallback matching; Fantrax and MLBAM identity precedence is unchanged.
- Diacritics, apostrophes, hyphens, periods in initials, and whitespace normalize consistently while suffix tokens remain meaningful.
- Duplicate canonical names require a unique result from explicit MLB-team and position context. Unknown cloud team metadata does not override a unique position result; explicit conflicting team metadata remains unsafe.
- Draft-pick assets matching the narrow year plus Early/Mid/Late plus round pattern are reported separately and never treated as players.
- Preview and upload share the reviewed match decisions. HKB upload is limited to batched value/rank updates for existing player UUIDs and performs no player insert.
- Read-only preview of `harryknowsball_players (12).csv` loaded 10,197 cloud players and improved matching from 1,652 to 1,693 rows. It classified 18 non-player assets, 1,652 unique name matches, 6 normalization repairs, 41 contextual matches, 35 players absent from cloud, and no ambiguous, conflicting, or invalid rows.
- The live preview did not run an upload and produced no browser console errors.

Evidence: recent Git history, `v5/`, `tests/v5*.test.mjs`, `tests/fantrax*.test.mjs`.

## Verified Fantrax Roster API State

- `getTeamRosters` is reachable with `leagueId` and optional `period`; no authentication was observed.
- CORS works from the local V5 browser origin with credentials omitted.
- Responses may be `text/plain` containing valid JSON.
- Invalid league IDs may return HTTP 200 with `INVALID_LEAGUE_ID`.
- Current verified response structure:

```text
{
  period,
  rosters: {
    [fantraxTeamId]: {
      teamName,
      rosterItems: [{ id, position, status }]
    }
  }
}
```

- Exact status mapping is `ACTIVE` to `ACTIVE`, `RESERVE` to `RESERVE`, `INJURED_RESERVE` to `IL`, `MINORS` to `MINORS`, and unknown to `UNCLASSIFIED`.
- Ownership remains independent. Unknown or missing status never implies `FREE_AGENT`.
- No production roster-status synchronization exists.

## Verified Fantrax Player Identity

- Stored source field: `players.fantrax_id`.
- Verified stored representation: `*API_ID*`.
- Strict API transformation: require exactly one leading and trailing ASCII `*`, remove only those wrappers, and preserve the inner value.
- The unwrapped identity must be validated with `getPlayerIds`.
- No name, fuzzy, or MLBAM fallback is permitted for this API join.
- `getTeamRosters.rosterItems[].id` is the Fantrax API player ID, not a separate roster-row ID.

Verified diagnostics:

- Current roster API players: 566
- Normalized stored IDs matching current roster API IDs: 566
- Cloud-owned players matching current roster snapshot: 566
- Duplicate normalized IDs: 0
- Owned cloud players absent from snapshot: 0
- Cloud players with `fantrax_id`: 10,170
- Normalized IDs found in the global `getPlayerIds` catalog: 10,134
- Historical/catalog misses: 36
- Catalog misses affecting current roster: 0

## Verified Fantrax Team And League Identity

## V5.4.6B-1 Local Implementation

- Manual roster-status override protection is implemented locally with migration 008, authenticated save/clear paths, source and audit UI, read-only Fantrax conflict recommendations, and Data Health coverage.
- Migration 008 is applied and schema-verified. A controlled Chrome save/restore/clear test passed without leaving a changed roster status; the tested row now has explicit `UNKNOWN` provenance and no active override metadata.
- Existing cloud roster statuses, ownership, identities, managers, scores, HKB values, and metrics have not been changed by this local implementation.
- Remaining acceptance is live Data Health rendering and Fantrax conflict-preview validation with the league configuration. Production Fantrax roster synchronization remains out of scope and blocked until that validation succeeds.

## V5.4.6B-2 Local Implementation

- Reviewed Fantrax roster-status synchronization is implemented locally on top of the B-1 preview recommendations.
- Only exact `APPLY_FANTRAX_STATUS` rows enter the apply set. Manual overrides, unknown statuses, unmatched player identities, unmapped team identities, and ownership differences are excluded.
- The UI requires an exact update-set acknowledgement and a separate final confirmation.
- Writes are grouped by previewed current and target status, constrained by league and reviewed player UUID, and exclude `MANUAL` provenance at write time. Only roster status, `FANTRAX` provenance, and `updated_at` are written.
- Successful applies reload league data and fetch a fresh Fantrax preview. Stale or newly protected rows are reported as skipped and require another review.
- Synthetic tests pass. No migration was created for B-2. The guarded recommendation set passed authenticated live acceptance, followed by a successful three-player controlled production apply and post-apply verification.
- Live ownership-guard acceptance found 566 exact roster identities, six ownership differences, and 560 eligible status updates. The six conflicts are excluded as `REVIEW_CONFLICT`: three cloud free agents and three different-cloud-owner rows.
- Ownership-conflict diagnostics distinguish `CLOUD_FREE_AGENT` from `DIFFERENT_CLOUD_OWNER` and display cloud owner names rather than raw team UUIDs. No ownership repair is automatic.

## V5.4.6B-3 Local Controlled-Apply Hardening

- Reviewed rows now carry an expected cloud owner, and the apply query requires that owner as well as the previewed current status and non-manual provenance.
- Apply results classify skipped rows and report failed write groups. Incomplete outcomes are not presented as successful, and league data plus the Fantrax preview refresh after each returned attempt.
- Data Health now shows an immediate running state, prevents duplicate starts, preserves the last successful report on error, and returns a visible read-only timeout after 60 seconds.
- Authenticated browser acceptance exposed a real timeout in the initial implementation. The corrected path reuses the already-loaded players, metrics, scores, and teams for diagnostics instead of downloading them again, and runs independent recommendation checks concurrently.
- An authenticated browser rerun completed and rendered the full report, confirming the timeout correction. The report contained one false failure because an idle Trade Center had no selected partner; this is corrected locally to a warning while missing user teams or invalid selected partners remain failures.
- Final read-only acceptance reports zero Data Health failures. A fresh Fantrax preview reports 566 roster/status differences, 560 eligible status-only updates, six excluded ownership conflicts split evenly between cloud free agents and different owners, and zero unmatched players, unmapped teams, or unclassified Fantrax statuses.
- Pre-apply protected baseline: 10,197 players, 565 owned players, zero manual overrides, protected player hash `e2ef7a71366281dd19d575b465b5cb87`, team hash `16bdaf1ec9143a7331e69db87e344ee7`, score hash `accc954d5dffaae8c3e13a64b502d69f`, and metric hash `44940d299bb920b89563486de9b5dfbd`.
- Controlled-apply review initially exposed all 560 eligible rows as one indivisible manifest, contradicting the approved 1–3-row acceptance plan. The local UI now starts with no selected rows, permits at most three eligible UUIDs, invalidates acknowledgement whenever selection changes, names the selected players in final confirmation, and revalidates only that subset before the guarded repository call.
- The first controlled production apply succeeded at `2026-08-03T20:55:53.031Z`: Kevin McGonigle, Daylen Lile, and Nico Hoerner changed from `UNCLASSIFIED` to `ACTIVE` in one guarded group. The UI reported 3 reviewed, 3 updated, 0 skipped, and 0 failed groups; the refreshed preview reduced eligible updates from 560 to 557 and showed Nico Hoerner as `NO_CHANGE`.
- Post-apply player count, owned count, protected player hash, team hash, score hash, and metric hash exactly matched the pre-apply baseline. Data Health completed with zero failures. Controlled production acceptance is complete.
- V5.4.6B-4 locally blocks roster-status review and apply whenever an explicit historical scoring period is selected. Only the empty `Current` period configuration can enter the reviewed synchronization path; the guard is repeated immediately before apply.
- Authenticated browser acceptance selected historical scoring period 13, which contained 489 roster rows and 285 apparent eligible updates. The UI displayed the historical-period warning and disabled review, proving no historical snapshot could enter synchronization.
- The complete 31-file test suite passes locally after the corrections.

- Ten 16-character alphanumeric Fantrax team IDs matched across `getLeagueInfo`, `getTeamRosters`, `getDraftResults`, `getStandings`, and `getMatchupScores`.
- The same IDs appeared in tested current and historical periods.
- Cross-season team-ID stability is not proven.
- The current `teams` schema has no authoritative Fantrax team-ID field.
- The current league schema has no structured Fantrax league-integration field.
- No `userSecretId` is required or approved for storage.

## Historical Proposed Phase: V5.4.3B

Fantrax External Identity Foundation and Read-Only Roster Preview:

- reviewed schema migration;
- central strict CSV-ID unwrap;
- `getPlayerIds` validation;
- player API-ID backfill preview;
- structured Fantrax league integration configuration;
- reviewed one-to-one team assignment preview;
- read-only roster-status preview;
- focused Data Health diagnostics;
- synthetic tests.

V5.4.3B must not include roster-status writes, ownership writes, free-agent rewrites, automatic team-name matching, player or team creation, production imports, or remote migration application without explicit approval.

## Remaining Constraints Before Broader Production Use

- Broader application of the remaining 557 eligible rows requires a new exact review and explicit authorization; controlled acceptance does not authorize a bulk apply.
- No active manual overrides existed during controlled acceptance, so the synthetic and write-query manual guard remains the evidence for that branch until a future reviewed conflict is available.
- Decide and test season rollover behavior because cross-season team-ID stability is unknown.

The B-3 controlled apply path is production-accepted for the exact three-player test above. No broader roster synchronization is authorized.

## Operations Not Performed During Documentation Reconciliation

- No source changes.
- No migrations created or applied.
- No cloud reads or writes.
- No imports.
- No score recalculations.
- No commits or pushes.

## V5.5 Active Direction

- **V5.5A Automated Statcast Data Provider implementation is complete.** The accepted baseline includes the public Baseball Savant collector, MLBAM-only resolver, normalized hitter/pitcher metrics, authenticated league-scoped metric persistence, import-job metadata, Data Health, protected-baseline profiles, coordinated review/session execution, and truthful type/session outcome reporting.
- **V5.5A live production refresh acceptance is suspended.** No coordinated production Statcast refresh has been performed. GitHub Pages repeatedly failed to publish the exact feature artifact; this is an external deployment blocker, not a proven application defect. The existing V5.5A-6B contract may resume when exact-artifact publication is reliable.
- **V5.5B Player Intelligence Engine 2.0 is active.** The immediate task is documentation-only audit and architecture. No scoring formula, calculated score, metric, identity, roster, ownership, or Fantrax behavior is authorized to change during the audit.
- V5.5C remains the Waiver vs. Roster Decision Engine and must consume explainable V5.5B outputs rather than duplicate player-value logic.

## V5.5B Audit Findings

- The active persisted engine is `ENGINE_VERSION = 5.1.1`. It deterministically writes one `calculated_player_scores` row per player/version and stores additional component detail in `explanation` JSONB. Decision and trade services consume stored scores rather than recalculating in views.
- Current components are mostly fixed 0–100 heuristics using HKB, age, stage, limited Statcast signals, ownership/status, static positional scarcity, and shallow league settings. They do not yet calculate actual Reddit Phanatics scoring production, lineup-based replacement levels, defensive double-play opportunity, role stability, saves/holds opportunity, or prospect slot opportunity cost.
- Automated Statcast normalization and engine consumption are not fully aligned: the provider writes camelCase contact keys such as `hardHitRate` and `barrelRate`, while several engine modules read legacy snake_case keys. `xwoba` and `xera` overlap; other accepted metrics may currently be ignored by scoring.
- Fantrax player fantasy points/scoring stats are not an accepted data source; public preview exposes team matchup scores only. Exact lineup/scoring settings, role data, injury history, and defensive opportunity inputs are incomplete or not normalized for engine use.
- The existing score table can support a first V5.5B component contract inside versioned `explanation` JSONB without a migration. Queryable top-level columns remain useful compatibility fields; any future indexed component columns require separate evidence and review.
- Active implementation plan: B-1 canonical input/component foundation; B-2 league production plus actual replacement/scarcity; B-3 Statcast skill and breakout/regression; B-4 role/age/prospect opportunity cost and scenarios; B-5 explainable UI/calibration. V5.5C follows only after the B contract is accepted.

## V5.4.6C Reconciled Implementation — Fantrax Season Rollover Safety

- The Fantrax preview now derives an observed season context from the exact external league ID, Fantrax season year, and optional league-history ID, then compares it with an explicitly reviewed context stored in the active league's existing `settings` object.
- Missing review, league-ID drift, season-year drift, or an available league-history mismatch blocks both team-identity and roster-status writes while leaving preview data readable.
- A rollover requires acknowledgement plus an explicit, complete, unique mapping of every observed Fantrax team to a team in the active cloud league. Names, managers, roster overlap, and prior mappings remain suggestions only.
- Changing league configuration, period, or preview context clears the loaded preview plus pending mapping and roster-review state. Existing current-period, exact-selection, ownership, status, and manual-override guards remain in force.
- Data Health reports reviewed-versus-observed league, season, optional history, and the resulting write-block state without additional network reads.
- The implementation was reconciled from `origin/main` (`df89840de0ea8563968b99b7acc75b528e02983f`) onto `origin/feature/manager-intelligence` (`5a89cc0f611e63c5c34da22faeb7680f88b239f1`) while preserving that baseline's auth, HKB import, and UI changes.
- All 32 standalone Node test files pass locally. Authenticated production Data Health completed read-only with zero failures and no console errors. The local build loaded without console errors, but its separate localhost origin had no authenticated session, so current-context and rollover UI acceptance on the reconciled build remains synthetically verified rather than live-authenticated.
- No migration, import, roster synchronization, score recalculation, deployment, or cloud write was performed during reconciliation.
