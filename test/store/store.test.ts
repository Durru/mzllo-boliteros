import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../../src/store/db.ts';
import {
  upsertDraw,
  getCurrentResult,
  getHistory,
  getJackpot,
  getPrizeTiers,
  markPublishSent,
  markPublishFailed,
  getPublishLog,
  getChannelsNeedingSend,
  type DrawInput,
  type Tier,
} from '../../src/store/queries.ts';

function sampleDraw(overrides: Partial<DrawInput> = {}): DrawInput {
  return {
    state: 'FL',
    gameId: 'pick3',
    gameName: 'Pick 3',
    drawDate: '2026-08-14',
    drawType: 'evening',
    numbers: [4, 1, 7],
    bonus: null,
    multiplier: null,
    jackpot: null,
    prizeTiers: [],
    sourceRef: 'fl-daily-2026-08-14',
    sourceUrl: 'https://www.flalottery.com/exptkt/pick3',
    ...overrides,
  };
}

describe('STO-1: draws upsert idempotency', () => {
  it('re-upserting the same state/game/date/type updates the row, never duplicates', () => {
    const db = openDb();
    const id1 = upsertDraw(db, sampleDraw());
    const id2 = upsertDraw(
      db,
      sampleDraw({ numbers: [8, 8, 8], jackpot: 2_500_000, sourceRef: 'fl-daily-2026-08-14-v2' }),
    );

    assert.equal(typeof id1, 'number');
    assert.equal(id2, id1, 'upsert must return the same row id');
    const rows = db.prepare('SELECT COUNT(*) AS n FROM draws').get() as { n: number };
    assert.equal(Number(rows.n), 1, 'second upsert must not create a new row');

    const current = getCurrentResult(db, { state: 'FL', gameId: 'pick3', drawType: 'evening' });
    assert.deepEqual(current?.numbers, [8, 8, 8], 'row must be updated with new numbers');
    assert.equal(current?.jackpot, 2_500_000, 'row must be updated with new jackpot');
  });

  it('same game on a different draw_date creates a separate row (unique is the 4-tuple)', () => {
    const db = openDb();
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-14' }));
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-15' }));
    const rows = db.prepare('SELECT COUNT(*) AS n FROM draws').get() as { n: number };
    assert.equal(Number(rows.n), 2);
  });

  it('same draw_date with a different draw_type creates a separate row', () => {
    const db = openDb();
    upsertDraw(db, sampleDraw({ drawType: 'evening' }));
    upsertDraw(db, sampleDraw({ drawType: 'midday' }));
    const rows = db.prepare('SELECT COUNT(*) AS n FROM draws').get() as { n: number };
    assert.equal(Number(rows.n), 2);
  });
});

