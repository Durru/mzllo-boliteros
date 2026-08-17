import { z } from 'zod';
import type { DrawAdapter, Draw } from './adapter.ts';
import type { State } from '../store/queries.ts';
import { parseGaHtml } from './html-fallback.ts';

/** GA paginated draw response schema (ING-2). */
const GaDrawSchema = z.object({
  gameId: z.string(),
  gameName: z.string(),
  drawNumber: z.number().optional(),
  drawDate: z.string(),
  drawTime: z.string(), // ISO timestamp or time string
  winningNumbers: z.string().or(z.array(z.number())),
  multiplier: z.number().nullable().optional(),
  prizeAmounts: z.array(z.unknown()).optional(),
}).passthrough();

const GaResponseSchema = z.object({
  data: z.array(GaDrawSchema),
  pagination: z.object({
    totalPages: z.number(),
    currentPage: z.number(),
  }).optional(),
}).passthrough();

/** Normalize GA drawTime (ISO timestamp) to DrawType. */
function normalizeDrawType(raw: string): 'midday' | 'evening' {
  // GA uses ISO timestamps; check the hour
  const match = raw.match(/T(\d{2}):/);
  if (match) {
    const hour = parseInt(match[1], 10);
    // Midday draws are typically around 12:30 PM
    if (hour >= 10 && hour <= 14) return 'midday';
  }
  return 'evening';
}

/** Parse winning numbers from string or array. */
function parseNumbers(val: unknown): number[] {
  if (Array.isArray(val)) return val.map(Number);
  if (typeof val === 'string') {
    return val.split(/[,\s]+/).filter(Boolean).map(Number);
  }
  return [];
}

const GA_API_BASE = 'https://www.galottery.com/api/v2/draw-games/draws/';
const GA_HTML_URL = 'https://www.galottery.com/en-us/draw-games';

/**
 * Georgia Lottery adapter (ING-1/ING-2).
 * Fetches from paginated JSON API; uses drawTime from feed data (no hard-coded calendar).
 * Falls back to HTML on schema drift.
 */
export class GaAdapter implements DrawAdapter {
  state: State = 'GA';

  private alertListeners: Array<() => void> = [];
  private fallbackListeners: Array<() => void> = [];

  onAlert(listener: () => void): void {
    this.alertListeners.push(listener);
  }

  onFallback(listener: () => void): void {
    this.fallbackListeners.push(listener);
  }

  private raiseAlert(): void {
    for (const listener of this.alertListeners) listener();
  }

  private triggerFallback(): void {
    for (const listener of this.fallbackListeners) listener();
  }

  async fetchLatest(): Promise<Draw[]> {
    try {
      const draws: Draw[] = [];
      let page = 1;
      let totalPages = 1;

      // Fetch all pages until we have all draws (ING-1: paginated)
      while (page <= totalPages) {
        const url = page === 1
          ? GA_API_BASE
          : `${GA_API_BASE}?page=${page}`;

        const response = await fetch(url);
        if (!response.ok) break;

        const json = await response.json();
        const parsed = GaResponseSchema.safeParse(json);

        if (!parsed.success) {
          // Schema drift → alert + HTML fallback (ING-2)
          this.raiseAlert();
          this.triggerFallback();
          return this.fetchHtmlFallback();
        }

        const pageDraws = parsed.data.data
          .map((raw) => this.normalizeDraw(raw))
          .filter((d): d is Draw => d !== null);

        draws.push(...pageDraws);

        if (parsed.data.pagination) {
          totalPages = parsed.data.pagination.totalPages;
        } else {
          break; // No pagination info = single page
        }
        page++;
      }

      return draws;
    } catch {
      this.raiseAlert();
      return [];
    }
  }

  private normalizeDraw(raw: z.infer<typeof GaDrawSchema>): Draw | null {
    try {
      const drawType = normalizeDrawType(raw.drawTime);
      const numbers = parseNumbers(raw.winningNumbers);

      return {
        state: this.state,
        gameId: raw.gameId,
        gameName: raw.gameName,
        drawDate: raw.drawDate,
        drawType,
        numbers,
        bonus: null,
        multiplier: raw.multiplier ?? null,
        jackpot: null,
        prizeTiers: [],
        sourceRef: `ga-${raw.gameId}-${raw.drawDate}-${drawType}`,
        sourceUrl: GA_API_BASE,
      };
    } catch {
      return null;
    }
  }

  private async fetchHtmlFallback(): Promise<Draw[]> {
    try {
      const response = await fetch(GA_HTML_URL);
      if (!response.ok) return [];
      const html = await response.text();
      return parseGaHtml(html);
    } catch {
      return [];
    }
  }
}
