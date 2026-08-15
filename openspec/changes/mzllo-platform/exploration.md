# Exploration: Mzllo Boliteros Platform (mzllo-platform)

> Research date: 2026-08-15. All endpoints below were **verified live** with curl/Playwright on that date.
> Greenfield project — no codebase to inspect. This exploration covers data sources, stack, Telegram bot, monetization, architecture, and risks.

---

## 1. Official Data Sources (verified live)

### 1.1 Florida Lottery (floridalottery.com)

Stack: Adobe Experience Manager (AEM) front end backed by an Azure API Management gateway.

- **API base**: `https://apim-website-prod-eastus.azure-api.net` — requires header `x-partner: web` (no API key, no auth token).
- **Latest draws**: `GET /drawgamesapp/getLatestDrawGames` → JSON array of all games.
  - Fields: `Id`, `GameName`, `DrawDate` ("MM/dd/yyyy HH:mm:ss AM", ET), `WinningMultiplier`, `NextJackpotAmount`, `NextJackpotDate`, `IsRolloverFlag`, `DrawNumbers[]` (`NumberPick`, `NumberType` e.g. `wn1`..`wn6`), `Tiers[]` (`PrizeLevel`, `Winners`, `PrizeAmount`).
  - Games observed (16): LOTTO(3), EZMATCH LOTTO(4), JACKPOT TRIPLE PLAY(23), CASH POP(24), PICK 3(104), PICK 4(108), FANTASY 5(113), EZMATCH FANTASY 5(114), POWER BALL(121), POWER BALL DP(122), MEGA MILLIONS(126), PICK 2(127), PICK 5(128), CASH4LIFE(138), LOTTO DP(150). Treat as data-driven; CASH4LIFE's last FL drawing observed 2026-02-21 (possibly retired — confirm at design time).
- **History**: `GET /drawgamesapp/searchgames?id={gameId}&startDate={DD-MMM-YYYY}[&endDate=...]` → per-draw records incl. `DrawType` (MIDDAY/EVENING). Verified for FANTASY 5 (id 113) and date-range.
- **Draw schedule (ET)** — from official game pages: Pick 2/3/4/5 midday **1:30pm** & evening **9:45pm**; Fantasy 5 midday **1:05pm** & evening **11:15pm** (daily); FL Lotto Wed/Sat **11:15pm** (Double Play right after); Powerball Mon/Wed/Sat **10:59pm** (Double Play after); Mega Millions Tue/Fri **11:00pm**; Cash4Life nightly **9:00pm** (retired?); Jackpot Triple Play Tue/Thu/Fri **11:15pm**; Cash Pop 5 draws/day.
- **Rate limits / keys**: none documented; no key required. Keep polling modest (every 5–15 min around draw times).

### 1.2 Georgia Lottery (galottery.com)

Stack: Sitecore with a keyless JSON API.

- **API**: `GET https://www.galottery.com/api/v2/draw-games/draws/` → paginated via `/page?page=N&size=50` (`nextPageUrl`, `pageUrls`). No key, no headers.
- **Record**: `gameName`, `id`, `drawDay[]`, `status` (OPEN/CLOSED), `openTime`/`closeTime`/`drawTime`/`resultsAvailableTime` (epoch ms), `estimatedJackpot`, `results[{primary[], primaryRevealOrder[], drawType}]`, `prizeTiers[{name, shareCount, shareAmount, totalAmount, prizeType}]`, `gameRuleSet{gameId, ...}`.
- **Games observed** (gameId → name): 10 POWERBALL, 12 MEGA MILLIONS, 13 FANTASY 5, 14 KENO!, 15 MILLION 4 LIFE (active 2026 — successor to Jumbo Bucks), 16 CASH 3, 17 CASH 4, 18 ALL OR NOTHING (retired 2019), 19 JUMBO LOTTO (retired 2024), 21 CASH POP, 28 CASH4LIFE.
- **Key advantage**: the feed includes **future scheduled draws** with exact `drawTime` — the scheduler can read next-draw times directly from data instead of hard-coding a calendar.
- **Sample draw times (ET, from feed)**: Powerball Mon/Wed/Sat 21:59; Mega Millions Tue/Fri 22:45; Fantasy 5 daily 22:45; Cash 3/Cash 4 multiple draws/day (12:20, 18:50, 22:45 observed); Cash4Life 21:45 daily; KENO! every ~3–4 min.
- **Rate limits / keys**: none documented. Keep polling modest.

