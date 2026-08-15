# Results-Web Specification

## Purpose

Bilingual (EN/ES) website with current and history results pages, official attribution, and SEO — no programmatic ads.

## Requirements

### Requirement: WEB-1 — Bilingual results pages

The website MUST render current and history results per configured game in EN and ES, with a language toggle and locale-aware URLs. Default locale MUST be EN; untranslated strings SHOULD fall back to EN.

#### Scenario: Language switch

- GIVEN a user views a results page in EN
- WHEN they toggle to ES
- THEN the same content renders in ES under a locale-aware URL

#### Scenario: Missing translation

- GIVEN a string has no ES translation
- WHEN the ES page renders
- THEN it falls back to the EN string without breaking the page

### Requirement: WEB-2 — Attribution and SEO

Every results page MUST cite the official source and draw date, link to the official site, and include a prize-verification disclaimer. Pages SHOULD be indexable via stable URLs, meta descriptions, and EN/ES alternate links.

#### Scenario: Page metadata

- GIVEN a results page renders
- WHEN inspected
- THEN it includes source attribution, draw date, and official-site link
- AND machine-readable EN/ES alternates are present

### Requirement: WEB-3 — Content compliance

The website MUST NOT display programmatic ads, bolita content, or predictions; content MUST be limited to FL/GA/NY official results.

#### Scenario: Compliance audit

- GIVEN any rendered page
- WHEN audited
- THEN no ad inventory, bolita, or prediction content is present
