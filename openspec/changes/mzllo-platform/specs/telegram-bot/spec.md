# Telegram-Bot Specification

## Purpose

Telegram bot posting result cards to public and premium channels, answering commands, and gating premium-channel joins.

## Requirements

### Requirement: TGB-1 — Channel posts

The bot MUST post SVG-rendered result cards (converted to PNG) via `sendPhoto`, captioned with numbers, source, and draw date, to the public channel for every new draw, and SHOULD post to the premium channel.

#### Scenario: New draw published

- GIVEN a new draw is persisted and marked publishable
- WHEN the publisher runs
- THEN a card is posted to the public channel and, if applicable, the premium channel
- AND message ids are recorded in publish_log

#### Scenario: Send failure

- GIVEN Telegram returns an error on send
- WHEN posting fails
- THEN the send is retried and the failure is logged in publish_log

### Requirement: TGB-2 — Commands

The bot MUST answer `/results` and `/stats` from stored results only; unknown commands MUST return a help message.

#### Scenario: Results query

- GIVEN a user sends `/results` with a game
- WHEN the bot handles it
- THEN it replies with stored official results and source attribution

### Requirement: TGB-3 — Premium join gate

The bot MUST approve `chat_join_request` only for verified members, decline others, and let unapproved requests time out. Approval MUST be automatable from the membership flow.

#### Scenario: Non-member join request

- GIVEN a non-member requests to join the premium channel
- WHEN the bot receives `chat_join_request`
- THEN the request is declined or left to time out

#### Scenario: Member approved after payment

- GIVEN a user paid and their join request is pending
- WHEN membership becomes active
- THEN the pending request is auto-approved
