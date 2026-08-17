import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = dirname(fileURLToPath(import.meta.url));

/** Schema is additive-only and applied idempotently on every open. */
const SCHEMA_SQL = readFileSync(join(here, 'schema.sql'), 'utf8');

export interface OpenDbOptions {
  /** SQLite filename; ':memory:' (default) for tests and ephemeral stores. */
  filename?: string;
}

/**
 * Open a SQLite database with the platform schema applied.
 * Tests use the default in-memory database; runtime callers pass a file path.
 */
export function openDb({ filename = ':memory:' }: OpenDbOptions = {}): DatabaseSync {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_SQL);
  return db;
}