### 1.3 New York Lottery (nylottery.ny.gov)

Stack: Gatsby SPA; official data published through **NY State Open Data (Socrata)** — stable, documented API.

- **API**: `GET https://data.ny.gov/resource/{dataset_id}.json?$limit=N&$where=...` (SoQL). No key required at low volume; app token recommended for higher limits (~1000 req/5 min with token).
- **Datasets (verified)**:
  - Mega Millions: `5xaw-6ayf` (2002–) — `draw_date`, `winning_numbers`, `mega_ball`
  - Powerball: `d6yy-54nr` (2010–) — `winning_numbers`, `multiplier`, `double_play_winning_numbers`
  - Take 5: `dg63-4siq` (1992–) — `midday_winning_numbers`, `evening_winning_numbers`
  - Numbers + Win 4 combined: `hsys-3def` (1980–) — `midday_daily`, `evening_daily`, `midday_win_4`, `evening_win_4`
  - NY Lotto: `6nbc-h7bj` (2001–) — `winning_numbers`, `bonus`
  - Quick Draw: `7sqk-ycpk` (2013–) — ~every 4 min
  - Cash4Life: `kwxv-fwze` (2014–2026, retired), Millionaire For Life: `a4w9-a3tp` (2026–)
- **Schedule (ET)** — standard public schedule (SPA hides text; consistent with dataset fields): Numbers/Win 4 midday **2:30pm** (Mon–Sat) & evening **10:30pm** daily; Take 5 same; NY Lotto Wed/Sat **8:15pm**; Powerball Mon/Wed/Sat **10:59pm**; Mega Millions Tue/Fri **11:00pm**; Quick Draw every ~4 min (4pm–3am).
- **Rate limits / keys**: none required for our volume.

### 1.4 Aggregator services (assessed)

Candidates: lotteriesapi.com, lotteryapi.com, lotterydata.io, lotteryresultsfeed.com.
- Pros: one key for many states, uniform schema, deep history, docs/SLAs.
- Cons: paid (~$10–50/mo typical, pricing pages JS-rendered/unverified), extra latency + third-party dependency, republication ToS of their own, and — decisively — **the three official keyless feeds above already cover every game needed**. 
- Verdict: **do not use** for MVP. Re-evaluate only if scope expands to many more states.

### 1.5 ToS / republication notes

- All three are state-government entities publishing public results; result republication with attribution is widespread industry practice. Recommended posture: cite official source + draw date on every post/page, link to official sites, add "official results at floridalottery.com / galottery.com / nylottery.ny.gov" and a prize-verification disclaimer.
- FL has a Terms of Use page; GA/NY similar. None currently gate or key their feeds. **Do a short legal review before monetizing.**
- Keep request volume modest; endpoints are undocumented (FL/GA) and can change without notice.

---

## 2. Stack Recommendation

### Comparison

