import type { DatabaseSync } from 'node:sqlite';
import type { Channel } from '../store/queries.ts';
import { markPublishSent, markPublishFailed, getChannelsNeedingSend } from '../store/queries.ts';
import type { Draw } from '../ingest/adapter.ts';
import { renderSvg } from '../cards/render-svg.ts';
import { toPng } from '../cards/to-png.ts';

/** Minimal Bot API interface — only sendPhoto is needed for publishing. */
export interface BotApi {
  sendPhoto(chatId: string, photo: Buffer, caption: string): Promise<{ message_id: number }>;
}

/** A Draw with the DB-assigned id (needed for publish_log lookups). */
export interface PublishDraw extends Draw {
  id: number;
}

export interface PublishResult {
  sent: boolean;
  messageId?: string;
}

/**
 * Idempotently publish a draw card to a Telegram channel.
 * - If already 'sent' in publish_log → skip (returns { sent: false })
 * - Renders SVG → PNG → sendPhoto
 * - On success: marks as sent
 * - On failure: marks as failed, throws
 */
export async function publishDraw(
  db: DatabaseSync,
  draw: PublishDraw,
  channel: Channel,
  chatId: string,
  botApi: BotApi,
): Promise<PublishResult> {
  const pending = getChannelsNeedingSend(db, draw.id);
  if (!pending.includes(channel)) {
    return { sent: false };
  }

  const caption = buildCaption(draw);
  const svg = renderSvg(draw);
  const png = await toPng(svg);

  try {
    const response = await botApi.sendPhoto(chatId, png, caption);
    markPublishSent(db, { drawId: draw.id, channel, telegramMessageId: String(response.message_id) });
    return { sent: true, messageId: String(response.message_id) };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    markPublishFailed(db, { drawId: draw.id, channel, error });
    throw err;
  }
}

function buildCaption(draw: Draw): string {
  const parts: string[] = [];
  parts.push(`${draw.gameName} (${draw.state})`);
  parts.push(`📅 ${draw.drawDate} • ${draw.drawType}`);
  parts.push(`🎱 ${draw.numbers.join(' - ')}`);

  if (draw.bonus && draw.bonus.length > 0) {
    parts.push(`⭐ Bonus: ${draw.bonus.join(', ')}`);
  }
  if (draw.multiplier !== null) {
    parts.push(`✖️ Multiplier: ×${draw.multiplier}`);
  }
  if (draw.jackpot !== null) {
    parts.push(`💰 Jackpot: $${draw.jackpot.toLocaleString('en-US')}`);
  }

  parts.push(`\nSource: ${draw.sourceRef}`);
  return parts.join('\n');
}
