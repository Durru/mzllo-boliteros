import { z } from 'zod';
import type { DrawAdapter, Draw } from './adapter.ts';
import type { State } from '../store/queries.ts';
import { parseFlHtml } from './html-fallback.ts';

/** FL APIM response schema — validates shape before any write (ING-2). */
const FlDrawSchema = z.object({
  gameName: z.string(),
  gameId: z.string(),
  drawNumber: z.number().optional(),
  drawDate: z.string(), // YYYY-MM-DD
  drawTime: z.string(), // 'midday' | 'evening' | similar
  winningNumbers: z.array(z.number()).or(z.string()), // API may return string
  multiplier: z.number().nullable().optional(),
  prizePool: z.number().nullable().optional(),
  jackpot: z.number().nullable().optional(),
}).passthrough();

const FlResponseSchema = z.object({
  drawGames: z.array(FlDrawSchema),
}).passthrough();

/** Normalize FL drawTime to DrawType. */
function normalizeDrawType(raw: string): 'midday' | 'evening' {
  const lower = raw.toLowerCase();
  if (lower.includes('midday') || lower.includes('mid')) return 'midday';
  return 'evening';
}

/** Parse winning numbers which may be array or comma-separated string. */
function parseNumbers(val: unknown): number[] {
  if (Array.isArray(val)) return val.map(Number);
  if (typeof val === 'string') {
    return val.split(/[,\s]+/).filter(Boolean).map(Number);
  }
  return [];
}

const FL_APIM_URL = 'https://apim-website-prod-eastus.azure-api.net/drawgamesapp/getLatestDrawGames';
const FL_HTML_URL = 'https://www.flalottery.com/exptkt/pick3';

/**
 * Florida Lottery adapter (ING-1/ING-2).
 * Fetches from APIM with x-partner header; falls back to HTML on schema drift.
 */
export class FlAdapter implements DrawAdapter {
  state: State = 'FL';

  private alertListeners: Array<() => void> = [];
  private fallbackListeners: Array<() => void> = [];

  /** Register alert handler (ING-2: schema drift alert). */
  onAlert(listener: () => void): void {
    this.alertListeners.push(listener);
  }

  /** Register fallback handler (ING-2: HTML fallback trigger). */
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
      // FL APIM with x-partner header (ING-1)
      const response = await fetch(FL_APIM_URL, {
        headers: { 'x-partner': 'web' },
      });

      if (!response.ok) {
        this.raiseAlert();
        return [];
      }

      const json = await response.json();
      const parsed = FlResponseSchema.safeParse(json);

      if (!parsed.success) {
        // Schema drift → alert + HTML fallback (ING-2)
        this.raiseAlert();
        this.triggerFallback();
        return this.fetchHtmlFallback();
      }

      return parsed.data.drawGames
        .map((raw) => this.normalizeDraw(raw))
        .filter((d): d is Draw => d !== null);
    } catch {
      this.raiseAlert();
      return [];
    }
  }

  private normalizeDraw(raw: z.infer<typeof FlDrawSchema>): Draw | null {
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
        jackpot: raw.jackpot ?? null,
        prizeTiers: [],
        sourceRef: `fl-${raw.gameId}-${raw.drawDate}-${drawType}`,
        sourceUrl: FL_APIM_URL,
      };
    } catch {
      return null;
    }
  }

  private async fetchHtmlFallback(): Promise<Draw[]> {
    try {
      const response = await fetch(FL_HTML_URL);
      if (!response.ok) return [];
      const html = await response.text();
      return parseFlHtml(html);
    } catch {
      return [];
    }
  }
}
