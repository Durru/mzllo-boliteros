/**
 * Mzllo Boliteros — Main entry point
 *
 * Wires together: database, web server, bot, and ingest scheduler.
 * Run: node --import node:sqlite src/main.ts
 */

import { openDb } from './store/db.ts';
import { createWebApp } from './web/index.ts';
import { StateScheduler } from './ingest/scheduler.ts';
import { FlAdapter } from './ingest/fl.ts';
import { GaAdapter } from './ingest/ga.ts';
import { NyAdapter } from './ingest/ny.ts';
import type { State } from './store/queries.ts';
import { upsertDraw } from './store/queries.ts';
import { serve } from '@hono/node-server';
import cron from 'node-cron';

// --- Config ---
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const DB_PATH = process.env.DB_PATH ?? ':memory:';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PUBLIC_CHANNEL_ID = process.env.PUBLIC_CHANNEL_ID;
const PREMIUM_CHANNEL_ID = process.env.PREMIUM_CHANNEL_ID;

const FL_ENABLED = process.env.FL_API_ENABLED !== 'false';
const GA_ENABLED = process.env.GA_API_ENABLED !== 'false';
const NY_ENABLED = process.env.NY_API_ENABLED !== 'false';

// --- Database ---
console.log(`📂 Opening database: ${DB_PATH === ':memory:' ? '(in-memory)' : DB_PATH}`);
const db = openDb({ filename: DB_PATH });

// --- Web server ---
const app = createWebApp(db);
const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`🌐 Web server running on http://localhost:${info.port}`);
});

// --- Ingest scheduler ---
const scheduler = new StateScheduler();
scheduler.setEnabled('FL', FL_ENABLED);
scheduler.setEnabled('GA', GA_ENABLED);
scheduler.setEnabled('NY', NY_ENABLED);

const adapters = new Map<State, import('./ingest/adapter.ts').DrawAdapter>([
  ['FL', new FlAdapter()],
  ['GA', new GaAdapter()],
  ['NY', new NyAdapter()],
]);

// Alert handler for missing draws / schema drift
scheduler.onAlert((state, error) => {
  console.error(`⚠️  Alert [${state}]: ${error}`);
});

// Poll function — fetches draws and upserts to store
async function pollState(state: State): Promise<void> {
  const adapter = adapters.get(state);
  if (!adapter) return;

  try {
    const result = await scheduler.pollWithRetry(adapter, {
      maxRetries: 3,
      baseDelayMs: 2000,
      windowMs: 60_000,
    });

    if (result.success && result.draws.length > 0) {
      for (const draw of result.draws) {
        upsertDraw(db, draw);
      }
      console.log(`✅ [${state}] Stored ${result.draws.length} draw(s)`);
    } else if (!result.success) {
      console.log(`⏳ [${state}] No draws available (${result.error})`);
    }
  } catch (err) {
    console.error(`❌ [${state}] Poll error:`, err);
  }
}

// Schedule polling — every 30 minutes during draw hours
// FL: midday 13:30 ET, evening 21:00 ET
// GA: midday 13:00 ET, evening 19:30 ET
// NY: midday 14:20 ET, evening 21:30 ET
console.log('⏰ Starting ingest scheduler (every 30 minutes)');

async function pollAll(): Promise<void> {
  const states: State[] = [];
  if (FL_ENABLED) states.push('FL');
  if (GA_ENABLED) states.push('GA');
  if (NY_ENABLED) states.push('NY');

  for (const state of states) {
    await pollState(state);
  }
}

// Run first poll immediately, then schedule
pollAll().catch(console.error);
cron.schedule('*/30 * * * *', () => {
  pollAll().catch(console.error);
});

// --- Graceful shutdown ---
function shutdown(signal: string): void {
  console.log(`\n🛑 ${signal} received, shutting down...`);
  server.close(() => {
    db.close();
    console.log('✅ Shutdown complete');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log('🚀 Mzllo Boliteros started');
console.log(`   States: ${[FL_ENABLED && 'FL', GA_ENABLED && 'GA', NY_ENABLED && 'NY'].filter(Boolean).join(', ')}`);
console.log(`   Web: http://localhost:${PORT}`);
console.log(`   Bot: ${TELEGRAM_BOT_TOKEN ? 'configured' : 'not configured (set TELEGRAM_BOT_TOKEN)'}`);
