# AI-Assistant Specification

## Purpose

Tool-calling results assistant (public) with optional premium analysis — answers from stored data only, never predictions or bolita.

## Requirements

### Requirement: AIA-1 — Tool-only answers

The assistant MUST answer only from tool-calling results against the store. Any question outside stored results MUST produce a refusal citing sources, never a synthesized answer.

#### Scenario: Factual question

- GIVEN a user asks for a past draw's numbers
- WHEN the assistant calls the results tool
- THEN it answers from tool output with source and draw date

#### Scenario: Out-of-data question

- GIVEN a question the tools cannot answer
- WHEN the assistant responds
- THEN it states it cannot answer and bounds scope to stored results

### Requirement: AIA-2 — Hard refusals and disclaimers

The assistant MUST refuse predictions and any bolita reference, MUST cite source and date, MUST include a non-advice disclaimer, and SHOULD log queries for abuse monitoring.

#### Scenario: Prediction request

- GIVEN a user asks for predicted numbers
- WHEN the assistant responds
- THEN it refuses without generating numbers
- AND it includes the disclaimer

#### Scenario: Bolita reference

- GIVEN a user references bolita
- WHEN the assistant responds
- THEN it refuses and redirects to official results only

### Requirement: AIA-3 — Premium analysis

The assistant MAY provide premium-only analysis (odds and prize-tier statistics) for verified members; analysis MUST NOT include predictions.

#### Scenario: Non-member premium request

- GIVEN a non-member requests premium analysis
- WHEN the assistant checks membership
- THEN access is denied
