# Proposal: Mzllo Platform (mzllo-platform)

## Intent
Legal lottery-results platform: official FL/GA/NY draws, bilingual EN/ES, for Latina community (Miami/FL) + general players. MVP = website (real-time results) + Telegram bot (public + private premium channels) + premium membership. Monetization: premium membership (anchor) + affiliates (complement); no programmatic ads. Hard boundary: never bolita, never predictions, official sources only.

## Scope

### In Scope
- Ingest worker: poll official feeds (FL APIM, GA JSON, NY Socrata), zod validation + HTML fallback
- Storage: SQLite (draws, members, publish_log)
- Web: bilingual results pages (current + history), SEO, affiliate links
- Bot: posts SVG→PNG result cards to public channel; premium channel gated via chat_join_request approval
- AI: tool-calling results assistant (public); AI analysis (premium)
- Membership: payment → bot auto-approves join
- Strict TDD (node:test)

### Out of Scope
- Non-official sources, aggregators, bolita
- Predictions / predictive analysis
- Programmatic ads; states beyond FL/GA/NY; deep history backfill; languages beyond EN/ES; sponsors

## Capabilities
> Contract for sdd-spec. No existing specs — all new.

### New Capabilities
- `ingest`: feed polling, zod validation, HTML fallback
- `results-store`: SQLite schema, queries, publish state
- `results-web`: bilingual pages, history, SEO
- `telegram-bot`: channels, posts, commands, join gate
- `ai-assistant`: tool-only assistant + premium analysis
- `membership`: payments, status, join approval
- `affiliate-links`: curated links + disclosure

### Modified Capabilities
None

## Approach
Node.js 24 + TypeScript across web, worker, bot, cards; node:test TDD. Worker polls draw schedules (GA feed exposes next drawTime), zod-validates, upserts. Publisher renders SVG cards → sharp→PNG → sendPhoto to both channels. Premium gate: approveChatJoinRequest post-payment. AI: OpenAI-compatible API, function-calling against DB, tool-only answers, anti-prediction prompt. Deploy: one VPS, SQLite, optional Caddy.
Phases: (1) ingest+store → (2) web → (3) cards/publisher → (4) bot+gate → (5) AI → (6) membership+affiliates → (7) bilingual polish.

## Alternatives Considered
- Aggregator APIs: rejected — paid, third-party risk; official keyless feeds cover all games
- Python/Rust: viable, rejected — Node best fits web+bot+cards iteration (one language)
- Ads vs premium: ads rejected (demonetization risk); premium + vetted affiliates

## Affected Areas

| Area | Impact |
|------|--------|
| `src/ingest/` `src/store/` `src/web/` `src/bot/` `src/ai/` `src/membership/` | All New |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| FL/GA endpoints undocumented | High | zod validation, HTML fallback, alerts |
| Late draws | Med | backoff polling, resultsAvailableTime |
| Bilingual complexity | Med | i18n from day one |
| Payment→approval friction | Med | clear UX, manual-approve fallback |
| Bolita/prediction contamination | Med | hard refusals, audits, legal review |
| Monetization policy | Med | no programmatic ads |

## Rollback Plan
Additive-only migrations; pollers feature-flagged; stop publisher rolls back channels; approval gate reversible; git revert (greenfield, no data risk).

## Dependencies
- Node 24, TS, better-sqlite3, grammY, sharp/resvg-js, zod, node-cron (verified)
- Telegram Bot API 6.2+; LLM + payment providers (Stripe/PayPal vs Stars) decided in design
- Legal review before monetization

## Success Criteria
- [ ] All configured games published ≤15 min after official availability (3 states)
- [ ] Website bilingual EN/ES, current + history, indexed
- [ ] Bot answers from tool results only; 100% refusal of predictions/bolita
- [ ] Premium flow: pay → join → auto-approve; non-members excluded
- [ ] Audit shows zero bolita/prediction content

## User Story / Decision Record
- Monetization: premium anchor + affiliates; NO ads
- Audience: bilingual EN/ES; Latina Miami/FL + FL/GA/NY players
- Games: FL Pick 2/3/4/5, Fantasy 5, PB, MM; GA Cash 3/4, Fantasy 5, PB, MM; NY Numbers, Win 4, Take 5, PB, MM
- AI: public results assistant + premium analysis
- MVP: website + bot (both channels) + membership together
- Stack: Node.js 24 + TS; strict TDD node:test