| Criterion | Node.js + TypeScript | Python 3.10 (pytest/httpx) | Rust (cargo 1.92) |
|---|---|---|---|
| Web frontend + API | Excellent (Hono/Fastify/Next, one language) | Good (FastAPI + templates/htmx) | OK (axum + askama) — more work |
| Scheduled ingest | node-cron / timers; fetch built-in | APScheduler; httpx (installed) | tokio timers + reqwest |
| Telegram bot | grammY / telegraf (very mature) | aiogram / python-telegram-bot (mature) | teloxide (works, smaller ecosystem) |
| Result-card images | sharp + resvg-js (SVG→PNG, crisp, no browser) | Pillow (installed? not listed) / cairosvg | image crate — more code |
| TDD in env | node:test built-in ✓ (tsc 6.0.3 ✓) | pytest 9.0.3 ✓ + httpx ✓ + playwright ✓ | cargo test ✓ |
| Deploy simplicity | 1–2 small Node processes, SQLite | 1–2 Python processes, SQLite | single static binary — but slower to build features |
| Iteration speed (greenfield product) | Fast | Fast | Slowest of the three |

### Recommendation: **Node.js 24 + TypeScript** (single stack for the whole platform)

Rationale:
1. **One language across every layer** — web frontend, ingest worker, Telegram bot, image card generator — sharing types for the results data model (zod schemas validated once, reused everywhere).
2. **Best-fit libraries already battle-tested**: grammY (Telegram), sharp + resvg-js (result cards as SVG→PNG without a browser), better-sqlite3 (zero-ops storage), Hono or Fastify (web + API), node-cron (scheduling), built-in `fetch` and `node:test` (TDD: red-green-refactor with `tsc 6.0.3` for types).
3. **Deployment simplicity**: one VPS (~$5–10/mo) running one or two Node processes + SQLite + optional reverse proxy; no orchestrator, no containers needed for MVP.
4. Python is a fully viable alternative (pytest/httpx/playwright already installed; aiogram is excellent) — if the team is Python-first, use Python end-to-end instead. The important thing is **one language, not a mix**. Rust is overkill for the iteration speed this product needs.

---

## 3. Telegram Bot Design

- **Creation**: @BotFather → `/newbot` → token. Add the bot as **admin** to both channels (public + private/premium). Bot cannot message users first — it posts to channels and responds in chats.
- **Public channel**: bot posts result cards (`sendPhoto` with PNG card) + optional caption with numbers/source link. No gating.
- **Private/premium channel**: set invite link to "request to join". Bot receives `chat_join_request` updates and approves only verified members:
  - `approveChatJoinRequest` / `declineChatJoinRequest` (Bot API 6.2+, stable).
  - Approval flow: user pays (see Monetization) → bot approves their join request; unapproved requests get declined or time out.
- **Scheduled posting**: long-running worker process with node-cron; poll feeds at each state's draw times (+backoff retries for delays), upsert draws into DB, then publisher posts new draws to both channels. GA's API exposes exact next-draw times in data — use it. Alternatively use webhook for updates (needs public TLS URL); long polling is fine for MVP.
- **AI assistant** (the "AI" differentiator):
  - One LLM API (OpenAI-compatible endpoint) with **function/tool calling** against the SQLite results store — the model answers only from tool results.
  - System prompt constraints (compliance-critical): answer factual historical results, odds, prize-tier stats; **never predict numbers, never reference the underground bolita game, always cite source + date, add "not financial advice" style disclaimer**.
  - Keep prompts stateless per question; cap tokens; log queries for abuse monitoring.
- **Rate limits (verified, official FAQ)**: 1 msg/sec per single chat; 20 msg/min per group; ~30 msg/sec global broadcast (paid broadcasts raise to 1000/sec at 0.1 Stars/msg, requires 100k Stars + 100k MAU). We post a handful of messages per draw — **no issue**.

---

## 4. Monetization Model

Ranked by reliability for a lottery-results info platform:

1. **Premium membership (private channel)** — primary. Recurring fee → access to private channel.
   - Options: (a) external payments (Stripe/PayPal) + bot approves join request — simplest, no store cut, full control; (b) Telegram Stars-based paid channel subscriptions (native, revenue share with Telegram) — native UX but store cut; (c) both.
