import { z } from 'zod';
import type { DrawAdapter, Draw } from './adapter.ts';
import type { State } from '../store/queries.ts';

/** NY Socrata draw schema (ING-2). */
const NyDrawSchema = z.object({
  draw_id: z.string(),
  game: z.string(),
  draw_date: z.string(),
  draw_time: z.string(), // 'MIDDAY' | 'EVENING'
  winning_numbers: z.string(), // space-separated
  multiplier: z.number().nullable().optional(),
  estimated_jackpot: z.number().nullable().optional(),
}).passthrough();

const NyResponseSchema = z.array(NyDrawSchema);

/** Normalize NY draw_time to DrawType. */
function normalizeDrawType(raw: string): 'midday' | 'evening' {
  const upper = raw.toUpperCase();
  if (upper.includes('MID')) return 'midday';
  return 'evening';
}

/** Map NY game names to gameId. */
function gameIdForGame(game: string): string {
  const map: Record<string, string> = {
    'Numbers': 'numbers',
    'Win 4': 'win4',
    'Take 5': 'take5',
    'Powerball': 'powerball',
    'Mega Millions': 'mega-millions',
    'Lotto': 'lotto',
    'Quick Draw': 'quick-draw',
  };
  return map[game] ?? game.toLowerCase().replace(/\s+/g, '-');
}

/** Parse space-separated winning numbers. */
function parseNumbers(val: string): number[] {
  return val.split(/\s+/).filter(Boolean).map(Number);
}

/** NY Socrata dataset IDs (ING-1). */
const NY_DATASETS: Record<string, string> = {
  'mega-millions': '5xaw-6ayf',
  'powerball': 'd6yy-54nr',
  'take5': 'dg63-4siq',
  'numbers': 'hsys-3def',
  'win4': 'hsys-3def', // Same dataset as Numbers
  'lotto': '6nbc-h7bj',
  'quick-draw': '7sqk-ycpk',
};

const NY_API_BASE = 'https://data.ny.gov/resource';

/**
 * New York Lottery adapter (ING-1/ING-2).
 * Fetches from Socrata datasets for each registered NY game.
 */
export class NyAdapter implements DrawAdapter {
  state: State = 'NY';

  private alertListeners: Array<() => void> = [];

  onAlert(listener: () => void): void {
    this.alertListeners.push(listener);
  }

  private raiseAlert(): void {
    for (const listener of this.alertListeners) listener();
  }

  async fetchLatest(): Promise<Draw[]> {
    const draws: Draw[] = [];

    // Fetch from each registered NY dataset (ING-1: registry-driven)
    for (const [gameId, datasetId] of Object.entries(NY_DATASETS)) {
      try {
        const gameDraws = await this.fetchGame(gameId, datasetId);
        draws.push(...gameDraws);
      } catch {
        // Continue with other games on error
        continue;
      }
    }

    return draws;
  }

  private async fetchGame(gameId: string, datasetId: string): Promise<Draw[]> {
    const url = `${NY_API_BASE}/${datasetId}.json?$limit=10&$order=draw_date DESC`;

    const response = await fetch(url);
    if (!response.ok) {
      this.raiseAlert();
      return [];
    }

    const json = await response.json();
    const parsed = NyResponseSchema.safeParse(json);

    if (!parsed.success) {
      this.raiseAlert();
      return [];
    }

    return parsed.data
      .map((raw) => this.normalizeDraw(raw, gameId))
      .filter((d): d is Draw => d !== null);
  }

  private normalizeDraw(raw: z.infer<typeof NyDrawSchema>, gameId: string): Draw | null {
    try {
      const drawType = normalizeDrawType(raw.draw_time);
      const numbers = parseNumbers(raw.winning_numbers);
      const gameName = raw.game;

      return {
        state: this.state,
        gameId: gameIdForGame(gameName),
        gameName,
        drawDate: raw.draw_date,
        drawType,
        numbers,
        bonus: null,
        multiplier: raw.multiplier ?? null,
        jackpot: raw.estimated_jackpot ?? null,
        prizeTiers: [],
        sourceRef: `ny-${gameId}-${raw.draw_date}-${drawType}`,
        sourceUrl: `${NY_API_BASE}/${NY_DATASETS[gameId] ?? gameId}.json`,
      };
    } catch {
      return null;
    }
  }
}
