# Mzllo Boliteros

Official lottery results platform for FL, GA, and NY. Bilingual EN/ES web + Telegram bot with premium membership.

**No predictions. No bolita. Only verified official sources.**

## Quick Start

```bash
npm install
npm test              # run all 139 tests
npm run typecheck     # type-check (node:sqlite has a pre-existing issue in ny.ts)
```

## Architecture

```
src/
├── config/       Game registry (FL/GA/NY schedules, CASH4LIFE retirement)
├── store/        SQLite: draws, members, publish_log, ai_query_log
├── ingest/       Per-state adapters (FL APIM, GA JSON, NY Socrata) + scheduler
├── cards/        SVG result cards → PNG via sharp
├── publisher/    Idempotent Telegram channel publisher
├── bot/          grammY bot: /results, /stats, /help, join gate
├── ai/           Tool-only assistant, bolita refusals, membership gate
├── membership/   Stars payments, member lifecycle, affiliate links
└── web/          Hono bilingual app (EN/ES), SEO, hreflang
```

## Stack

- **Runtime:** Node.js 24 + TypeScript (native type stripping)
- **Database:** SQLite via `node:sqlite` (DatabaseSync)
- **Bot:** grammy (Telegram)
- **Cards:** SVG + sharp → PNG
- **Web:** Hono
- **Tests:** `node:test` (139 tests, strict TDD)
- **Validation:** zod at every external boundary

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram Bot API token |
| `PREMIUM_CHANNEL_ID` | Yes | Telegram channel ID for premium content |
| `PUBLIC_CHANNEL_ID` | Yes | Telegram channel ID for public results |
| `FL_API_ENABLED` | No | Enable FL poller (default: true) |
| `GA_API_ENABLED` | No | Enable GA poller (default: true) |
| `NY_API_ENABLED` | No | Enable NY poller (default: true) |
| `AI_API_URL` | No | OpenAI-compatible API endpoint |
| `AI_API_KEY` | No | API key for AI assistant |
| `DB_PATH` | No | SQLite file path (default: in-memory for tests) |
| `PORT` | No | Web server port (default: 3000) |

## Data Sources

| State | Source | Auth |
|-------|--------|------|
| Florida | FL APIM (`x-partner: web`) | Keyless |
| Georgia | GA Lottery JSON API | Keyless |
| New York | NY Socrata SoQL | Keyless (app token optional) |

## Testing

```bash
npm test                    # all tests
node --test "test/store/**" # store only
node --test "test/ingest/**" # ingest only
node --test "test/bot/**"   # bot only
node --test "test/ai/**"    # AI only
node --test "test/web/**"   # web only
```

## Compliance

- Official sources only — no aggregators, no scrapers
- 100% refusal of predictions/bolita (AIA-2)
- Query audit log (ai_query_log)
- No programmatic ads
- Legal review required before monetization

## License

Private — all rights reserved.
