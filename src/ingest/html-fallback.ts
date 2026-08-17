import * as cheerio from 'cheerio';
import type { Draw } from './adapter.ts';

/**
 * Parse FL lottery HTML page into Draw objects (ING-2: HTML fallback).
 * Used when zod validation fails on the API response.
 */
export function parseFlHtml(html: string): Draw[] {
  const $ = cheerio.load(html);
  const draws: Draw[] = [];

  // FL lottery uses game-results divs with ball spans
  $('.game-results, .game-result, [class*="draw"]').each((_, el) => {
    try {
      const $el = $(el);
      const gameName = $el.find('h2, h3, .game-name').first().text().trim();
      const gameId = $el.find('.game-id, [class*="game-id"]').first().text().trim();
      const drawDate = $el.find('.draw-date, [class*="draw-date"]').first().text().trim();
      const drawTime = $el.find('.draw-time, [class*="draw-time"]').first().text().trim();

      if (!gameName || !drawDate) return;

      // Extract numbers from ball spans
      const numbers: number[] = [];
      $el.find('.ball, .number, [class*="ball"]').each((_, ball) => {
        const num = parseInt($(ball).text().trim(), 10);
        if (!isNaN(num)) numbers.push(num);
      });

      if (numbers.length === 0) return;

      const normalizedGameId = gameId || gameName.toLowerCase().replace(/\s+/g, '-');
      const drawType = drawTime.toLowerCase().includes('mid') ? 'midday' : 'evening';

      draws.push({
        state: 'FL',
        gameId: normalizedGameId,
        gameName,
        drawDate,
        drawType,
        numbers,
        bonus: null,
        multiplier: null,
        jackpot: null,
        prizeTiers: [],
        sourceRef: `fl-html-${normalizedGameId}-${drawDate}-${drawType}`,
        sourceUrl: 'https://www.flalottery.com',
      });
    } catch {
      // Skip malformed entries
    }
  });

  return draws;
}

/**
 * Parse GA lottery HTML page into Draw objects (ING-2: HTML fallback).
 * Used when zod validation fails on the API response.
 */
export function parseGaHtml(html: string): Draw[] {
  const $ = cheerio.load(html);
  const draws: Draw[] = [];

  // GA lottery uses game-result divs
  $('.game-result, [class*="result"]').each((_, el) => {
    try {
      const $el = $(el);
      const gameName = $el.find('.game-name, [class*="game-name"]').first().text().trim();
      const gameId = $el.find('.game-id, [class*="game-id"]').first().text().trim();
      const drawDate = $el.find('.draw-date, [class*="draw-date"]').first().text().trim();
      const drawType = $el.find('.draw-type, [class*="draw-type"]').first().text().trim();

      if (!gameName || !drawDate) return;

      // Extract numbers — only leaf elements with number/ball class
      const numbers: number[] = [];
      $el.find('.number, .ball').each((_, num) => {
        const val = parseInt($(num).text().trim(), 10);
        if (!isNaN(val)) numbers.push(val);
      });

      if (numbers.length === 0) return;

      const normalizedGameId = gameId || gameName.toLowerCase().replace(/\s+/g, '-');
      const normalizedDrawType = drawType.toLowerCase().includes('mid') ? 'midday' : 'evening';

      draws.push({
        state: 'GA',
        gameId: normalizedGameId,
        gameName,
        drawDate,
        drawType: normalizedDrawType as 'midday' | 'evening',
        numbers,
        bonus: null,
        multiplier: null,
        jackpot: null,
        prizeTiers: [],
        sourceRef: `ga-html-${normalizedGameId}-${drawDate}-${normalizedDrawType}`,
        sourceUrl: 'https://www.galottery.com',
      });
    } catch {
      // Skip malformed entries
    }
  });

  return draws;
}
