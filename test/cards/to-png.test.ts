import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toPng } from '../../src/cards/to-png.ts';
import { renderSvg } from '../../src/cards/render-svg.ts';
import type { Draw } from '../../src/ingest/adapter.ts';

function sampleDraw(): Draw {
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
  };
}

describe('toPng', () => {
  it('converts SVG to a PNG buffer', async () => {
    const svg = renderSvg(sampleDraw());
    const png = await toPng(svg);
    assert.ok(Buffer.isBuffer(png));
    assert.ok(png.length > 0);
  });

  it('PNG buffer starts with PNG magic bytes', async () => {
    const svg = renderSvg(sampleDraw());
    const png = await toPng(svg);
    // PNG magic: 0x89 P N G
    assert.equal(png[0], 0x89);
    assert.equal(png[1], 0x50); // P
    assert.equal(png[2], 0x4e); // N
    assert.equal(png[3], 0x47); // G
  });

  it('throws on invalid SVG input', async () => {
    await assert.rejects(() => toPng('not valid svg at all'));
  });
});
