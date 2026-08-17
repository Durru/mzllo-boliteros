import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../../src/store/db.ts';
import { upsertDraw } from '../../src/store/queries.ts';
import { createAssistant } from '../../src/ai/assistant.ts';
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

describe('AIA-1: assistant tool-only answers', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb();
  });

  it('answers from store tools, not from training data', async () => {
    upsertDraw(db, sampleDraw({ numbers: [1, 2, 3] }));
    const assistant = createAssistant({
      db,
      isActiveMember: () => false,
    });

    const result = await assistant.handleQuery(12345, '¿Qué salió en FL pick3?');
    assert.equal(result.refused, false);
    assert.ok(result.answer.includes('1, 2, 3'));
    assert.ok(result.toolUsed);
  });

  it('logs every query to ai_query_log', async () => {
    upsertDraw(db, sampleDraw());
    const assistant = createAssistant({
      db,
      isActiveMember: () => false,
    });

    await assistant.handleQuery(12345, 'Resultado FL pick3');
    const rows = db.prepare('SELECT COUNT(*) as n FROM ai_query_log').get() as { n: number };
    assert.equal(rows.n, 1);
  });
});

describe('AIA-2: bolita/prediction refusals', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb();
  });

  it('refuses bolita queries with disclaimer', async () => {
    const assistant = createAssistant({
      db,
      isActiveMember: () => false,
    });

    const result = await assistant.handleQuery(12345, '¿Cuál es la bolita de hoy?');
    assert.equal(result.refused, true);
    assert.ok(result.answer.includes('predicciones'));
  });

  it('refuses prediction queries', async () => {
    const assistant = createAssistant({
      db,
      isActiveMember: () => false,
    });

    const result = await assistant.handleQuery(12345, 'Dame un pronóstico');
    assert.equal(result.refused, true);
  });

  it('logs refused queries', async () => {
    const assistant = createAssistant({
      db,
      isActiveMember: () => false,
    });

    await assistant.handleQuery(12345, 'Bolita de FL');
    const rows = db.prepare('SELECT refused FROM ai_query_log').get() as { refused: number };
    assert.equal(rows.refused, 1);
  });
});

describe('AIA-3: premium analysis deny', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb();
  });

  it('denies premium analysis for non-members', async () => {
    const assistant = createAssistant({
      db,
      isActiveMember: () => false,
    });

    const result = await assistant.handleQuery(12345, 'Análisis de tendencias FL pick3');
    assert.equal(result.refused, true);
    assert.ok(result.answer.includes('membresía premium'));
  });

  it('allows premium analysis for active members', async () => {
    upsertDraw(db, sampleDraw());
    const assistant = createAssistant({
      db,
      isActiveMember: (id) => id === 12345,
    });

    const result = await assistant.handleQuery(12345, 'Análisis de tendencias FL pick3');
    assert.equal(result.refused, false);
  });
});
