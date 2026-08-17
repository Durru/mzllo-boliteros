import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../../src/store/db.ts';
import { upsertDraw } from '../../src/store/queries.ts';
import { createTools } from '../../src/ai/tools.ts';
import type { DrawInput } from '../../src/store/queries.ts';
import type { DatabaseSync } from 'node:sqlite';

function sampleDraw(overrides: Partial<DrawInput> = {}): DrawInput {
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

describe('AIA-1: store-backed tools', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb();
  });

  it('get_latest_result returns current draw', () => {
    upsertDraw(db, sampleDraw({ numbers: [1, 2, 3] }));
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-16', numbers: [7, 8, 9] }));
    const tools = createTools(db);
    const tool = tools.find((t) => t.name === 'get_latest_result')!;

    const result = tool.execute({ state: 'FL', game_id: 'pick3' });
    assert.ok(result.includes('7, 8, 9'));
    assert.ok(result.includes('2026-08-16'));
  });

  it('get_latest_result returns error for unknown state', () => {
    const tools = createTools(db);
    const tool = tools.find((t) => t.name === 'get_latest_result')!;
    const result = tool.execute({ state: 'XX', game_id: 'pick3' });
    assert.ok(result.includes('Error'));
  });

  it('get_history returns paginated results', () => {
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-12' }));
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-13' }));
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-14' }));
    const tools = createTools(db);
    const tool = tools.find((t) => t.name === 'get_history')!;

    const result = tool.execute({ state: 'FL', game_id: 'pick3', limit: 2 });
    assert.ok(result.includes('History'));
    assert.ok(result.includes('2'));
  });

  it('get_jackpot returns jackpot amount', () => {
    upsertDraw(db, sampleDraw({ jackpot: 2_000_000 }));
    const tools = createTools(db);
    const tool = tools.find((t) => t.name === 'get_jackpot')!;

    const result = tool.execute({ state: 'FL', game_id: 'pick3' });
    assert.ok(result.includes('$2,000,000'));
  });

  it('get_jackpot returns no data message when empty', () => {
    const tools = createTools(db);
    const tool = tools.find((t) => t.name === 'get_jackpot')!;
    const result = tool.execute({ state: 'FL', game_id: 'pick3' });
    assert.ok(result.includes('No jackpot'));
  });

  it('get_prize_tiers returns tiers for specific draw', () => {
    upsertDraw(db, sampleDraw({
      prizeTiers: [{ match: '5/5', prize: '$1,000,000' }, { match: '4/5', prize: '$500' }],
    }));
    const tools = createTools(db);
    const tool = tools.find((t) => t.name === 'get_prize_tiers')!;

    const result = tool.execute({
      state: 'FL', game_id: 'pick3', draw_date: '2026-08-15', draw_type: 'evening',
    });
    assert.ok(result.includes('5/5'));
    assert.ok(result.includes('$1,000,000'));
  });
});
