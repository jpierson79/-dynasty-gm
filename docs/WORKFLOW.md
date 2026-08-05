# Safe Development Workflow

## Architect-to-Codex Handoff Loop

The repository documents are the durable handoff between ChatGPT acting as architect and Codex acting as implementation agent.

1. The architect reads `AGENTS.md`, durable project memory, current state, architecture decisions, workflow rules, and repository evidence before selecting a phase.
2. The architect writes the complete authorized implementation specification in `docs/NEXT_TASK.md`, including the verified branch/commit baseline, objective, scope, exclusions, invariants, tests, acceptance criteria, and authority boundaries.
3. Codex begins by repeating the repository preflight and stops if the baseline, working tree, or current evidence materially contradicts the task.
4. Codex implements only `docs/NEXT_TASK.md`. It reports blockers before expanding scope or changing an architectural decision.
5. Codex validates in proportion to risk: focused tests first, then broader tests, browser/manual checks, and read-only diagnostics where applicable. Cloud writes, migrations, deployments, imports, and other production actions require the authority stated in the active task; silence is not authorization.
6. Codex replaces the reusable template in `docs/NEXT_TASK_RESULT.md` with an evidence-based completion report. The report includes files changed, unrelated work preserved, exact validation results, data operations performed or avoided, deviations, remaining work, and the final commit/push state.
7. When explicitly authorized, Codex stages only intended files, commits narrowly, pushes the current task branch, and reports the full commit SHA and push result. It never uses broad staging by default.
8. The architect reviews the code diff and `docs/NEXT_TASK_RESULT.md`, reconciles verified milestones into `docs/CURRENT_STATE.md` and durable decisions where appropriate, then approves remediation or replaces `docs/NEXT_TASK.md` with the next phase.

`docs/NEXT_TASK.md` is the current implementation contract. `docs/NEXT_TASK_RESULT.md` is the returned evidence. Neither file overrides `AGENTS.md`, repository safety rules, or an explicit newer user instruction.

## Standard Flow

1. Establish known baseline.
   - Check branch, HEAD, tags, and working tree status.
   - Read `AGENTS.md`, `docs/PROJECT_MEMORY.md`, `docs/CURRENT_STATE.md`, and scoped `AGENTS.md` files.
2. Create a feature branch when requested or when the task requires isolated work.
3. Inspect relevant files before planning changes.
4. Write a focused plan when the work is multi-step or risky.
5. Change one subsystem at a time.
6. Add or update focused tests for behavioral changes.
7. Run focused tests first; broaden testing only when the change crosses subsystem boundaries.
8. Perform manual browser validation when UI, file upload, auth, or cloud behavior changes.
9. Inspect database state without destructive writes when schema or cloud data behavior is relevant.
10. Commit narrowly only when explicitly requested.
11. Update `docs/CURRENT_STATE.md` after verified milestones.

## Rollback Rules

- Preserve work before any reset.
- Never use `git reset --hard` unless the user explicitly requests it and work has been preserved or the risk is accepted.
- Never use `git add .` by default.
- Stage only files intentionally included in a requested commit.
- Use `git push --force-with-lease` only with explicit approval.
- Never use plain force push.
- Never overwrite current files wholesale from historical commits.
- When old commits are useful, inspect focused diffs and port only the needed lines.

## Debugging Rules

- Do not chase stale UI or network errors without obtaining a fresh reproduction or fresh network response.
- Separate preview, parse, identity resolution, and persistence failures.
- Do not infer that a workflow works just because code exists.
- Prefer source-specific tests for import and identity behavior.
- When database behavior matters, verify the active database schema and relevant rows before claiming success.
- Keep temporary diagnostics out of durable memory unless they become permanent supported observability.

## Fantrax External API Workflow

