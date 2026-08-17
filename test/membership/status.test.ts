import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../../src/store/db.ts';
import {
  activateMember,
  expireMember,
  getMember,
  manualApprove,
  expireStaleMembers,
} from '../../src/membership/status.ts';
import type { DatabaseSync } from 'node:sqlite';

describe('MEM-1: payment success/fail', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb();
  });

  it('activates member on successful payment', () => {
    const member = activateMember(db, {
      telegramUserId: 12345,
      paymentRef: 'stars_charge_001',
      expiresAt: '2026-09-15T00:00:00Z',
    });

    assert.equal(member.status, 'active');
    assert.equal(member.paymentRef, 'stars_charge_001');
    assert.equal(member.telegramUserId, 12345);
  });

  it('does not grant access before payment (no pre-payment access)', () => {
    const member = getMember(db, 99999);
    assert.equal(member, null);
  });

  it('upserts on duplicate telegram_user_id', () => {
    activateMember(db, { telegramUserId: 12345, paymentRef: 'ref_1', expiresAt: '2026-09-01T00:00:00Z' });
    activateMember(db, { telegramUserId: 12345, paymentRef: 'ref_2', expiresAt: '2026-10-01T00:00:00Z' });

    const member = getMember(db, 12345)!;
    assert.equal(member.paymentRef, 'ref_2');
    const rows = db.prepare('SELECT COUNT(*) as n FROM members').get() as { n: number };
    assert.equal(rows.n, 1, 'must not create duplicate');
  });
});

describe('MEM-2: auto + manual approve', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb();
  });

  it('expires active member', () => {
    activateMember(db, { telegramUserId: 12345, paymentRef: 'ref', expiresAt: '2026-09-01T00:00:00Z' });
    const member = expireMember(db, 12345)!;
    assert.equal(member.status, 'expired');
  });

  it('manualApprove sets member active without payment', () => {
    const member = manualApprove(db, 77777);
    assert.equal(member.status, 'active');
    assert.equal(member.paymentRef, 'manual');
    assert.ok(member.expiresAt);
  });

  it('expireStaleMembers expires members past their expires_at', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    db.prepare(
      `INSERT INTO members (telegram_user_id, status, payment_ref, expires_at) VALUES (?, 'active', 'ref', ?)`,
    ).run(111, past);
    db.prepare(
      `INSERT INTO members (telegram_user_id, status, payment_ref, expires_at) VALUES (?, 'active', 'ref', ?)`,
    ).run(222, '2099-01-01T00:00:00Z');

    const expired = expireStaleMembers(db);
    assert.equal(expired, 1);

    assert.equal(getMember(db, 111)!.status, 'expired');
    assert.equal(getMember(db, 222)!.status, 'active');
  });
});

describe('Member lifecycle', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb();
  });

  it('getMember returns null for unknown user', () => {
    assert.equal(getMember(db, 0), null);
  });

  it('getMember returns full member record', () => {
    activateMember(db, { telegramUserId: 12345, paymentRef: 'ref', expiresAt: '2026-09-01T00:00:00Z' });
    const m = getMember(db, 12345)!;
    assert.equal(m.id, 1);
    assert.equal(typeof m.createdAt, 'string');
    assert.equal(typeof m.updatedAt, 'string');
  });
});
