# Service and Import Code Instructions

These instructions apply to `js/services/**`.

## Player Identity

1. Use `PlayerIdentityResolver` for Fantrax identity decisions.
2. Never use player names as authoritative identity.
3. Never assign Fantrax ID to `players.id`.
4. Preserve internal UUIDs on updates.
5. Do not loosen identity matching without explicit request and regression tests.
6. Do not guess ambiguous matches.

## Import Safety

1. Never serialize missing MLBAM as zero.
2. Never perform writes during preview.
3. Preserve paginated preloads.
4. Preserve batched writes.
5. Do not perform one remote request per player.
6. Omit absent update fields rather than clearing valid existing values.
7. Expose actual caught errors in user-facing failure messages where safe.
8. Do not log credentials, tokens, passwords, Supabase keys, or complete sessions.

## Required Tests For Service Changes

Add regression tests for the relevant behavior when changing:

- CSV parsing.
- Preview behavior.
- Identity classification.
- Pagination.
- MLBAM serialization.
- Batched writes.
- Retry or resume behavior.
- Error reporting.

## Scoped Completion Checklist

Before finishing service/import work, report:

1. Whether preview remains read-only.
2. Whether player preloads remain paginated.
3. Whether writes remain batched.
4. Whether internal UUIDs are preserved.
5. Whether missing MLBAM values still serialize to `null`.
6. Which focused tests were run.
