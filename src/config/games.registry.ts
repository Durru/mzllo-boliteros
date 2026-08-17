import type { State } from '../store/queries.ts';

export type { State };

export type RegistryStatus = 'active' | 'possible_retired' | 'retired';

/** Which draws a game runs (mirrors store DrawType). */
export type DrawType = 'midday' | 'evening';

export interface GameSchedule {
  state: State;
  gameId: string;
  gameName: string;
  /** Days of the week the game draws, 0 = Sunday ... 6 = Saturday. */
  drawDays: number[];
  /** Draw windows run by the game (midday and/or evening). */
  drawTypes: DrawType[];
  /** Last successfully observed draw date (YYYY-MM-DD), for health-window checks. */
  lastObservedDraw?: string;
  /** Explicit operator-set status; overrides automatic evaluation when 'retired'. */
  status?: RegistryStatus;
  /** Days of silence that trigger `possible_retired` when a lastObservedDraw is set. */
  healthWindowDays?: number;
}

/** Full platform game registry (ING-3): data-driven, restricted to FL/GA/NY. */
export interface GameRegistry {
  games: GameSchedule[];
}

/**
 * Registered games only — FL/GA/NY per proposal and ING-3. Includes FL
 * CASH4LIFE, last observed 2026-02-21 and possibly retired (AD-2): it stays
 * registered so the ingest never blocks, and the health window surfaces it
 * for operator confirmation.
 */
const GAMES: GameSchedule[] = [
  // --- Florida Lottery ---
  { state: 'FL', gameId: 'pick2', gameName: 'Pick 2', drawDays: [0, 1, 2, 3, 4, 5, 6], drawTypes: ['midday', 'evening'] },
  { state: 'FL', gameId: 'pick3', gameName: 'Pick 3', drawDays: [0, 1, 2, 3, 4, 5, 6], drawTypes: ['midday', 'evening'] },
  { state: 'FL', gameId: 'pick4', gameName: 'Pick 4', drawDays: [0, 1, 2, 3, 4, 5, 6], drawTypes: ['midday', 'evening'] },
  { state: 'FL', gameId: 'pick5', gameName: 'Pick 5', drawDays: [0, 1, 2, 3, 4, 5, 6], drawTypes: ['midday', 'evening'] },
  { state: 'FL', gameId: 'fantasy5', gameName: 'Fantasy 5', drawDays: [0, 1, 2, 3, 4, 5, 6], drawTypes: ['evening'] },
  { state: 'FL', gameId: 'powerball', gameName: 'Powerball', drawDays: [1, 3, 6], drawTypes: ['evening'] },
  { state: 'FL', gameId: 'mega-millions', gameName: 'Mega Millions', drawDays: [2, 5], drawTypes: ['evening'] },
  {
    state: 'FL',
    gameId: 'cash4life',
    gameName: 'CASH4LIFE',
    drawDays: [0, 1, 2, 3, 4, 5, 6],
    drawTypes: ['evening'],
    lastObservedDraw: '2026-02-21',
    healthWindowDays: 2, // daily game: a couple of missed windows flags it
  },

  // --- Georgia Lottery ---
  { state: 'GA', gameId: 'cash3', gameName: 'Cash 3', drawDays: [0, 1, 2, 3, 4, 5, 6], drawTypes: ['midday', 'evening'] },
  { state: 'GA', gameId: 'cash4', gameName: 'Cash 4', drawDays: [0, 1, 2, 3, 4, 5, 6], drawTypes: ['midday', 'evening'] },
  { state: 'GA', gameId: 'fantasy5', gameName: 'Fantasy 5', drawDays: [0, 1, 2, 3, 4, 5, 6], drawTypes: ['evening'] },
  { state: 'GA', gameId: 'powerball', gameName: 'Powerball', drawDays: [1, 3, 6], drawTypes: ['evening'] },
  { state: 'GA', gameId: 'mega-millions', gameName: 'Mega Millions', drawDays: [2, 5], drawTypes: ['evening'] },

  // --- New York Lottery ---
  { state: 'NY', gameId: 'numbers', gameName: 'Numbers', drawDays: [0, 1, 2, 3, 4, 5, 6], drawTypes: ['midday', 'evening'] },
  { state: 'NY', gameId: 'win4', gameName: 'Win 4', drawDays: [0, 1, 2, 3, 4, 5, 6], drawTypes: ['midday', 'evening'] },
  { state: 'NY', gameId: 'take5', gameName: 'Take 5', drawDays: [0, 1, 2, 3, 4, 5, 6], drawTypes: ['evening'] },
  { state: 'NY', gameId: 'powerball', gameName: 'Powerball', drawDays: [1, 3, 6], drawTypes: ['evening'] },
  { state: 'NY', gameId: 'mega-millions', gameName: 'Mega Millions', drawDays: [2, 5], drawTypes: ['evening'] },
];

export const gamesRegistry: GameRegistry = { games: GAMES };

/** All registered games for a state (ING-3 registry-driven polling scope). */
export function getGamesByState(state: State): GameSchedule[] {
  return GAMES.filter((g) => g.state === state);
}

/** Find one registered game by state + id, or undefined when not registered. */
export function findGame(state: State, gameId: string): GameSchedule | undefined {
  return GAMES.find((g) => g.state === state && g.gameId === gameId);
}

/** Whole days elapsed from `from` to `to` (both YYYY-MM-DD, UTC-based). */
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.floor((toMs - fromMs) / 86_400_000);
}

export interface HealthWindowOptions {
  /** Days of silence that trigger `possible_retired`. */
  maxSilentDays?: number;
}

/**
 * Evaluate a game's registry status against its health window (AD-2 / ING-3).
 *
 * - A game explicitly `retired` stays retired.
 * - A game with a `lastObservedDraw` older than the health window becomes
 *   `possible_retired` (surfaced for operator confirmation, never blocks ingest).
 * - Otherwise it is `active`.
 */
export function evaluateGameStatus(
  game: GameSchedule,
  today: string,
  options: HealthWindowOptions = {},
): RegistryStatus {
  if (game.status === 'retired') return 'retired';

  if (game.lastObservedDraw !== undefined) {
    const maxSilentDays = options.maxSilentDays ?? game.healthWindowDays;
    if (maxSilentDays !== undefined && daysBetween(game.lastObservedDraw, today) > maxSilentDays) {
      return 'possible_retired';
    }
  }
  return 'active';
}
