import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../../src/store/db.ts';
import { upsertDraw } from '../../src/store/queries.ts';
import { handleCommand } from '../../src/bot/commands.ts';
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

describe('TGB-2: /results command', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb();
  });

  it('returns latest draw results for a state/game', () => {
    upsertDraw(db, sampleDraw({ numbers: [1, 2, 3] }));
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-16', numbers: [7, 8, 9] }));

    const result = handleCommand(db, '/results', ['FL', 'pick3']);
    assert.ok(result.text.includes('Pick 3'));
    assert.ok(result.text.includes('FL'));
    assert.ok(result.text.includes('2026-08-16'));
    assert.ok(result.text.includes('7 - 8 - 9'));
  });

  it('defaults to FL pick3 when no args', () => {
    upsertDraw(db, sampleDraw());
    const result = handleCommand(db, '/results', []);
    assert.ok(result.text.includes('Pick 3'));
  });

  it('returns message when no draws stored', () => {
    const result = handleCommand(db, '/results', ['NY', 'numbers']);
    assert.ok(result.text.includes('No hay resultados'));
  });

  it('rejects invalid state', () => {
    const result = handleCommand(db, '/results', ['XX', 'pick3']);
    assert.ok(result.text.includes('no válido'));
  });

  it('includes bonus when present', () => {
    upsertDraw(db, sampleDraw({ bonus: [5] }));
    const result = handleCommand(db, '/results', ['FL', 'pick3']);
    assert.ok(result.text.includes('Bonus'));
    assert.ok(result.text.includes('5'));
  });

  it('includes jackpot when present', () => {
    upsertDraw(db, sampleDraw({ jackpot: 1_000_000 }));
    const result = handleCommand(db, '/results', ['FL', 'pick3']);
    assert.ok(result.text.includes('Jackpot'));
    assert.ok(result.text.includes('$1,000,000'));
  });

  it('includes multiplier when present', () => {
    upsertDraw(db, sampleDraw({ multiplier: 2 }));
    const result = handleCommand(db, '/results', ['FL', 'pick3']);
    assert.ok(result.text.includes('Multiplier'));
    assert.ok(result.text.includes('×2'));
  });
});

describe('TGB-2: /stats command', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb();
  });

  it('shows jackpot and draw count', () => {
    upsertDraw(db, sampleDraw({ jackpot: 500_000 }));
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-16' }));

    const result = handleCommand(db, '/stats', ['FL', 'pick3']);
    assert.ok(result.text.includes('$500,000'));
    assert.ok(result.text.includes('2'));
  });

  it('shows no jackpot when none stored', () => {
    const result = handleCommand(db, '/stats', ['FL', 'pick3']);
    assert.ok(result.text.includes('no disponible'));
  });

  it('defaults to FL pick3', () => {
    const result = handleCommand(db, '/stats', []);
    assert.ok(result.text.includes('Stats'));
  });

  it('rejects invalid state', () => {
    const result = handleCommand(db, '/stats', ['XX']);
    assert.ok(result.text.includes('no válido'));
  });
});

describe('TGB-2: /help command', () => {
  it('lists all available commands', () => {
    const db = openDb();
    const result = handleCommand(db, '/help', []);
    assert.ok(result.text.includes('/results'));
    assert.ok(result.text.includes('/stats'));
    assert.ok(result.text.includes('/help'));
    assert.ok(result.text.includes('FL'));
    assert.ok(result.text.includes('GA'));
    assert.ok(result.text.includes('NY'));
  });
});

describe('TGB-2: command routing', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb();
  });

  it('returns help text for unknown commands', () => {
    const result = handleCommand(db, '/unknown', []);
    assert.ok(result.text.includes('no reconocido'));
  });
});