1. Treat CSV identity, API player identity, application UUID, MLBAM identity, team identity, ownership, and roster status as separate fields with separate validation.
2. Preserve `players.fantrax_id` exactly as imported. Derive a Fantrax API player ID only through the strict `*API_ID*` wrapper rule and validate it through `getPlayerIds`.
3. Never use name, fuzzy, or MLBAM fallback for the Fantrax roster API player join.
4. Require authoritative configured Fantrax league and team IDs before considering roster-status writes. Do not silently match teams by display name.
5. Parse JSON bodies even when Fantrax returns `text/plain`, and inspect HTTP-200 responses for structured Fantrax error objects.
6. Omit browser credentials for currently public Fantrax endpoints. Never request, store, log, or commit a `userSecretId`.
7. Keep API fetch, identity validation, preview, and any later apply operation as separate stages.
8. Preview must precede any write and must expose unknown statuses, catalog misses, unmatched players, unmatched teams, duplicates, and stale configuration.
9. Unknown status maps to `UNCLASSIFIED` and never changes ownership or free-agent state.
10. Do not store raw private roster payloads or add live API calls to routine Data Health rendering.
11. Remove temporary diagnostic files before completing an investigation unless the user explicitly requests otherwise.
12. Route production public-league preview reads through the allowlisted Supabase Edge Function; do not call Fantrax directly from the production browser workflow.
13. Treat `getMatchupScores` as period-specific team scoring only and `getStandings` as a current snapshot until Fantrax proves historical semantics.
14. Keep player fantasy-point ingestion out of scope until a credential-free documented endpoint is independently verified.
15. Persist Fantrax team identity only after an explicit review and confirmation. Enforce one-to-one assignments within the active league and never auto-save a name-based suggestion.
16. Before any future roster synchronization, require a reviewed manual-override model containing an explicit source and timestamp, a clear-override workflow, and preview diagnostics for conflicts.
17. A local team-identity checkpoint does not imply deployment: record migration application, persisted mappings, protected-field verification, and Chrome acceptance separately. After a local checkpoint, resume with deployment and live validation rather than reimplementing the feature.
18. The V5.4.6A deployment baseline is migration 007 applied, 10 distinct reviewed team IDs, zero duplicate groups, matching pre/post protected hashes, and completed Chrome/Data Health acceptance. Do not treat this as authorization or readiness for roster synchronization while manual override protection is absent.
19. A reviewed Fantrax roster-status apply must include only `APPLY_FANTRAX_STATUS` rows, route ownership differences to `REVIEW_CONFLICT`, require exact-set review and a separate final confirmation, and record the expected owner in the manifest. Re-check expected owner, current status, and manual provenance in the write query; report reasoned skips and partial failures; and refresh league data and the preview after every completed attempt. Never include ownership or free-agent fields in the payload.
20. Controlled production acceptance must select one to three eligible UUIDs from an empty-by-default review set. Any selection change invalidates acknowledgement. The final confirmation must name the selected players, and the repository must receive only that revalidated subset.
21. Roster-status synchronization is permitted only from the `Current` Fantrax preview. Any explicit scoring-period value is historical and must disable review and fail final apply validation.

## Validation Rules

- Report exact commands and exact results.
- If a test is static inspection only, say so.
- If no browser validation was run, say so.
- If no import was run, say so.
- If no migration was applied, say so.
- For Fantrax roster work, separately report whether endpoint reads, cloud reads, cloud writes, imports, roster rewrites, migrations, and score recalculations occurred.
# Manual Roster-Status Overrides

1. Sign in and select the intended league. Only a league owner/editor may save or clear overrides.
2. Review pending status changes in Roster Status Manager and confirm the status-only save. The database stamps the authenticated user and time.
3. To clear protection for one, selected, or all filtered manual rows, use Clear Manual Override and confirm. The current status is preserved; no Fantrax request or write is triggered.
4. Review Fantrax Sync Preview recommendations. `PRESERVE_MANUAL_OVERRIDE` is a hard future-sync guard; `REVIEW_CONFLICT` is never applied automatically.
5. Before enabling any synchronization, verify Data Health source coverage and missing-audit checks, apply migration 008 once through the approved Supabase workflow, snapshot protected fields, and complete controlled Chrome acceptance.
