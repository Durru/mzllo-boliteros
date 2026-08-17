import type { DrawAdapter, Draw } from './adapter.ts';
import type { State } from '../store/queries.ts';
import { getGamesByState, type GameSchedule } from '../config/games.registry.ts';

export interface SchedulerOptions {
  /** Max retries before alerting. */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff. */
  baseDelayMs?: number;
  /** Window in ms after which to alert if no draw appears. */
  windowMs?: number;
}

export interface PollResult {
  state: State;
  draws: Draw[];
  success: boolean;
  retries: number;
  error?: string;
}

/**
 * Calculate exponential backoff with jitter (ING-1).
 * Formula: baseDelay * 2^(attempt-1) + random jitter (0-50% of base).
 */
export function calculateBackoff(attempt: number, baseDelayMs: number): number {
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * baseDelayMs * 0.5;
  return exponential + jitter;
}

/**
 * Scheduler for polling state lottery feeds (ING-1/ING-2/ING-3).
 * - Per-state enabled flags
 * - Exponential backoff with jitter on missing draws
 * - Alert after window elapses
 * - Registry-driven game scope (ING-3)
 */
export class StateScheduler {
  private enabledStates: Set<State> = new Set(['FL', 'GA', 'NY']);
  private alertListeners: Array<(state: State, error: string) => void> = [];

  /** Check if a state is enabled for polling. */
  isEnabled(state: State): boolean {
    return this.enabledStates.has(state);
  }

  /** Enable or disable a state for polling. */
  setEnabled(state: State, enabled: boolean): void {
    if (enabled) {
      this.enabledStates.add(state);
    } else {
      this.enabledStates.delete(state);
    }
  }

  /** Register alert handler for missing draws / schema drift. */
  onAlert(listener: (state: State, error: string) => void): void {
    this.alertListeners.push(listener);
  }

  private raiseAlert(state: State, error: string): void {
    for (const listener of this.alertListeners) listener(state, error);
  }

  /** Get registered games for a state from the registry (ING-3). */
  getRegisteredGamesForState(state: State): GameSchedule[] {
    return getGamesByState(state);
  }

  /**
   * Poll an adapter with retry, backoff, and alert (ING-1).
   * Returns when draws are found or window elapses.
   */
  async pollWithRetry(
    adapter: DrawAdapter,
    options: SchedulerOptions = {},
  ): Promise<PollResult> {
    const maxRetries = options.maxRetries ?? 5;
    const baseDelayMs = options.baseDelayMs ?? 1000;
    const windowMs = options.windowMs ?? 300_000; // 5 minutes default

    const startTime = Date.now();
    let attempt = 0;

    while (attempt < maxRetries) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= windowMs) {
        // Window elapsed, no draw found → alert (ING-1)
        this.raiseAlert(adapter.state, `No draw available after ${windowMs}ms window`);
        return {
          state: adapter.state,
          draws: [],
          success: false,
          retries: attempt,
          error: `Window elapsed: ${windowMs}ms`,
        };
      }

      try {
        const draws = await adapter.fetchLatest();
        if (draws.length > 0) {
          return {
            state: adapter.state,
            draws,
            success: true,
            retries: attempt,
          };
        }
      } catch (err) {
        // Adapter error, continue with retry
      }

      attempt++;

      if (attempt < maxRetries) {
        const delay = calculateBackoff(attempt, baseDelayMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Exhausted retries → alert
    this.raiseAlert(adapter.state, `No draw after ${maxRetries} retries`);
    return {
      state: adapter.state,
      draws: [],
      success: false,
      retries: maxRetries,
      error: `Exhausted ${maxRetries} retries`,
    };
  }

  /**
   * Poll all enabled states using their adapters (ING-3: registry-driven).
   * Returns results for each state.
   */
  async pollAll(
    adapters: Map<State, DrawAdapter>,
  ): Promise<PollResult[]> {
    const results: PollResult[] = [];

    for (const state of this.enabledStates) {
      const adapter = adapters.get(state);
      if (!adapter) continue;

      const result = await this.pollWithRetry(adapter);
      results.push(result);
    }

    return results;
  }
}
