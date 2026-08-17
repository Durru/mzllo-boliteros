import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../../src/store/db.ts';
import { upsertDraw } from '../../src/store/queries.ts';
import { publishDraw, type BotApi, type PublishDraw } from '../../src/publisher/publish.ts';
import type { DrawInput } from '../../src/store/queries.ts';
import type { DatabaseSync } from 'node:sqlite';

function sampleDrawInput(overrides: Partial<DrawInput> = {}): DrawInput {
  return {
    state: 'FL',
    gameId: 'pick3',
    gameName: 'Pick 3',
    drawDate: '2026-08-15',
    drawType: 'evening',
    numbers: [4, 1, 7],
    bonus: null,
    multiplier: null,
    jackpot: null,
    prizeTiers: [],
    sourceRef: 'fl-daily-2026-08-15',
    sourceUrl: 'https://www.flalottery.com/exptkt/pick3',
    ...overrides,
  };
}

function makePublishDraw(db: DatabaseSync, overrides: Partial<DrawInput> = {}): PublishDraw {
  const id = upsertDraw(db, sampleDrawInput(overrides));
  return { id, ...sampleDrawInput(overrides) };
}

function mockBotApi(overrides: Partial<BotApi> = {}): BotApi & { calls: Array<{ chatId: string; photo: Buffer; caption: string }> } {
  const calls: Array<{ chatId: string; photo: Buffer; caption: string }> = [];
  return {
    calls,
    sendPhoto: async (chatId: string, photo: Buffer, caption: string) => {
      calls.push({ chatId, photo, caption });
      return { message_id: 42 };
    },
    ...overrides,
  };
}

describe('publishDraw', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb();
  });

  it('sends photo and marks as sent (TGB-1 happy path)', async () => {
    const draw = makePublishDraw(db);
    const bot = mockBotApi();

    const result = await publishDraw(db, draw, 'public', '-100123456', bot);

    assert.equal(result.sent, true);
    assert.equal(result.messageId, '42');
    assert.equal(bot.calls.length, 1);
    assert.equal(bot.calls[0].chatId, '-100123456');
    assert.ok(Buffer.isBuffer(bot.calls[0].photo));
  });

  it('skips already-sent draw (idempotent, AD-5)', async () => {
    const draw = makePublishDraw(db);
    const bot = mockBotApi();

    // First send
    await publishDraw(db, draw, 'public', '-100123456', bot);
    assert.equal(bot.calls.length, 1);

    // Second send — should skip
    const result = await publishDraw(db, draw, 'public', '-100123456', bot);
    assert.equal(result.sent, false);
    assert.equal(bot.calls.length, 1, 'bot API should not be called again');
  });

  it('retries failed channel', async () => {
    const draw = makePublishDraw(db);
    let callCount = 0;
    const failingBot: BotApi = {
      sendPhoto: async () => {
        callCount++;
        if (callCount === 1) throw new Error('timeout 502');
        return { message_id: 99 };
      },
    };

    // First attempt fails
    await assert.rejects(() => publishDraw(db, draw, 'public', '-100123456', failingBot));

    // Retry succeeds
    const result = await publishDraw(db, draw, 'public', '-100123456', failingBot);
    assert.equal(result.sent, true);
    assert.equal(result.messageId, '99');
  });

  it('marks as failed on bot API error', async () => {
    const draw = makePublishDraw(db);
    const failingBot: BotApi = {
      sendPhoto: async () => {
        throw new Error('network error');
      },
    };

    await assert.rejects(() => publishDraw(db, draw, 'public', '-100123456', failingBot));

    // Check publish_log has the failure
    const rows = db
      .prepare('SELECT status, last_error FROM publish_log WHERE draw_id = ? AND channel = ?')
      .get(draw.id, 'public') as { status: string; last_error: string } | undefined;
    assert.ok(rows);
    assert.equal(rows.status, 'failed');
    assert.ok(rows.last_error.includes('network error'));
  });

  it('returns messageId from bot API response', async () => {
    const draw = makePublishDraw(db);
    const bot = mockBotApi({
      sendPhoto: async () => ({ message_id: 777 }),
    });

    const result = await publishDraw(db, draw, 'private', '-100999', bot);
    assert.equal(result.sent, true);
    assert.equal(result.messageId, '777');
  });
});
