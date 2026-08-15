# Membership Specification

## Purpose

Premium membership flow: payment → status → bot auto-approves premium-channel join.

## Requirements

### Requirement: MEM-1 — Payment and status

The system MUST record payments (external provider decided in design) with a payment_ref and a lifecycle status (pending/active/expired), and MUST NOT grant access before payment succeeds.

#### Scenario: Successful payment

- GIVEN a user completes payment
- WHEN the provider confirms it
- THEN a member record is created with status active

#### Scenario: Failed payment

- GIVEN payment fails or is not confirmed
- WHEN the flow completes
- THEN no membership is granted and the user sees a clear retry path

### Requirement: MEM-2 — Join approval

The bot MUST auto-approve a verified member's pending premium-channel join request, with manual approval as fallback.

#### Scenario: Pay then join

- GIVEN a member with status active sends a join request
- WHEN the bot receives `chat_join_request`
- THEN the request is approved automatically

#### Scenario: Manual fallback

- GIVEN auto-approval fails
- WHEN an operator reviews the case
- THEN membership is verified and the join is approved manually
