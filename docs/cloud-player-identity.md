## Core Design Principles

The player identity system is built around the following invariants.

### Internal identity is permanent

`players.id` is the only permanent application identifier.

It must never change after a player record is created.

All application data references this UUID, including:

- notes
- scouting reports
- manager intelligence
- trade history
- roster history
- valuations
- watch lists
- custom rankings
- AI analysis

External identifiers may change over time.

Internal UUIDs never do.

### Imports synchronize

Cloud imports synchronize existing player records.

They do not replace the database.

Running the same import multiple times must always produce the same database state.

Imports are idempotent.

### Stable identifiers win

When available, stable external identifiers always take precedence over player names.

Player names are considered descriptive metadata, not identity.

### Never guess

When multiple identity candidates exist, the importer must report a conflict rather than making an unsafe decision.

## Identity Resolution State Machine

Incoming Player
       │
       ▼
Fantrax ID?
       │
      Yes
       │
Find existing?
       │
   ┌───┴────┐
   │        │
 Found    Not Found
   │        │
 Update   Check MLBAM

## Identity Confidence

Every resolved player receives a confidence level.

HIGH

- Fantrax ID match
- MLBAM ID match

MEDIUM

- unique fallback using
    normalized name
    organization
    position

LOW

- unresolved candidate

LOW confidence rows are never updated automatically.

## Identity Conflict Types

Fantrax ID conflict

Incoming Fantrax ID matches Player A

Incoming MLBAM ID matches Player B

Action:

STOP

Report conflict.

No updates.

Duplicate Fantrax ID

Two database rows contain the same Fantrax ID.

Action:

Database integrity error.

Stop import.

Duplicate MLBAM ID

Two database rows contain the same MLBAM ID.

Action:

Database integrity error.

Fallback ambiguity

Multiple players satisfy fallback matching.

Action:

Unmatched.

Manual review required.

## Database Invariants

Every populated Fantrax ID is unique within a league.

Every populated MLBAM ID is unique within a league.

Every player has exactly one UUID.

UUIDs never change.

Imports never recreate an existing UUID.

Normalized names are not unique.

Relationships never point directly to Fantrax IDs.

Relationships never point directly to MLBAM IDs.

Relationships always point to players.id.

## Transaction Model

Each player synchronization occurs inside a database transaction.

Successful players commit.

Identity conflicts roll back only the affected player.

One conflict must never abort the entire import.

## Import Audit

Each import records:

Import ID

Timestamp

League

Rows

Inserted

Updated

Conflicts

Skipped

Duration

Importer version

Source file hash

Future supported sources

Fantrax

Harry Knows Ball

Baseball Savant

Statcast

MLB API

Baseball America

Prospects Live

Future sources must never replace the internal UUID.

They only enrich existing players.

## AI Requirements

AI systems must never identify players using names alone.

AI must reference:

players.id

or

fantrax_id

or

mlbam_id

before performing updates.

Names are display values only.

## Long-Term Vision

The player identity layer is the foundation of the Dynasty GM Front Office.

Every future subsystem—

- trade analysis
- scouting
- projections
- manager intelligence
- roster history
- waiver recommendations
- valuation models
- AI coaching

depends on stable player identities.

Preserving identity integrity is more important than maximizing automatic match rates.

When uncertainty exists, preserve data rather than guessing.

## Knowledge Preservation

Once information is attached to a player's internal UUID, it must survive:

- repeated imports
- team changes
- organization changes
- position changes
- player name changes
- Fantrax exports
- Statcast updates
- valuation recalculations
- application upgrades

The purpose of the identity system is not simply to prevent duplicates.

Its primary responsibility is to preserve accumulated knowledge over the lifetime of the Dynasty GM Front Office.

## Success Criteria

The identity system is considered correct when:

- Re-importing the same Fantrax export creates zero duplicate players.
- Existing player UUIDs never change after repeated imports.
- Player notes, valuations, manager intelligence, and roster history remain attached after every import.
- Every populated Fantrax ID is unique within a league.
- Every populated MLBAM ID is unique within a league.
- Ambiguous identity matches never overwrite existing data.
- All imports are idempotent.

## Import Guarantees

The importer guarantees:

- Existing players are updated, not recreated.
- Existing UUIDs are preserved.
- Duplicate players are never intentionally created.
- Unknown players may be inserted.
- Conflicting identities are never merged automatically.
- Failed rows never corrupt successful rows.
- Imports are deterministic.

## Performance Goals

Expected import size

- 1,000 players
- 10,000 players
- 100,000 enrichment records

Imports should:

- batch writes
- minimize database round trips
- avoid N+1 queries
- use indexed lookups

## Identity Version

Identity Specification

Version: 2.0

Breaking changes:

- Fantrax ID becomes primary external identity.
- Normalized names are no longer authoritative.

docs/

PlayerIdentityArchitecture.md
PlayerIdentityMigration.md
CloudImporter.md

## Extensibility

New data providers should implement:

resolveIdentity()

rather than creating their own matching logic.

No importer may bypass the identity resolver.

## Observability

Every import logs:

- import id
- duration
- inserted
- updated
- skipped
- unmatched
- conflicts
- duplicate ids
- warnings

# Cloud Player Identity

Phase 2G prep moves player matching away from normalized names as the primary identity.

## Current identity flow before this refactor

- `players.id` is the permanent internal UUID and remains the application identifier.
- The original schema enforced `league_id + normalized_name` as a unique player key.
- The cloud CSV importer treated Fantrax `ID` as though it could be `mlbam_id` by including `id` in the MLBAM header aliases.
- Player matching used MLBAM first, then normalized name.
- A shared player upsert helper used `league_id + mlbam_id`, which failed on databases that did not yet have that matching constraint.

## New matching priority

1. `league_id + fantrax_id`
2. `league_id + mlbam_id`
3. Cautious existing-player fallback using normalized name plus organization/team, position, or other reliable context when available
4. Unmatched/manual review when fallback matching is ambiguous

`players.id` remains the durable internal UUID for app relationships. Fantrax ID and MLBAM ID are external source identifiers only; they do not replace the internal UUID. Notes, valuations, roster history, manager intelligence, and related records continue to link through `players.id`.

## Fantrax ID status

The Fantrax `ID` column has been manually verified across multiple Fantrax player exports. The same player retains the same Fantrax ID across exports, so `fantrax_id` is the preferred identity key for Fantrax imports.

The importer preserves `fantrax_id` as trimmed text without numeric conversion. The accepted Fantrax source headers are exactly `ID`, `Fantrax ID`, and `Fantrax Player ID`.

Generic `ID` is not an MLBAM alias. MLBAM IDs are populated only from explicit MLBAM headers such as `MLBAM ID`, `MLB ID`, or `MLB Player ID`, except native Statcast exports where `player_id` is the Statcast MLBAM identifier.

## Name fallback rules

Normalized names are no longer the database identity. A normalized-name fallback can update an already existing player only when the match is unique or when additional context makes one candidate safe. If multiple existing players share the same normalized name and context does not clearly identify one player, the row is left unmatched or reported as an identity conflict for manual review.

New Fantrax player rows are inserted only after no safe existing match is found and a stable `fantrax_id` is present. Existing players are updated by internal `players.id` after identity resolution, preserving all related records.

## Schema approach

The current application uses direct external identifier columns on `players`:

- `fantrax_id text`
- `mlbam_id bigint`

This phase intentionally does not add a `player_external_ids` table. Direct columns are enough for the current Fantrax, HKB, and Statcast import sources and avoid unnecessary schema complexity.
