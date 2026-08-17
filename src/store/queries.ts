import type { DatabaseSync } from 'node:sqlite';

export type State = 'FL' | 'GA' | 'NY';
export type DrawType = 'midday' | 'evening';
export type Channel = 'public' | 'private';

export interface Tier {
  match: string;
  prize: string;
}

/** A draw exactly as stored/queried (STO-2 normalized shape). */
export interface Draw {
  id: number;
  state: State;
  gameId: string;
  gameName: string;
  drawDate: string; // YYYY-MM-DD, state-local date
  drawType: DrawType;
  numbers: number[];
  bonus: number[] | null;
  multiplier: number | null;
  jackpot: number | null;
  prizeTiers: Tier[];
  sourceRef: string;
  sourceUrl: string;
}

/** Upsert payload — same shape as Draw minus the DB-assigned id. */
export type DrawInput = Omit<Draw, 'id'>;

export interface DrawFilter {
  state: State;
  gameId: string;
  drawType?: DrawType;
}

export interface HistoryOptions extends DrawFilter {
  limit?: number;
  offset?: number;
  from?: string; // inclusive YYYY-MM-DD
  to?: string; // inclusive YYYY-MM-DD
}

export interface PrizeTierFilter extends DrawFilter {
  drawDate: string;
  drawType: DrawType;
}

export interface PublishState {
  drawId: number;
  channel: Channel;
  status: 'sent' | 'failed';
  telegramMessageId: string | null;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: string;
}

const DRAW_COLUMNS = [
  'id',
  'state',
  'game_id',
  'game_name',
  'draw_date',
  'draw_type',
  'numbers',
  'bonus',
  'multiplier',
  'jackpot',
  'prize_tiers',
  'source_ref',
  'source_url',
].join(', ');

function parseJsonArray<T>(text: string | null, fallback: T[]): T[] {
  if (text === null || text === '') return fallback;
  try {
    return JSON.parse(text) as T[];
  } catch {
    return fallback;
  }
}

function rowToDraw(row: Record<string, unknown>): Draw {
  return {
    id: Number(row.id),
    state: row.state as State,
    gameId: row.game_id as string,
    gameName: row.game_name as string,
    drawDate: row.draw_date as string,
    drawType: row.draw_type as DrawType,
    numbers: parseJsonArray<number>(row.numbers as string | null, []),
    bonus: parseJsonArray<number>(row.bonus as string | null, []),
    multiplier: row.multiplier === null ? null : Number(row.multiplier),
    jackpot: row.jackpot === null ? null : Number(row.jackpot),
    prizeTiers: parseJsonArray<Tier>(row.prize_tiers as string | null, []),
    sourceRef: row.source_ref as string,
    sourceUrl: row.source_url as string,
  };
}

function rowToPublishState(row: Record<string, unknown>): PublishState {
  return {
    drawId: Number(row.draw_id),
    channel: row.channel as Channel,
    status: row.status as 'sent' | 'failed',
    telegramMessageId: row.telegram_message_id === null ? null : String(row.telegram_message_id),
    attempts: Number(row.attempts),
    lastError: row.last_error === null ? null : String(row.last_error),
    lastAttemptAt: row.last_attempt_at as string,
  };
}

/** SQLite cannot bind `undefined`; normalize optional numeric fields to null. */
function nullable(value: number | null | undefined): number | null {
  return value === undefined ? null : value;
}

/**
 * Upsert a draw keyed on (state, game_id, draw_date, draw_type).
 * Returns the row id — the same id on repeated upserts (STO-1).
 */
export function upsertDraw(db: DatabaseSync, draw: DrawInput): number {
  const result = db
    .prepare(
      `INSERT INTO draws
         (state, game_id, game_name, draw_date, draw_type, numbers, bonus,
          multiplier, jackpot, prize_tiers, source_ref, source_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (state, game_id, draw_date, draw_type) DO UPDATE SET
         game_name = excluded.game_name,
         numbers = excluded.numbers,
         bonus = excluded.bonus,
         multiplier = excluded.multiplier,
         jackpot = excluded.jackpot,
         prize_tiers = excluded.prize_tiers,
         source_ref = excluded.source_ref,
         source_url = excluded.source_url,
         updated_at = datetime('now')`,
    )
    .run(
      draw.state,
      draw.gameId,
      draw.gameName,
      draw.drawDate,
      draw.drawType,
      JSON.stringify(draw.numbers),
      draw.bonus === null || draw.bonus === undefined ? null : JSON.stringify(draw.bonus),
      nullable(draw.multiplier),
      nullable(draw.jackpot),
      JSON.stringify(draw.prizeTiers),
      draw.sourceRef,
      draw.sourceUrl,
    );
  return Number(result.lastInsertRowid);
}

/** Latest stored draw for a state/game, optionally filtered by draw type. */
export function getCurrentResult(db: DatabaseSync, filter: DrawFilter): Draw | null {
  const clauses = ['state = ?', 'game_id = ?'];
  const params: (string | number)[] = [filter.state, filter.gameId];
  if (filter.drawType !== undefined) {
    clauses.push('draw_type = ?');
    params.push(filter.drawType);
  }
  const row = db
    .prepare(
      `SELECT ${DRAW_COLUMNS} FROM draws
       WHERE ${clauses.join(' AND ')}
       ORDER BY draw_date DESC, id DESC
       LIMIT 1`,
    )
    .get(...params) as Record<string, unknown> | undefined;
  return row === undefined ? null : rowToDraw(row);
}