2. **Direct sponsors / local advertisers** — lottery-adjacent businesses (news, financial services, entertainment) on the website; no platform policy risk vs programmatic ads.
3. **Tips** — Telegram Stars "tip" button on public channel posts.
4. **Display ads (Google AdSense et al.)** — **HIGH POLICY RISK**: lottery/gambling-adjacent content is restricted by ad networks; results sites are frequently demonetized, and an AdSense gambling-policy update landed August 2026 (policy in flux). Do **not** build the business model on programmatic ads; if used, run only on clearly non-gambling pages and verify current policy.
5. **Affiliates** — few legitimate lottery-specific affiliate programs exist; prefer general financial/news affiliates or responsible-gambling resources. Low priority.

---

## 5. Architecture Sketch

```
                    ┌──────────────────────────┐
 FL API ───────────▶│  Ingest worker (Node/TS) │
 GA API ───────────▶│  - poll on draw schedule │
 NY Socrata API ───▶│  - zod-validate payload  │
                    │  - upsert draws          │
                    └────────────┬─────────────┘
                                 ▼
                    ┌──────────────────────────┐
                    │  SQLite (better-sqlite3) │  draw history, jackpots, tiers,
                    └────────────┬─────────────┘  publish state, members
            ┌────────────────────┼─────────────────────┐
            ▼                    ▼                     ▼
 ┌────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
 │ Web frontend (web) │  │ Publisher        │  │ Telegram bot         │
 │ - results pages    │  │ - render SVG card│  │ - /results, /stats   │
 │ - history, SEO     │  │ - sharp→PNG      │  │ - AI assistant (tool)│
 │ - member checkout  │  │ - sendPhoto both │  │ - join-request gate  │
 └────────────────────┘  │   channels       │  └──────────────────────┘
                         └──────────────────┘
```

**Data model (core tables)**:
- `draws`: id, state, game_id, game_name, draw_date, draw_type (midday/evening/night), numbers (JSON), bonus/multiplier, jackpot, prize_tiers (JSON), source_ref (feed id/url), ingested_at, published_at, tg_public_msg_id, tg_private_msg_id, unique(state, game_id, draw_date, draw_type).
- `members`: telegram_user_id, payment_ref, status, approved_at.
- `publish_log`: draw_id, channel, message_id, status, error.

**Deployment**: one small VPS (web + worker/bot as one or two Node processes) with SQLite; optional Caddy reverse proxy for the website; or PaaS (Fly.io/Railway) later. No containers/K8s for MVP.

---

## 6. Risks

- **ToS / legal**: state ToS pages exist (esp. FL); results republication is standard practice but needs attribution + links + a short legal review before monetizing. Keep content strictly official-results only.
- **Brand/legal boundary (bolita)**: the product must NEVER reference or accept underground bolita numbers — hard requirement; the AI assistant must refuse any prediction and any bolita-related query; monitor content pipeline for contamination.
- **Endpoint stability**: FL (Azure APIM, `x-partner: web` header) and GA APIs are undocumented and may change; mitigate with zod validation, health checks, alerting, and a fallback (official HTML pages / NY Socrata is stable + documented).
- **Schedule reliability**: draws can run late; use `resultsAvailableTime`/polling with exponential backoff; never hard-fail a poll.
- **Rate limits**: keep polling low-frequency; honor retry-after; bot broadcasts are well under Telegram limits.
- **Monetization policy risk**: programmatic ads may be rejected/demonetized for gambling-adjacent content — lead with premium membership + direct sponsors.
- **AI compliance**: hallucinated or predictive answers are a legal/brand risk — tool-only responses, strict system prompt, disclaimers, query logging.

---

## Ready for Proposal

**Yes.** Proceed to `sdd-propose` for `mzllo-platform`. Tell the user: exploration verified keyless official feeds for all three states (FL APIM endpoint + GA JSON API + NY Socrata), recommends a single Node.js + TypeScript stack (Python viable alternative), a public/private Telegram channel flow with join-request approval, and premium-membership-first monetization — with the caveat that FL/GA endpoints are undocumented and ad-network policy for lottery content is a real risk.
