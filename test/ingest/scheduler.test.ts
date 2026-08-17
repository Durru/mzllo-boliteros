import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Draw } from '../../src/ingest/adapter.ts';

describe('ING-1: Scheduler with backoff and alert', () => {
  it('scheduler calculates exponential backoff with jitter', async () => {
    const { calculateBackoff } = await import('../../src/ingest/scheduler.ts');

    // First retry: base delay + jitter
    const backoff1 = calculateBackoff(1, 1000);
    assert.ok(backoff1 >= 1000, 'backoff must be at least base delay');
    assert.ok(backoff1 <= 1500, 'backoff must include jitter (base + 50%)');

    // Second retry: exponential
    const backoff2 = calculateBackoff(2, 1000);
    assert.ok(backoff2 >= 2000, 'second retry must be at least 2x base');
    assert.ok(backoff2 <= 3000, 'second retry must include jitter');

    // Third retry: more exponential
    const backoff3 = calculateBackoff(3, 1000);
    assert.ok(backoff3 >= 4000, 'third retry must be at least 4x base');
  });

  it('scheduler tracks per-state enabled flags', async () => {
    const { StateScheduler } = await import('../../src/ingest/scheduler.ts');
    const scheduler = new StateScheduler();

    // Initially all states enabled
    assert.equal(scheduler.isEnabled('FL'), true);
    assert.equal(scheduler.isEnabled('GA'), true);
    assert.equal(scheduler.isEnabled('NY'), true);

    // Disable a state
    scheduler.setEnabled('GA', false);
    assert.equal(scheduler.isEnabled('GA'), false);
    assert.equal(scheduler.isEnabled('FL'), true, 'other states must remain enabled');
  });

  it('scheduler polls only registered games from registry', async () => {
    const { StateScheduler } = await import('../../src/ingest/scheduler.ts');
    const { getGamesByState } = await import('../../src/config/games.registry.ts');
    const scheduler = new StateScheduler();

    const registeredGames = getGamesByState('FL');
    const polledGames = scheduler.getRegisteredGamesForState('FL');

    assert.equal(polledGames.length, registeredGames.length,
      'scheduler must poll exactly registered games');
  });

  it('scheduler raises alert after window elapses with no draw', async () => {
    const { StateScheduler } = await import('../../src/ingest/scheduler.ts');
    const scheduler = new StateScheduler();

    // Mock adapter that always returns empty (simulating late/missing draw)
    const mockAdapter = {
      state: 'FL' as const,
      fetchLatest: async (): Promise<Draw[]> => [],
    };

    let alertRaised = false;
    scheduler.onAlert(() => { alertRaised = true; });

    // Simulate polling with a very short window
    await scheduler.pollWithRetry(mockAdapter, {
      maxRetries: 1,
      baseDelayMs: 10,
      windowMs: 50,
    });

    assert.equal(alertRaised, true, 'alert must be raised when window elapses');
  });
});

describe('ING-2: Schema drift alert and fallback', () => {
  it('adapter triggers alert on zod validation failure', async () => {
    const { FlAdapter } = await import('../../src/ingest/fl.ts');
    const adapter = new FlAdapter();

    let alertRaised = false;
    adapter.onAlert(() => { alertRaised = true; });

    // Mock fetch to return data that fails zod validation
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({
        drawGames: [{
          // Missing required fields
          invalidField: true,
        }],
      }), { status: 200 });
    };

    try {
      const draws = await adapter.fetchLatest();
      assert.equal(draws.length, 0, 'invalid data must produce no draws');
      assert.equal(alertRaised, true, 'alert must be raised on schema drift');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('adapter falls back to HTML on zod validation failure', async () => {
    const { FlAdapter } = await import('../../src/ingest/fl.ts');
    const adapter = new FlAdapter();

    let fallbackCalled = false;
    adapter.onFallback(() => { fallbackCalled = true; });

    // Mock fetch: first call returns invalid JSON, second returns valid HTML
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) {
        // Invalid JSON response
        return new Response(JSON.stringify({ invalid: true }), { status: 200 });
      }
      // HTML fallback
      return new Response(`
        <html><body>
          <div class="game-results">
            <h2>Pick 3</h2>
            <span class="game-id">pick3</span>
            <span class="draw-date">2026-08-14</span>
            <span class="draw-time">evening</span>
            <span class="ball">4</span>
            <span class="ball">1</span>
            <span class="ball">7</span>
          </div>
        </body></html>
      `, { status: 200, headers: { 'content-type': 'text/html' } });
    };

    try {
      const draws = await adapter.fetchLatest();
      assert.ok(draws.length > 0 || fallbackCalled,
        'fallback must be triggered on schema failure');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('ING-3: Registry-driven scope', () => {
  it('scheduler polls exactly FL/GA/NY games from registry', async () => {
    const { StateScheduler } = await import('../../src/ingest/scheduler.ts');
    const { gamesRegistry } = await import('../../src/config/games.registry.ts');
    const scheduler = new StateScheduler();

    const registeredStates = new Set(gamesRegistry.games.map(g => g.state));
    assert.deepEqual([...registeredStates].sort(), ['FL', 'GA', 'NY'],
      'only FL/GA/NY should be in registry');

    // Verify scheduler respects the same scope
    for (const state of ['FL', 'GA', 'NY'] as const) {
      const games = scheduler.getRegisteredGamesForState(state);
      assert.ok(games.length > 0, `${state} must have registered games`);
    }
  });

  it('CASH4LIFE retirement does not block ingest pipeline', async () => {
    const { evaluateGameStatus, findGame } = await import('../../src/config/games.registry.ts');
    const cash = findGame('FL', 'cash4life')!;

    // CASH4LIFE is silent since 2026-02-21
    const status = evaluateGameStatus(cash, '2026-08-16');
    assert.equal(status, 'possible_retired',
      'CASH4LIFE should be flagged as possibly retired, not blocked');

    // Pipeline continues — scheduler still includes it in scope
    const { StateScheduler } = await import('../../src/ingest/scheduler.ts');
    const scheduler = new StateScheduler();
    const flGames = scheduler.getRegisteredGamesForState('FL');
    const cashInScope = flGames.some(g => g.gameId === 'cash4life');
    assert.equal(cashInScope, true,
      'CASH4LIFE must remain in polling scope even when possibly retired');
  });
});
