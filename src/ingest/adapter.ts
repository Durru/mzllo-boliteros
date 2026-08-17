import type { State, DrawType, Tier } from '../store/queries.ts';

export type { State, DrawType, Tier };

/**
 * A draw exactly as fetched from external APIs (ING-1).
 * Compatible with DrawInput from queries.ts for upsert.
 */
export interface Draw {
  state: State;
  gameId: string;
  gameName: string;
  drawDate: string; // YYYY-MM-DD
  drawType: DrawType;
  numbers: number[];
  bonus: number[] | null;
  multiplier: number | null;
  jackpot: number | null;
  prizeTiers: Tier[];
  sourceRef: string;
  sourceUrl: string;
}

/**
 * Adapter interface for fetching latest draws from a state's official feed (ING-1).
 * Each state implements its own adapter with state-specific API logic.
 */
export interface DrawAdapter {
  /** State this adapter covers (FL, GA, or NY). */
  state: State;

  /** Fetch the latest draws from the official feed. Returns empty array on error. */
  fetchLatest(): Promise<Draw[]>;
}
