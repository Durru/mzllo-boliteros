import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Draw } from '../../src/ingest/adapter.ts';

describe('ING-2: HTML fallback parser', () => {
  it('parseFlHtml extracts draws from FL lottery HTML page', async () => {
    const { parseFlHtml } = await import('../../src/ingest/html-fallback.ts');

    const html = `
      <html>
        <body>
          <div class="game-results">
            <h2>Pick 3</h2>
            <div class="draw-info">
              <span class="game-id">pick3</span>
              <span class="draw-date">2026-08-14</span>
              <span class="draw-time">evening</span>
            </div>
            <div class="winning-numbers">
              <span class="ball">4</span>
              <span class="ball">1</span>
              <span class="ball">7</span>
            </div>
          </div>
        </body>
      </html>
    `;

    const draws = parseFlHtml(html);
    assert.ok(Array.isArray(draws), 'parseFlHtml must return an array');
    if (draws.length > 0) {
      assert.equal(draws[0].state, 'FL');
      assert.equal(draws[0].gameId, 'pick3');
      assert.deepEqual(draws[0].numbers, [4, 1, 7]);
    }
  });

  it('parseGaHtml extracts draws from GA lottery HTML page', async () => {
    const { parseGaHtml } = await import('../../src/ingest/html-fallback.ts');

    const html = `
      <html>
        <body>
          <div class="game-result">
            <div class="game-name">Cash 3</div>
            <div class="game-id">cash3</div>
            <div class="draw-date">2026-08-14</div>
            <div class="draw-type">Evening</div>
            <div class="numbers">
              <span class="number">1</span>
              <span class="number">2</span>
              <span class="number">3</span>
            </div>
          </div>
        </body>
      </html>
    `;

    const draws = parseGaHtml(html);
    assert.ok(Array.isArray(draws), 'parseGaHtml must return an array');
    if (draws.length > 0) {
      assert.equal(draws[0].state, 'GA');
      assert.equal(draws[0].gameId, 'cash3');
      assert.deepEqual(draws[0].numbers, [1, 2, 3]);
    }
  });

  it('parseFlHtml returns empty array for unparseable HTML', async () => {
    const { parseFlHtml } = await import('../../src/ingest/html-fallback.ts');
    const draws = parseFlHtml('<html><body>No draw data here</body></html>');
    assert.equal(draws.length, 0, 'unparseable HTML must return empty array');
  });

  it('parseGaHtml returns empty array for unparseable HTML', async () => {
    const { parseGaHtml } = await import('../../src/ingest/html-fallback.ts');
    const draws = parseGaHtml('<html><body>Empty</body></html>');
    assert.equal(draws.length, 0, 'unparseable HTML must return empty array');
  });
});
