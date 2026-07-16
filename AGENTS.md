# Required project context

Before analyzing or editing this repository, read:

1. `docs/PROJECT_MEMORY.md`
2. `docs/CURRENT_STATE.md`
3. `docs/ARCHITECTURE_DECISIONS.md`
4. `docs/WORKFLOW.md`
5. Any additional `AGENTS.md` file that applies to the directory being edited

Do not begin implementation until these files have been reviewed.

# Repository Agent Instructions

These instructions apply to the whole repository unless a more specific `AGENTS.md` exists in a subdirectory.

## Required Preflight

Before editing, Codex must:

1. Read this file, `docs/PROJECT_MEMORY.md`, `docs/CURRENT_STATE.md`, and any scoped `AGENTS.md` files relevant to the files being changed.
2. Check the current branch and working tree status.
3. Inspect the current code before proposing or making changes.
4. Identify unrelated dirty files and protect them.
5. Stop and report if repository evidence contradicts the task assumptions.

## Working Rules

1. Make the smallest coherent change that addresses the requested issue.
2. Preserve known-good behavior while fixing one issue.
3. Never overwrite whole current files with historical versions.
4. Never restore code from old commits without a focused diff and explicit approval.
5. Never modify migrations, schema, identity rules, authentication, or unrelated importers unless explicitly requested.
6. Never use prior chat history as authoritative project state.
7. Treat `docs/PROJECT_MEMORY.md` as durable facts and `docs/CURRENT_STATE.md` as temporary operational state.
8. Update documentation only when repository evidence or explicit user facts support the update.
9. Add focused tests for each behavioral change.
10. Run applicable tests and report exact commands and results.
11. Never claim success based only on static inspection.
12. Never commit or push unless explicitly requested.
13. List every modified file and every unrelated dirty file in the final response.

## Completion Checklist

Before finishing, Codex must report:

1. Files changed.
2. Unrelated dirty files left untouched.
3. Tests or checks run, with exact commands and results.
4. Any tests or checks not run.
5. Whether migrations, imports, commits, or pushes were avoided or performed.
6. Any conflicts between task assumptions and repository evidence.