/**
 * Paginated draw history, newest first, within an optional date range.
 * Returns an empty array when no draws match (STO-2).
 */
export function getHistory(db: DatabaseSync, options: HistoryOptions): Draw[] {
  const clauses = ['state = ?', 'game_id = ?'];
  const params: (string | number)[] = [options.state, options.gameId];
  if (options.drawType !== undefined) {
    clauses.push('draw_type = ?');
    params.push(options.drawType);
  }
  if (options.from !== undefined) {
    clauses.push('draw_date >= ?');
    params.push(options.from);
  }
  if (options.to !== undefined) {
    clauses.push('draw_date <= ?');
    params.push(options.to);
  }
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  params.push(limit, offset);
  const rows = db
    .prepare(
      `SELECT ${DRAW_COLUMNS} FROM draws
       WHERE ${clauses.join(' AND ')}
       ORDER BY draw_date DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params) as Record<string, unknown>[];
  return rows.map(rowToDraw);
}

/** Latest jackpot for a state/game, or null when none is stored. */
export function getJackpot(db: DatabaseSync, filter: DrawFilter): number | null {
  const row = db
    .prepare(
      `SELECT jackpot FROM draws
       WHERE state = ? AND game_id = ? AND jackpot IS NOT NULL
       ORDER BY draw_date DESC, id DESC
       LIMIT 1`,
    )
    .get(filter.state, filter.gameId) as { jackpot: number } | undefined;
  return row === undefined ? null : Number(row.jackpot);
}

/** Prize tiers for one specific draw; empty array when the draw has none. */
export function getPrizeTiers(db: DatabaseSync, filter: PrizeTierFilter): Tier[] {
  const row = db
    .prepare(
      `SELECT prize_tiers FROM draws
       WHERE state = ? AND game_id = ? AND draw_date = ? AND draw_type = ?`,
    )
    .get(filter.state, filter.gameId, filter.drawDate, filter.drawType) as
    | { prize_tiers: string }
    | undefined;
  return row === undefined ? [] : parseJsonArray<Tier>(row.prize_tiers, []);
}

/**
 * Mark a channel as successfully published for a draw.
 * Returns true when the row was created/updated; false when the channel was
 * already 'sent' (idempotent — never re-sends a sent channel, STO-3).
 */
export function markPublishSent(
  db: DatabaseSync,
  input: { drawId: number; channel: Channel; telegramMessageId: string },
): boolean {
  const existing = db
    .prepare('SELECT status FROM publish_log WHERE draw_id = ? AND channel = ?')
    .get(input.drawId, input.channel) as { status: 'sent' | 'failed' } | undefined;
  if (existing?.status === 'sent') return false;

  const result = db
    .prepare(
      `INSERT INTO publish_log (draw_id, channel, status, telegram_message_id, attempts, last_error)
       VALUES (?, ?, 'sent', ?, 1, NULL)
       ON CONFLICT (draw_id, channel) DO UPDATE SET
         status = 'sent',
         telegram_message_id = excluded.telegram_message_id,
         attempts = publish_log.attempts + 1,
         last_error = NULL,
         last_attempt_at = datetime('now')`,
    )
    .run(input.drawId, input.channel, input.telegramMessageId);
  return Number(result.changes) > 0;
}

/** Record a failed publish attempt for a channel (status 'failed', error kept). */
export function markPublishFailed(
  db: DatabaseSync,
  input: { drawId: number; channel: Channel; error: string },
): void {
  db.prepare(
    `INSERT INTO publish_log (draw_id, channel, status, attempts, last_error)
     VALUES (?, ?, 'failed', 1, ?)
     ON CONFLICT (draw_id, channel) DO UPDATE SET
       status = 'failed',
       attempts = publish_log.attempts + 1,
       last_error = excluded.last_error,
       last_attempt_at = datetime('now')`,
  ).run(input.drawId, input.channel, input.error);
}

/** Full publish log for a draw, newest attempt last, one row per channel. */
export function getPublishLog(db: DatabaseSync, drawId: number): PublishState[] {
  const rows = db
    .prepare(
      `SELECT draw_id, channel, status, telegram_message_id, attempts, last_error, last_attempt_at
       FROM publish_log
       WHERE draw_id = ?
       ORDER BY channel, id`,
    )
    .all(drawId) as Record<string, unknown>[];
  return rows.map(rowToPublishState);
}

/**
 * Channels that still need a publish attempt for the draw:
 * never attempted, or last attempt 'failed'. Sent channels are excluded,
 * so a retry never re-sends already-published channels (STO-3).
 */
export function getChannelsNeedingSend(db: DatabaseSync, drawId: number): Channel[] {
  const rows = db
    .prepare('SELECT channel, status FROM publish_log WHERE draw_id = ?')
    .all(drawId) as { channel: Channel; status: 'sent' | 'failed' }[];
  const statusByChannel = new Map(rows.map((r) => [r.channel, r.status]));
  const allChannels: Channel[] = ['public', 'private'];
  return allChannels.filter((channel) => statusByChannel.get(channel) !== 'sent');
}
