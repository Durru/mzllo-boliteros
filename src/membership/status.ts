import type { DatabaseSync } from 'node:sqlite';

export type MemberStatus = 'pending' | 'active' | 'expired';

export interface Member {
  id: number;
  telegramUserId: number;
  status: MemberStatus;
  paymentRef: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Member lifecycle manager (MEM-1/2).
 * Handles payment success/failure, auto-expiry, and manual approval.
 */
export function activateMember(
  db: DatabaseSync,
  input: { telegramUserId: number; paymentRef: string; expiresAt: string },
): Member {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO members (telegram_user_id, status, payment_ref, expires_at, created_at, updated_at)
     VALUES (?, 'active', ?, ?, ?, ?)
     ON CONFLICT (telegram_user_id) DO UPDATE SET
       status = 'active',
       payment_ref = excluded.payment_ref,
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`,
  ).run(input.telegramUserId, input.paymentRef, input.expiresAt, now, now);

  return getMember(db, input.telegramUserId)!;
}

export function expireMember(db: DatabaseSync, telegramUserId: number): Member | null {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE members SET status = 'expired', updated_at = ? WHERE telegram_user_id = ? AND status = 'active'`,
  ).run(now, telegramUserId);
  return getMember(db, telegramUserId);
}

export function getMember(db: DatabaseSync, telegramUserId: number): Member | null {
  const row = db
    .prepare(
      'SELECT id, telegram_user_id, status, payment_ref, expires_at, created_at, updated_at FROM members WHERE telegram_user_id = ?',
    )
    .get(telegramUserId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: Number(row.id),
    telegramUserId: Number(row.telegram_user_id),
    status: row.status as MemberStatus,
    paymentRef: row.payment_ref === null ? null : String(row.payment_ref),
    expiresAt: row.expires_at === null ? null : String(row.expires_at),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Manual operator approve (MEM-2 fallback).
 * Sets member to active without payment — operator override.
 */
export function manualApprove(db: DatabaseSync, telegramUserId: number): Member {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  db.prepare(
    `INSERT INTO members (telegram_user_id, status, payment_ref, expires_at, created_at, updated_at)
     VALUES (?, 'active', 'manual', ?, ?, ?)
     ON CONFLICT (telegram_user_id) DO UPDATE SET
       status = 'active',
       payment_ref = 'manual',
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`,
  ).run(telegramUserId, expiresAt, now, now);

  return getMember(db, telegramUserId)!;
}

/**
 * Check all members and expire those past their expires_at.
 * Returns count of expired members.
 */
export function expireStaleMembers(db: DatabaseSync): number {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE members SET status = 'expired', updated_at = ? WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?`,
    )
    .run(now, now);
  return Number(result.changes);
}
