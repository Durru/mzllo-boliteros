import type { DatabaseSync } from 'node:sqlite';
import { getCurrentResult, getHistory, getJackpot } from '../store/queries.ts';

export interface BotContext {
  db: DatabaseSync;
}

export interface CommandResult {
  text: string;
}

/** /results — Show latest draw results for a state/game. */
export function resultsCommand(db: DatabaseSync, args: string[]): CommandResult {
  const state = (args[0] ?? 'FL').toUpperCase();
  const gameId = args[1] ?? 'pick3';

  if (!['FL', 'GA', 'NY'].includes(state)) {
    return { text: '⚠️ Estado no válido. Usa FL, GA o NY.' };
  }

  const draw = getCurrentResult(db, { state: state as 'FL' | 'GA' | 'NY', gameId });
  if (!draw) {
    return { text: `No hay resultados para ${state} ${gameId}.` };
  }

  const lines: string[] = [];
  lines.push(`🎱 *${draw.gameName}* (${draw.state})`);
  lines.push(`📅 ${draw.drawDate} • ${draw.drawType}`);
  lines.push(`🔢 ${draw.numbers.join(' - ')}`);

  if (draw.bonus && draw.bonus.length > 0) {
    lines.push(`⭐ Bonus: ${draw.bonus.join(', ')}`);
  }
  if (draw.multiplier !== null) {
    lines.push(`✖️ Multiplier: ×${draw.multiplier}`);
  }
  if (draw.jackpot !== null) {
    lines.push(`💰 Jackpot: $${draw.jackpot.toLocaleString('en-US')}`);
  }

  return { text: lines.join('\n') };
}

/** /stats — Show jackpot and recent draw count for a state/game. */
export function statsCommand(db: DatabaseSync, args: string[]): CommandResult {
  const state = (args[0] ?? 'FL').toUpperCase();
  const gameId = args[1] ?? 'pick3';

  if (!['FL', 'GA', 'NY'].includes(state)) {
    return { text: '⚠️ Estado no válido. Usa FL, GA o NY.' };
  }

  const jackpot = getJackpot(db, { state: state as 'FL' | 'GA' | 'NY', gameId });
  const history = getHistory(db, { state: state as 'FL' | 'GA' | 'NY', gameId, limit: 30 });

  const lines: string[] = [];
  lines.push(`📊 *Stats: ${state} ${gameId}*`);

  if (jackpot !== null) {
    lines.push(`💰 Jackpot actual: $${jackpot.toLocaleString('en-US')}`);
  } else {
    lines.push('💰 Jackpot: no disponible');
  }

  lines.push(`📈 Draws almacenados: ${history.length}`);

  if (history.length > 0) {
    const latest = history[0];
    lines.push(`🕐 Último draw: ${latest.drawDate} • ${latest.drawType}`);
  }

  return { text: lines.join('\n') };
}

/** /help — List available commands. */
export function helpCommand(): CommandResult {
  const lines: string[] = [
    '🤖 *Mzllo Boliteros — Comandos*',
    '',
    '🎱 /results [estado] [juego]',
    '   Resultados del último sorteo',
    '   Ej: /results FL pick3',
    '',
    '📊 /stats [estado] [juego]',
    '   Estadísticas y jackpot',
    '   Ej: /stats FL powerball',
    '',
    'ℹ️ /help',
    '   Mostrar esta ayuda',
    '',
    'Estados: FL, GA, NY',
    'Juegos: pick2, pick3, pick4, pick5, fantasy5, powerball, mega Millions (FL)',
    '        cash3, cash4, fantasy5, powerball, mega Millions (GA)',
    '        numbers, win4, take5, powerball, mega Millions (NY)',
  ];
  return { text: lines.join('\n') };
}

/** Route a bot command to its handler. */
export function handleCommand(db: DatabaseSync, command: string, args: string[]): CommandResult {
  switch (command) {
    case '/results':
      return resultsCommand(db, args);
    case '/stats':
      return statsCommand(db, args);
    case '/help':
      return helpCommand();
    default:
      return { text: 'Comando no reconocido. Usa /help para ver los comandos disponibles.' };
  }
}
