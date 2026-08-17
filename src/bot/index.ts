import type { DatabaseSync } from 'node:sqlite';
import { handleCommand, type CommandResult } from './commands.ts';
import { handleJoinRequest, createMemberChecker, type JoinGateResult } from './join-gate.ts';

export { handleCommand, type CommandResult } from './commands.ts';
export { handleJoinRequest, createMemberChecker, type JoinGateResult, type MemberChecker } from './join-gate.ts';

/**
 * Bot application — thin facade over commands + join-gate.
 * Framework-agnostic: callers wire this to grammY or any other bot framework.
 */
export class MzlloBot {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  /** Handle an incoming bot command. Returns text to send. */
  onCommand(command: string, args: string[]): CommandResult {
    return handleCommand(this.db, command, args);
  }

  /** Handle a chat_join_request event. Returns action to take. */
  onJoinRequest(telegramUserId: number): JoinGateResult {
    const checker = createMemberChecker(this.db);
    return handleJoinRequest(this.db, telegramUserId, checker);
  }
}
