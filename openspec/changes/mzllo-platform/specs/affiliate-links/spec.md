# Affiliate-Links Specification

## Purpose

Curated, pre-vetted affiliate links (complementary revenue) with disclosure — never programmatic ads.

## Requirements

### Requirement: AFF-1 — Curated links only

The website MAY display curated affiliate links (general financial/news/responsible-gambling resources) and MUST NOT render programmatic or dynamic ad inventory.

#### Scenario: Zero affiliates configured

- GIVEN no affiliate links are configured
- WHEN the page renders
- THEN no ad or link slots are displayed

### Requirement: AFF-2 — Disclosure

Every affiliate link MUST carry a clear, bilingual (EN/ES) disclosure; links without disclosure MUST NOT render.

#### Scenario: Link with disclosure

- GIVEN a curated link with disclosure configured
- WHEN rendered
- THEN the disclosure is shown in the page's active language

#### Scenario: Missing disclosure

- GIVEN a curated link lacks disclosure
- WHEN the page is built
- THEN the link is excluded and flagged for review
