# Next Task: V5.4.6C-2 Hosted Loading Boundary Repair and Final Acceptance

## Status And Baseline

- Status: authorized for implementation, authenticated preview deployment, final acceptance, narrow commit, and push.
- Branch: `codex/v5-season-rollover-reconciliation`.
- Starting commit: `b37c516cc9b53991db689891bae4f7e968c34c90` (`Add Fantrax season rollover safety`).
- Prepared: 2026-08-06 America/Chicago.
- Preserve unrelated untracked `.codex/` content and the existing uncommitted acceptance report.
- Do not merge into `main`.

## Verified Problem

The hosted reconciliation branch renders the shell but remains at `Loading`. Repository inspection shows that V5 imports the shared Supabase client, which statically imports `js/config/supabase.js`, while the reconciliation branch ignores and does not track that browser configuration file. GitHub Pages therefore publishes an incomplete module graph. Earlier repository commit `94cc451` established that the public Supabase URL and publishable anonymous key are safe, required production configuration and added a regression test.

Stop before deviating if fresh browser/network evidence contradicts this diagnosis or reveals superseding rollover behavior.

## Objective

Restore the smallest established production configuration boundary so the reconciliation branch boots on its hosted origin, then complete authenticated live acceptance of the season-context workflow. Do not reimplement or broaden V5.4.6C.

## Authorized Scope

1. Restore tracked browser-safe `js/config/supabase.js` using the established public URL and publishable anonymous key already present in repository history.
2. Adjust `.gitignore` narrowly so that exact production file can be tracked while local secret variants remain ignored.
3. Restore or add the focused production-configuration regression test.
4. Deploy only the reconciliation branch to an authenticated preview origin without merging.
5. Perform the seven live acceptance scenarios below using read-only behavior or safe simulation wherever a persistence write is not necessary.
6. Preserve the explicitly approved, fail-closed ordering that saves reviewed team mappings before reviewed season-context settings. Do not make this sequence atomic or reorder it in this phase.

## Required Safety Invariants

- Preserve current-period-only synchronization, exact Fantrax identity matching, manual override protection, stale-preview protection, league scoping, and write-time field restrictions.
- Do not perform roster synchronization, imports, score recalculation, ownership repair, player/team creation, schema changes, migrations, or unrelated cloud writes.
- Preview and Data Health remain read-only.
- Any simulated drift must not replace the production-reviewed season configuration unless a separately confirmed acknowledgement is required for the acceptance and can be safely restored and verified.
- No credentials, sessions, passwords, private keys, or service-role keys may be logged or committed.

## Required Validation

Run focused configuration/auth tests, `v5FantraxSeasonContext` tests, focused Fantrax tests, roster-sync tests, roster-manager tests, Data Health tests, auth tests, every `tests/*.test.mjs` file, and `git diff --check`.

Hosted acceptance must prove:

1. current reviewed season context renders as matching;
2. mocked or safely simulated rollover drift remains readable;
3. team-identity and roster-status writes are blocked during drift;
4. the explicit acknowledgement and complete mapping confirmation flow succeeds safely;
5. period or league-configuration changes invalidate pending review state;
6. the season guard is repeated immediately before persistence;
7. Data Health renders the reviewed/observed context and block reason without a new Fantrax read.

Also verify a clean hosted reload, authenticated session continuity, responsive controls, and no browser console/module-load errors.

## Completion And Git Rules

1. Record root cause, repair, deployment evidence, every acceptance result, data operations, tests, changed files, unrelated dirty files, and final repository state in `docs/NEXT_TASK_RESULT.md`.
2. Update durable/current project documentation only where verified evidence requires it.
3. If and only if every required automated and hosted acceptance check passes, stage only intended files, commit with a narrow message, and push the reconciliation branch.
4. If acceptance does not pass, do not commit or push; record the blocker and leave the branch out of `main`.

## Definition Of Done

The hosted reconciliation branch loads with its established public Supabase configuration, all seven authenticated V5.4.6C scenarios pass without unauthorized data mutation, the approved fail-closed two-step save sequence remains unchanged, complete automated validation passes, intended changes are committed and pushed, and no merge into `main` occurs.
