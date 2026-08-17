import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderSvg } from '../../src/cards/render-svg.ts';
import type { Draw } from '../../src/ingest/adapter.ts';

function sampleDraw(overrides: Partial<Draw> = {}): Draw {
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

describe('renderSvg', () => {
  it('returns a valid SVG string', () => {
    const svg = renderSvg(sampleDraw());
    assert.ok(svg.startsWith('<svg'), 'should start with <svg');
    assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'), 'should have SVG namespace');
    assert.ok(svg.endsWith('</svg>'), 'should end with </svg>');
  });

  it('includes game name', () => {
    const svg = renderSvg(sampleDraw());
    assert.ok(svg.includes('Pick 3'));
  });

  it('includes state', () => {
    const svg = renderSvg(sampleDraw());
    assert.ok(svg.includes('FL'));
  });

  it('includes draw date', () => {
    const svg = renderSvg(sampleDraw());
    assert.ok(svg.includes('2026-08-15'));
  });

  it('includes all numbers', () => {
    const svg = renderSvg(sampleDraw({ numbers: [4, 1, 7] }));
    // Numbers are inside <text> elements with whitespace — match trimmed content
    assert.ok(/>\s*4\s*</.test(svg), 'should contain number 4');
    assert.ok(/>\s*1\s*</.test(svg), 'should contain number 1');
    assert.ok(/>\s*7\s*</.test(svg), 'should contain number 7');
  });

  it('includes bonus when present', () => {
    const svg = renderSvg(sampleDraw({ bonus: [5] }));
    assert.ok(svg.includes('BONUS'));
    assert.ok(/>\s*5\s*</.test(svg), 'should contain bonus number 5');
  });

  it('does not include bonus section when bonus is empty', () => {
    const svg = renderSvg(sampleDraw({ bonus: null }));
    assert.ok(!svg.includes('BONUS'));
  });

  it('includes multiplier when present', () => {
    const svg = renderSvg(sampleDraw({ multiplier: 3 }));
    assert.ok(svg.includes('MULTIPLIER'));
    assert.ok(svg.includes('×3'));
  });

  it('includes jackpot when present', () => {
    const svg = renderSvg(sampleDraw({ jackpot: 1_500_000 }));
    assert.ok(svg.includes('JACKPOT'));
    assert.ok(svg.includes('$1,500,000'));
  });

  it('handles empty bonus array gracefully', () => {
    const svg = renderSvg(sampleDraw({ bonus: [] }));
    assert.ok(!svg.includes('BONUS'));
  });
});
