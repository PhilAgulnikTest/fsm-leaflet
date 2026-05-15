/* Database wrapper around the built-in node:sqlite module (Node 22.5+).
 *
 * The exported `db` exposes the small subset of better-sqlite3-style API that
 * the rest of the codebase actually uses: exec, prepare, transaction, pragma.
 * Using node:sqlite avoids the native-build pain of better-sqlite3 on Windows
 * (node-gyp + Python toolchain) while keeping the synchronous API style. */

import { DatabaseSync, type StatementSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

const raw = new DatabaseSync(config.databasePath);
raw.exec(`PRAGMA journal_mode = WAL`);
raw.exec(`PRAGMA foreign_keys = ON`);

type RunInfo = { changes: number; lastInsertRowid: number | bigint };

interface PreparedStatement {
  run(...params: unknown[]): RunInfo;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

function prepare(sql: string): PreparedStatement {
  const stmt: StatementSync = raw.prepare(sql);
  return {
    run: (...params) => stmt.run(...(params as never[])) as unknown as RunInfo,
    get: (...params) => stmt.get(...(params as never[])),
    all: (...params) => stmt.all(...(params as never[])) as unknown[],
  };
}

function transaction<T extends (...args: any[]) => any>(fn: T): T {
  return (((...args: Parameters<T>): ReturnType<T> => {
    raw.exec('BEGIN');
    try {
      const out = fn(...args);
      raw.exec('COMMIT');
      return out;
    } catch (e) {
      raw.exec('ROLLBACK');
      throw e;
    }
  }) as unknown) as T;
}

export const db = {
  exec: (sql: string) => raw.exec(sql),
  prepare,
  transaction,
  /** Convenience for SQL helpers that expect a no-op object. */
  raw,
};
