import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { DrawAdapter, Draw, Tier } from '../../src/ingest/adapter.ts';
import type { State, DrawType } from '../../src/store/queries.ts';

describe('ING-1: DrawAdapter interface', () => {
  it('adapter must expose state and fetchLatest method', () => {
    // This test will fail until adapter.ts is created with DrawAdapter
    const adapter: DrawAdapter = {
      state: 'FL' as State,
      async fetchLatest(): Promise<Draw[]> {
        return [];
      },
    };
    assert.equal(adapter.state, 'FL');
    assert.equal(typeof adapter.fetchLatest, 'function');
  });

  it('Draw type has all required fields matching design.md', () => {
    const draw: Draw = {
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
    };
    assert.equal(draw.state, 'FL');
    assert.equal(draw.gameId, 'pick3');
    assert.equal(draw.gameName, 'Pick 3');
    assert.equal(draw.drawDate, '2026-08-14');
    assert.equal(draw.drawType, 'evening');
    assert.deepEqual(draw.numbers, [4, 1, 7]);
    assert.equal(draw.bonus, null);
    assert.equal(draw.multiplier, null);
    assert.equal(draw.jackpot, null);
    assert.deepEqual(draw.prizeTiers, []);
    assert.equal(draw.sourceRef, 'fl-daily-2026-08-14');
    assert.equal(draw.sourceUrl, 'https://www.flalottery.com/exptkt/pick3');
  });

  it('Draw supports optional bonus and multiplier fields', () => {
    const draw: Draw = {
      state: 'GA',
      gameId: 'cash3',
      gameName: 'Cash 3',
      drawDate: '2026-08-14',
      drawType: 'evening',
      numbers: [1, 2, 3],
      bonus: [5],
      multiplier: 2,
      jackpot: 50000,
      prizeTiers: [{ match: '3/3', prize: '$500' }],
      sourceRef: 'ga-daily-2026-08-14',
      sourceUrl: 'https://www.galottery.com/api/v2/draw-games/draws',
    };
    assert.deepEqual(draw.bonus, [5]);
    assert.equal(draw.multiplier, 2);
    assert.equal(draw.jackpot, 50000);
    assert.equal(draw.prizeTiers.length, 1);
  });

  it('DrawType is restricted to midday or evening', () => {
    const midday: DrawType = 'midday';
    const evening: DrawType = 'evening';
    assert.equal(midday, 'midday');
    assert.equal(evening, 'evening');
  });
});
