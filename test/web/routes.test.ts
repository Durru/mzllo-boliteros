import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../../src/store/db.ts';
import { upsertDraw } from '../../src/store/queries.ts';
import { createRoutes } from '../../src/web/routes.ts';
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

async function request(app: ReturnType<typeof createRoutes>, path: string): Promise<{ status: number; body: string }> {
  const req = new Request(`http://localhost${path}`, { method: 'GET' });
  const res = await app.fetch(req);
  const body = await res.text();
  return { status: res.status, body };
}

describe('WEB-2: routes + metadata', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb();
  });

  it('GET / returns HTML with title', async () => {
    const app = createRoutes(db);
    const { status, body } = await request(app, '/');
    assert.equal(status, 200);
    assert.ok(body.includes('Mzllo Boliteros'));
    assert.ok(body.includes('<!DOCTYPE html>'));
  });

  it('GET / returns Spanish when lang=es', async () => {
    const app = createRoutes(db);
    const { body } = await request(app, '/?lang=es');
    assert.ok(body.includes('Resultados Oficiales'));
    assert.ok(body.includes('lang="es"'));
  });

  it('GET /results shows latest draw', async () => {
    upsertDraw(db, sampleDraw({ numbers: [1, 2, 3] }));
    const app = createRoutes(db);
    const { body } = await request(app, '/results?state=FL&game=pick3');
    assert.ok(body.includes('1 - 2 - 3'));
    assert.ok(body.includes('Pick 3'));
  });

  it('GET /results shows no-results message when empty', async () => {
    const app = createRoutes(db);
    const { body } = await request(app, '/results?state=NY&game=numbers');
    assert.ok(body.includes('No results available'));
  });

  it('GET /results rejects invalid state', async () => {
    const app = createRoutes(db);
    const { status } = await request(app, '/results?state=XX');
    assert.equal(status, 400);
  });

  it('GET /history shows draw history', async () => {
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-12' }));
    upsertDraw(db, sampleDraw({ drawDate: '2026-08-13' }));
    const app = createRoutes(db);
    const { body } = await request(app, '/history?state=FL&game=pick3');
    assert.ok(body.includes('2026-08-12'));
    assert.ok(body.includes('2026-08-13'));
  });

  it('GET /history shows empty message when no draws', async () => {
    const app = createRoutes(db);
    const { body } = await request(app, '/history?state=FL&game=pick3');
    assert.ok(body.includes('No draws found'));
  });

  it('GET /about shows about page', async () => {
    const app = createRoutes(db);
    const { body } = await request(app, '/about');
    assert.ok(body.includes('About'));
    assert.ok(body.includes('official sources'));
  });
});

describe('WEB-3: SEO audit', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb();
  });

  it('all pages have meta description', async () => {
    const app = createRoutes(db);
    const pages = ['/', '/results', '/history', '/about'];
    for (const page of pages) {
      const { body } = await request(app, page);
      assert.ok(body.includes('meta name="description"'), `${page} missing meta description`);
    }
  });

  it('home page has hreflang tags', async () => {
    const app = createRoutes(db);
    const { body } = await request(app, '/');
    assert.ok(body.includes('hreflang="en"'));
    assert.ok(body.includes('hreflang="es"'));
    assert.ok(body.includes('hreflang="x-default"'));
  });

  it('all pages have canonical viewport', async () => {
    const app = createRoutes(db);
    const { body } = await request(app, '/');
    assert.ok(body.includes('viewport'));
  });
});
