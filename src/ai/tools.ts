import type { DatabaseSync } from 'node:sqlite';
import { getCurrentResult, getHistory, getJackpot, getPrizeTiers } from '../store/queries.ts';

export interface Tool {
  name: string;
  description: string;
  execute: (args: Record<string, unknown>) => string;
}

/**
 * Create store-backed tools for the AI assistant (AIA-1).
 * Each tool queries the SQLite store — the AI answers ONLY from tool results.
 */
export function createTools(db: DatabaseSync): Tool[] {
  return [
    {
      name: 'get_latest_result',
      description: 'Get the latest lottery draw result for a state and game.',
      execute: (args) => {
        const state = args.state as string;
        const gameId = args.game_id as string;
        if (!state || !gameId) return 'Error: state and game_id are required.';
        if (!['FL', 'GA', 'NY'].includes(state)) return 'Error: state must be FL, GA, or NY.';

        const draw = getCurrentResult(db, { state: state as 'FL' | 'GA' | 'NY', gameId });
        if (!draw) return `No results found for ${state} ${gameId}.`;

        const lines: string[] = [];
        lines.push(`${draw.gameName} (${draw.state}) — ${draw.drawDate} ${draw.drawType}`);
        lines.push(`Numbers: ${draw.numbers.join(', ')}`);
        if (draw.bonus && draw.bonus.length > 0) lines.push(`Bonus: ${draw.bonus.join(', ')}`);
        if (draw.multiplier !== null) lines.push(`Multiplier: ×${draw.multiplier}`);
        if (draw.jackpot !== null) lines.push(`Jackpot: $${draw.jackpot.toLocaleString('en-US')}`);
        lines.push(`Source: ${draw.sourceRef}`);
        return lines.join('\n');
      },
    },
    {
      name: 'get_history',
      description: 'Get paginated draw history for a state and game.',
      execute: (args) => {
        const state = args.state as string;
        const gameId = args.game_id as string;
        const limit = (args.limit as number) ?? 5;
        if (!state || !gameId) return 'Error: state and game_id are required.';
        if (!['FL', 'GA', 'NY'].includes(state)) return 'Error: state must be FL, GA, or NY.';

        const draws = getHistory(db, { state: state as 'FL' | 'GA' | 'NY', gameId, limit });
        if (draws.length === 0) return `No history found for ${state} ${gameId}.`;

        const lines = draws.map(
          (d) => `${d.drawDate} ${d.drawType}: ${d.numbers.join(', ')}`,
        );
        return `History for ${state} ${gameId} (last ${draws.length}):\n${lines.join('\n')}`;
      },
    },
    {
      name: 'get_jackpot',
      description: 'Get the current jackpot for a state and game.',
      execute: (args) => {
        const state = args.state as string;
        const gameId = args.game_id as string;
        if (!state || !gameId) return 'Error: state and game_id are required.';
        if (!['FL', 'GA', 'NY'].includes(state)) return 'Error: state must be FL, GA, or NY.';

        const jackpot = getJackpot(db, { state: state as 'FL' | 'GA' | 'NY', gameId });
        if (jackpot === null) return `No jackpot data for ${state} ${gameId}.`;
        return `Current jackpot for ${state} ${gameId}: $${jackpot.toLocaleString('en-US')}`;
      },
    },
    {
      name: 'get_prize_tiers',
      description: 'Get prize tiers for a specific draw.',
      execute: (args) => {
        const state = args.state as string;
        const gameId = args.game_id as string;
        const drawDate = args.draw_date as string;
        const drawType = args.draw_type as string;
        if (!state || !gameId || !drawDate || !drawType) {
          return 'Error: state, game_id, draw_date, and draw_type are required.';
        }
        if (!['FL', 'GA', 'NY'].includes(state)) return 'Error: state must be FL, GA, or NY.';
        if (!['midday', 'evening'].includes(drawType)) return 'Error: draw_type must be midday or evening.';

        const tiers = getPrizeTiers(db, {
          state: state as 'FL' | 'GA' | 'NY',
          gameId,
          drawDate,
          drawType: drawType as 'midday' | 'evening',
        });
        if (tiers.length === 0) return `No prize tiers for ${state} ${gameId} on ${drawDate} ${drawType}.`;

        const lines = tiers.map((t) => `${t.match}: ${t.prize}`);
        return `Prize tiers for ${state} ${gameId} (${drawDate} ${drawType}):\n${lines.join('\n')}`;
      },
    },
  ];
}
