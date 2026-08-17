import type { DatabaseSync } from 'node:sqlite';
import { getCurrentResult } from '../store/queries.ts';

export interface MemberChecker {
  /** Check if a Telegram user has active membership. */
  isActiveMember(telegramUserId: number): boolean;
}

export interface JoinGateResult {
  action: 'approved' | 'declined' | 'timeout';
  reason: string;
}

/**
 * Handle a chat_join_request event (TGB-3).
 * Approves if member is active, declines otherwise.
 */
export function handleJoinRequest(
  db: DatabaseSync,
  telegramUserId: number,
  memberChecker: MemberChecker,
): JoinGateResult {
  const isActive = memberChecker.isActiveMember(telegramUserId);

  if (isActive) {
    return { action: 'approved', reason: 'Member is active' };
  }

  return {
    action: 'declined',
    reason: 'Membership required. Use /help for information on how to join.',
  };
}

/**
 * Create a MemberChecker backed by the SQLite members table.
 */
export function createMemberChecker(db: DatabaseSync): MemberChecker {
  return {
    isActiveMember(telegramUserId: number): boolean {
      const row = db
        .prepare('SELECT status FROM members WHERE telegram_user_id = ?')
        .get(telegramUserId) as { status: string } | undefined;
      return row?.status === 'active';
    },
  };
}
