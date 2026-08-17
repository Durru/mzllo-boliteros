# Tasks: Mzllo Platform

## Review Workload Forecast

~4,500 changed lines. Risk: High. Chained PRs: Yes. Split: PR 1→PR 7.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Work Units

| # | Unit | Test cmd | Harness | Rollback |
|---|------|----------|---------|----------|
| 1 | Foundation+store PR 1 | `node --test test/store` | fixtures | revert src/store src/config |
| 2 | Ingest PR 2 | `node --test test/ingest` | live feeds→upsert | revert src/ingest |
| 3 | Cards+publisher PR 3 | `node --test test/cards test/publisher` | render PNG | revert src/cards src/publisher |
| 4 | Bot+gate PR 4 | `node --test test/bot` | channel join flows | revert src/bot |
| 5 | AI PR 5 | `node --test test/ai` | stub /ask | revert src/ai |
| 6 | Membership+affiliates PR 6 | `node --test test/membership` | mock payment (Stars legal-gated) | revert src/membership affiliates.ts |
| 7 | Web+polish PR 7 | `node --test test/web` | dev:web EN/ES | revert src/web |

## Phase 1: Foundation + Store

- [x] 1.1 RED: STO-1 idempotent upsert, STO-2 empty history, STO-3 retry
- [x] 1.2 Create package.json, tsconfig.json, test script
- [x] 1.3 Create schema.sql (draws UNIQUE(state,game_id,draw_date,draw_type), members, publish_log, ai_query_log; additive-only)
- [x] 1.4 Create db.ts + queries.ts; GREEN: STO-1/2/3 pass
- [x] 1.5 Create games.registry.ts (FL/GA/NY schedules; CASH4LIFE window)

## Phase 2: Ingest

- [x] 2.1 RED: ING-1 poll/retry/alert; ING-2 drift→alert+fallback; ING-3 retire+scope
- [x] 2.2 Create adapter.ts (DrawAdapter, Draw)
- [x] 2.3 Create fl/ga/ny.ts (zod, x-partner, drawTime GA)
- [x] 2.4 Create html-fallback.ts (cheerio)
- [x] 2.5 Create scheduler.ts (node-cron, backoff+jitter, alerts, per-state flags); GREEN: ING-1/2/3 pass

## Phase 3: Cards + Publisher

- [x] 3.1 RED: SVG fixtures; TGB-1 send + retry
- [x] 3.2 Create render-svg.ts + to-png.ts (sharp)
- [x] 3.3 Create publish.ts (publish_log UNIQUE(draw_id,channel), retry); GREEN: STO-3 + TGB-1 pass

## Phase 4: Bot + Join Gate

- [x] 4.1 RED: TGB-2 /results /stats + help; TGB-3 decline/timeout + approve
- [x] 4.2 Create index.ts + commands.ts (grammY)
- [x] 4.3 Create join-gate.ts (automatable approve/decline); GREEN: TGB-2/3 pass

## Phase 5: AI Assistant

- [x] 5.1 RED: AIA-1 tool-only, AIA-2 refusals, AIA-3 premium deny
- [x] 5.2 Create guardrails.ts (classifier, refusals, disclaimer)
- [x] 5.3 Create tools.ts (store queries) + assistant.ts (tool-calling, membership gate, ai_query_log); GREEN: AIA-1/2/3 pass

## Phase 6: Membership + Affiliates

- [x] 6.1 RED: MEM-1 pay success/fail (Stars; no pre-payment access), MEM-2 auto+manual
- [x] 6.2 Create stars.ts (subscription invoice) + status.ts (lifecycle, payment_ref); GREEN: MEM-1/2 + TGB-3 pass
- [x] 6.3 Create affiliates.ts (AFF-1 zero-render; AFF-2 disclosure, missing→flag)

## Phase 7: Web + Polish

- [x] 7.1 RED: WEB-1 toggle + EN fallback, WEB-2 metadata/alternates, WEB-3 audit
- [x] 7.2 Create i18n.ts (EN default), routes.ts, index.ts (Hono, locale URLs)
- [x] 7.3 Add SEO: stable URLs, meta, hreflang, attribution
- [x] 7.4 GREEN: WEB-1/2/3; e2e (mocked Bot API, AI stub)
- [x] 7.5 Docs: README, env, compliance
