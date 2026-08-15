# Design: Mzllo Platform (mzllo-platform)

## Technical Approach

Greenfield Node.js 24 + TypeScript single package. One worker process runs ingest (node-cron scheduler polling FL/GA/NY official feeds), the publisher (SVG→PNG result cards → grammY `sendPhoto`), and the premium join-gate; a second process serves the Hono web app + API. SQLite (better-sqlite3) is the single source of truth. AI assistant answers only from store-backed tools. Strict TDD with node:test; zod at every external boundary (ING-2). Covers all 7 capabilities (ingest, results-store, results-web, telegram-bot, ai-assistant, membership, affiliate-links).

## Architecture Decisions

### AD-1: Payment provider — Telegram Stars (MVP), Stripe deferred

| Option | Tradeoffs | Decision |
|---|---|---|
| Stripe / PayPal | Full control, no store cut, recurring billing mature; but webhooks + merchant onboarding, friction (user leaves Telegram), legal review | Defer to phase 2 (web annual plans) |
| Telegram Stars (subscription invoice, 30d recurring) | Native in-chat UX, zero payment infra, no webhooks; ~30% revenue share, payout via Fragment, legal review before go-live | **MVP provider** |

**Rationale**: premium = access to a private Telegram channel; Stars is the native rail (exploration §4) and removes all payment infrastructure from MVP. Keeps the spec'd pay→join→approve flow intact: subscription invoice paid → `successful_payment` → `members.status=active` → pending `chat_join_request` auto-approved (TGB-3, MEM-1/2). Manual operator approve remains the fallback (MEM-2).

### AD-2: FL CASH4LIFE — registry-driven retirement

| Option | Tradeoffs | Decision |
|---|---|---|
| Hard-code game list | Silent retirement breaks poller; ops blind | Reject |
| Registry + health window | Per-game status in `games` table; silent past `expected_schedule` window → `possible_retired` + operator alert; ingest never blocks (ING-3) | **Chosen** |

**Rationale**: satisfies both ING-3 scenarios; retirement is a one-click operator confirm (`status→retired`), history retained. Registered games only FL/GA/NY per proposal.

### AD-3: Per-state ingest adapters + HTML fallback

| Option | Tradeoffs | Decision |
|---|---|---|
| One generic fetcher | Three heterogeneous APIs (FL APIM `x-partner: web`, GA paginated JSON with `drawTime`, NY SoQL) — generic code would be all conditionals | Reject |
| Adapter per state | Zod schema per state over shared `Draw` type; GA scheduler reads next `drawTime` from feed data (no hard-coded calendar); FL/GA HTML fallback (cheerio) on schema drift; exponential backoff + jitter, alert after window | **Chosen** |

**Rationale**: isolates undocumented-endpoint risk (FL/GA) behind one tested interface; ING-1/ING-2 scenarios map 1:1 to the adapter contract.

### AD-4: AI — tool-only answers, deterministic guardrails

| Option | Tradeoffs | Decision |
|---|---|---|
| Free-form chat + prompt guard | Hallucination/prediction risk — legal exposure | Reject |
| Tool-calling + intent classifier | Answers only from tool results; bolita/prediction intent detected pre-tool (keyword + classifier) → hard refusal + disclaimer; queries logged to `ai_query_log`; premium analysis gated by membership tool (AIA-1/2/3) | **Chosen** |

**Rationale**: compliance is non-negotiable; refusal path is deterministic and testable.

### AD-5: Publisher idempotency

`publish_log` UNIQUE(draw_id, channel): status `sent` → skip; `failed` → retry with backoff (STO-3). Cards: hand-rolled SVG template → sharp PNG → `sendPhoto`, caption = numbers + source + draw date.

## Data Flow

### Ingest → Publish

```
scheduler (node-cron; GA drawTime from feed) → adapter.fetchLatest()
  → zod validate → upsert draws (UNIQUE state,game_id,draw_date,draw_type)
  → publisher: SVG → sharp PNG → sendPhoto (public; premium as configured)
  → publish_log(draw_id, channel) — idempotent retry
```

### Payment → Approval

```
Stars subscription link → user pays in Telegram
  → successful_payment → INSERT members(active, payment_ref)
  → user requests premium-channel join
  → chat_join_request → member active? approve : decline/timeout
  → operator manual-approve fallback
```

### AI Query

```
user → /ask → intent classifier → bolita/prediction? → hard refusal + disclaimer
  → else tool_call(store queries) → answer from tool output + source/date
  → premium analysis requested → membership tool check → deny if not active
  → log to ai_query_log
```

## File Changes (greenfield)

| File | Action | Description |
|---|---|---|
| `package.json`, `tsconfig.json` | Create | Node 24 + TS; `node --test` script |
| `src/config/games.registry.ts` | Create | Game registry + schedules (ING-3) |
| `src/ingest/adapter.ts` | Create | Adapter interface + shared types |
| `src/ingest/{fl,ga,ny}.ts` | Create | Per-state polling + zod schemas |
| `src/ingest/html-fallback.ts` | Create | FL/GA official-page parser (cheerio) |
| `src/ingest/scheduler.ts` | Create | node-cron, backoff, alerts |
| `src/store/{db.ts,schema.sql,queries.ts}` | Create | SQLite: games, draws, members, publish_log, ai_query_log |
| `src/cards/{render-svg.ts,to-png.ts}` | Create | SVG template + sharp PNG |
| `src/publisher/publish.ts` | Create | Idempotent channel posting |
| `src/bot/{index.ts,commands.ts,join-gate.ts}` | Create | grammY: /results /stats, gate |
| `src/ai/{assistant.ts,tools.ts,guardrails.ts}` | Create | Tool calling, refusals, logging |
| `src/membership/{stars.ts,status.ts}` | Create | Invoice/subscription, member lifecycle |
| `src/web/{index.ts,routes.ts,i18n.ts}` | Create | Hono, EN/ES pages, SEO, alternates |
| `src/web/affiliates.ts` | Create | Curated links + bilingual disclosure (AFF-1/2) |
| `test/**` | Create | node:test per module |

## Interfaces / Contracts

```ts
interface DrawAdapter { state: State; fetchLatest(): Promise<Draw[]> }
interface Draw {
  state; gameId; gameName; drawDate; drawType: 'midday'|'evening';
  numbers: number[]; bonus?; multiplier?; jackpot?;
  prizeTiers: Tier[]; sourceRef; sourceUrl;
}
type MemberStatus = 'pending' | 'active' | 'expired';
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | zod schemas, HTML fallback, SVG render, guardrails classifier, i18n fallback | node:test, fixture payloads |
| Integration | adapters vs recorded fixtures, upsert idempotency, publish retry, join-gate decision | in-memory SQLite + grammY mocks |
| E2E | pay→approve happy path, AI refusals (prediction/bolita) | mocked Bot API + OpenAI-compatible stub |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary (sharp/resvg-js are native libraries, node-cron in-process; no shell/exec in design).

## Migration / Rollout

Greenfield — additive schema only. Phase order per proposal: ingest+store → web → cards/publisher → bot+gate → AI → membership+affiliates → bilingual polish. Pollers behind env feature flags (FL/GA/NY independently disable-able); publisher halt-safe via idempotent `publish_log`.

## Open Questions

- [ ] Stars payout (Fragment) mechanics + legal review before monetization — go-live gate, not a design blocker
- [ ] OpenAI-compatible provider/endpoint — env-configured, no code impact
- [ ] NY Socrata app token for higher rate limits (optional)