describe('STO-2: queries', () => {
  it('history for a game with no stored draws returns an empty result without error', () => {
    const db = openDb();
    const history = getHistory(db, { state: 'NY', gameId: 'numbers' });
    assert.deepEqual(history, []);
    assert.equal(getCurrentResult(db, { state: 'NY', gameId: 'numbers' }), null);
  });

  it('history returns paginated normalized draws, newest first', () => {
    const db = openDb();
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-12', numbers: [1, 2, 3] }));
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-13', numbers: [4, 5, 6] }));
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-14', numbers: [7, 8, 9] }));

    const page1 = getHistory(db, { state: 'FL', gameId: 'pick3', limit: 2 });
    assert.equal(page1.length, 2);
    assert.equal(page1[0].drawDate, '2026-08-14');
    assert.deepEqual(page1[0].numbers, [7, 8, 9]);
    assert.equal(page1[1].drawDate, '2026-08-13');

    const page2 = getHistory(db, { state: 'FL', gameId: 'pick3', limit: 2, offset: 2 });
    assert.equal(page2.length, 1);
    assert.equal(page2[0].drawDate, '2026-08-12');
  });

  it('history respects from/to date range', () => {
    const db = openDb();
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-12' }));
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-13' }));
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-14' }));
    const range = getHistory(db, { state: 'FL', gameId: 'pick3', from: '2026-08-13', to: '2026-08-13' });
    assert.equal(range.length, 1);
    assert.equal(range[0].drawDate, '2026-08-13');
  });

  it('current result returns the latest stored draw for state/game', () => {
    const db = openDb();
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-13', numbers: [1, 1, 1] }));
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-14', numbers: [2, 2, 2] }));
    const current = getCurrentResult(db, { state: 'FL', gameId: 'pick3' });
    assert.equal(current?.drawDate, '2026-08-14');
    assert.deepEqual(current?.numbers, [2, 2, 2]);
  });

  it('jackpot returns the latest jackpot for state/game, null when absent', () => {
    const db = openDb();
    assert.equal(getJackpot(db, { state: 'FL', gameId: 'powerball' }), null);
    upsertDraw(db, sampleDraw({ state: 'FL', gameId: 'powerball', drawDate: '2026-08-12', jackpot: 100_000_000 }));
    upsertDraw(db, sampleDraw({ state: 'FL', gameId: 'powerball', drawDate: '2026-08-14', jackpot: 145_000_000 }));
    assert.equal(getJackpot(db, { state: 'FL', gameId: 'powerball' }), 145_000_000);
  });

  it('prize tiers are returned per state/game/date/type in normalized shape', () => {
    const db = openDb();
    const tiers: Tier[] = [
      { match: '5/5', prize: '$1,000,000' },
      { match: '4/5', prize: '$500' },
    ];
    upsertDraw(db, sampleDraw({ prizeTiers: tiers }));
    const result = getPrizeTiers(db, { state: 'FL', gameId: 'pick3', drawDate: '2026-08-14', drawType: 'evening' });
    assert.deepEqual(result, tiers);
  });
});

describe('STO-3: publish state', () => {
  it('failed send then retry: sent channels are not re-sent, failed channel is retried and updated', () => {
    const db = openDb();
    const drawId = upsertDraw(db, sampleDraw());

    // First pass: public channel succeeds, private channel fails.
    assert.equal(markPublishSent(db, { drawId, channel: 'public', telegramMessageId: 'msg-1' }), true);
    markPublishFailed(db, { drawId, channel: 'private', error: 'timeout 502' });

    let pending = getChannelsNeedingSend(db, drawId);
    assert.deepEqual(pending, ['private'], 'only the failed channel must be pending retry');

    // Retry: private succeeds now. Public must NOT be re-sent.
    assert.equal(markPublishSent(db, { drawId, channel: 'private', telegramMessageId: 'msg-2' }), true);
    pending = getChannelsNeedingSend(db, drawId);
    assert.deepEqual(pending, [], 'after retry nothing is pending');

    const log = getPublishLog(db, drawId);
    const byChannel = Object.fromEntries(log.map((e) => [e.channel, e]));
    assert.equal(byChannel['public']?.status, 'sent');
    assert.equal(byChannel['public']?.telegramMessageId, 'msg-1');
    assert.equal(byChannel['public']?.attempts, 1, 'sent channel must not be touched');
    assert.equal(byChannel['private']?.status, 'sent');
    assert.equal(byChannel['private']?.telegramMessageId, 'msg-2');
    assert.equal(byChannel['private']?.attempts, 2, 'retried channel counts the retry attempt');
    assert.equal(byChannel['private']?.lastError, null, 'retry clears the previous error');
  });

  it('markPublishSent on an already-sent channel is a no-op (idempotent)', () => {
    const db = openDb();
    const drawId = upsertDraw(db, sampleDraw());
    assert.equal(markPublishSent(db, { drawId, channel: 'public', telegramMessageId: 'msg-1' }), true);
    assert.equal(markPublishSent(db, { drawId, channel: 'public', telegramMessageId: 'msg-2' }), false);
    const log = getPublishLog(db, drawId);
    assert.equal(log.length, 1);
    assert.equal(log[0].telegramMessageId, 'msg-1');
    assert.equal(log[0].attempts, 1);
  });

  it('a draw with no publish attempts has both channels pending', () => {
    const db = openDb();
    const drawId = upsertDraw(db, sampleDraw());
    const pending = getChannelsNeedingSend(db, drawId);
    assert.deepEqual(pending, ['public', 'private']);
  });
});
