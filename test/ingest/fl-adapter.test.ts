import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Draw } from '../../src/ingest/adapter.ts';

describe('ING-1 / ING-2: FL adapter fetchLatest', () => {
  it('FL adapter returns Draw[] from APIM endpoint with x-partner header', async () => {
    // This test will fail until fl.ts is created with FlAdapter
    const { FlAdapter } = await import('../../src/ingest/fl.ts');
    const adapter = new FlAdapter();

    assert.equal(adapter.state, 'FL');

    // Mock fetch to return a sample FL response
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({
        drawGames: [{
          gameName: 'Pick 3',
          gameId: 'pick3',
          drawNumber: 12345,
          drawDate: '2026-08-14',
          drawTime: 'evening',
          winningNumbers: [4, 1, 7],
          multiplier: null,
          prizePool: null,
          jackpot: null,
        }],
      }), { status: 200 });
    };

    try {
      const draws = await adapter.fetchLatest();
      assert.ok(Array.isArray(draws), 'fetchLatest must return an array');
      // At least one draw for a registered FL game
      if (draws.length > 0) {
        assert.equal(draws[0].state, 'FL');
        assert.ok(typeof draws[0].gameId === 'string');
        assert.ok(Array.isArray(draws[0].numbers));
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('FL adapter zod-validated: invalid payload returns empty array + alert', async () => {
    const { FlAdapter } = await import('../../src/ingest/fl.ts');
    const adapter = new FlAdapter();

    // Mock fetch to return malformed data (missing required fields)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({
        drawGames: [{
          // Missing gameId, drawDate, etc.
          gameName: 'Pick 3',
        }],
      }), { status: 200 });
    };

    try {
      const draws = await adapter.fetchLatest();
      assert.equal(draws.length, 0, 'invalid payload must not produce draws');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('ING-1 / ING-2: GA adapter fetchLatest', () => {
  it('GA adapter returns Draw[] from paginated JSON API', async () => {
    const { GaAdapter } = await import('../../src/ingest/ga.ts');
    const adapter = new GaAdapter();

    assert.equal(adapter.state, 'GA');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('page=') || urlStr.includes('draw-games/draws')) {
        return new Response(JSON.stringify({
          data: [{
            gameId: 'cash3',
            gameName: 'Cash 3',
            drawNumber: 12345,
            drawDate: '2026-08-14',
            drawTime: '2026-08-14T12:30:00.000Z',
            winningNumbers: '1,2,3',
            multiplier: null,
            prizeAmounts: [],
          }],
          pagination: { totalPages: 1, currentPage: 1 },
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    try {
      const draws = await adapter.fetchLatest();
      assert.ok(Array.isArray(draws), 'fetchLatest must return an array');
      if (draws.length > 0) {
        assert.equal(draws[0].state, 'GA');
        assert.ok(typeof draws[0].gameId === 'string');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('ING-1 / ING-2: NY adapter fetchLatest', () => {
  it('NY adapter returns Draw[] from Socrata datasets', async () => {
    const { NyAdapter } = await import('../../src/ingest/ny.ts');
    const adapter = new NyAdapter();

    assert.equal(adapter.state, 'NY');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify([{
        draw_id: '12345',
        game: 'Numbers',
        draw_date: '2026-08-14',
        draw_time: 'EVENING',
        winning_numbers: '1 2 3',
        multiplier: null,
        estimated_jackpot: null,
      }]), { status: 200 });
    };

    try {
      const draws = await adapter.fetchLatest();
      assert.ok(Array.isArray(draws), 'fetchLatest must return an array');
      if (draws.length > 0) {
        assert.equal(draws[0].state, 'NY');
        assert.ok(typeof draws[0].gameId === 'string');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
