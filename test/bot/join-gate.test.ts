import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../../src/store/db.ts';
import { handleJoinRequest, createMemberChecker, type MemberChecker } from '../../src/bot/join-gate.ts';
import type { DatabaseSync } from 'node:sqlite';

describe('TGB-3: join gate', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb();
  });

  it('approves active members', () => {
    db.prepare('INSERT INTO members (telegram_user_id, status) VALUES (?, ?)').run(12345, 'active');
    const checker = createMemberChecker(db);

    const result = handleJoinRequest(db, 12345, checker);
    assert.equal(result.action, 'approved');
  });

  it('declines non-members', () => {
    const checker = createMemberChecker(db);
    const result = handleJoinRequest(db, 99999, checker);
    assert.equal(result.action, 'declined');
    assert.ok(result.reason.includes('Membership required'));
  });

  it('declines pending members (not yet paid)', () => {
    db.prepare('INSERT INTO members (telegram_user_id, status) VALUES (?, ?)').run(12345, 'pending');
    const checker = createMemberChecker(db);

    const result = handleJoinRequest(db, 12345, checker);
    assert.equal(result.action, 'declined');
  });

  it('declines expired members', () => {
    db.prepare('INSERT INTO members (telegram_user_id, status) VALUES (?, ?)').run(12345, 'expired');
    const checker = createMemberChecker(db);

    const result = handleJoinRequest(db, 12345, checker);
    assert.equal(result.action, 'declined');
  });

  it('memberChecker correctly identifies active status', () => {
    db.prepare('INSERT INTO members (telegram_user_id, status) VALUES (?, ?)').run(111, 'active');
    db.prepare('INSERT INTO members (telegram_user_id, status) VALUES (?, ?)').run(222, 'pending');
    db.prepare('INSERT INTO members (telegram_user_id, status) VALUES (?, ?)').run(333, 'expired');

    const checker = createMemberChecker(db);
    assert.equal(checker.isActiveMember(111), true);
    assert.equal(checker.isActiveMember(222), false);
    assert.equal(checker.isActiveMember(333), false);
    assert.equal(checker.isActiveMember(444), false);
  });
});
