# Ingest Specification

## Purpose

Poll official FL/GA/NY feeds on schedule, validate payloads with zod, and upsert draws — with an official-HTML fallback for undocumented or changing APIs.

## Requirements

### Requirement: ING-1 — Poll official feeds

The ingest worker MUST poll the official keyless feeds — FL APIM (header `x-partner: web`), GA JSON API (`/api/v2/draw-games/draws`), and NY Socrata datasets — on each state's draw schedule, and MUST retry with exponential backoff when results are not yet available.

#### Scenario: Latest draw published

- GIVEN a configured game has a completed draw
- WHEN the poller runs at the scheduled time
- THEN the latest draw payload is fetched and zod-validated
- AND the draw is upserted to the store

#### Scenario: Late or missing draw

- GIVEN results are unavailable at draw time
- WHEN the poller finds no new draw
- THEN it retries with backoff until the configured window elapses
- AND it raises an alert if no draw appears after the window

### Requirement: ING-2 — Zod validation with fallback

Every payload MUST pass a zod schema before any write. Invalid payloads MUST NOT be persisted, MUST raise an alert, and SHOULD trigger the official HTML fallback (FL/GA) for the affected state.

#### Scenario: Payload schema drift

- GIVEN an official API changes its response shape
- WHEN the payload fails zod validation
- THEN no partial data is written and an alert is raised
- AND the HTML fallback is attempted

#### Scenario: Fallback parse failure

- GIVEN the official HTML page cannot be parsed
- WHEN parsing fails
- THEN the poll is marked failed and retried with backoff

### Requirement: ING-3 — Data-driven game scope

Game coverage MUST be driven by a configuration registry, not hard-coded. The FL CASH4LIFE game (last observed draw 2026-02-21, possibly retired) MUST NOT block ingest when silent and MUST be surfaced for operator confirmation. Registered games: FL Pick 2/3/4/5, Fantasy 5, PB, MM; GA Cash 3/4, Fantasy 5, PB, MM; NY Numbers, Win 4, Take 5, PB, MM.

#### Scenario: Silent retired game

- GIVEN FL CASH4LIFE has produced no draw since 2026-02-21
- WHEN the expected-draw window elapses
- THEN the pipeline keeps running and flags the game as possibly retired
- AND an operator confirms whether to keep or retire it

#### Scenario: Registry-driven polling

- GIVEN the configured game registry
- WHEN the worker starts
- THEN it polls exactly the registered games, restricted to FL/GA/NY
