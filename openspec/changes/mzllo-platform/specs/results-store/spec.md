# Results-Store Specification

## Purpose

SQLite persistence for draws, members, and publish state — the single source of truth for the platform.

## Requirements

### Requirement: STO-1 — Schema integrity

The store MUST persist draws, members, and publish_log. Draws MUST satisfy a unique constraint on (state, game_id, draw_date, draw_type); migrations MUST be additive-only.

#### Scenario: Duplicate draw upsert

- GIVEN a draw already exists for state/game/date/type
- WHEN the same draw is upserted again
- THEN the existing row is updated, not duplicated

### Requirement: STO-2 — Queries

The store MUST expose queries for current results, paginated history, jackpots, and prize tiers per state/game, returning a normalized shape.

#### Scenario: History with no rows

- GIVEN a game with no stored draws in range
- WHEN history is queried
- THEN an empty result is returned without error

### Requirement: STO-3 — Publish state

The store MUST record per-draw publish state per channel (public/private) in publish_log, with status and Telegram message ids, enabling idempotent publishing.

#### Scenario: Failed send then retry

- GIVEN a publish attempt failed on one channel
- WHEN the publisher retries
- THEN channels already marked successful are not re-sent
- AND the failed channel is retried with its status updated
