import type { TestContext } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';

// What the busy-database tests share: a copy of the real auth schema per test,
// a second process that holds the database's write lock the way the live site
// does, and a real run of a script with Resend replaced by the email-audit stub
// and Stripe and the ZeroGEX backend by ./stub-http.mts.
//
// Also the means to make a script's record step fail on purpose (a trigger
// that rejects one kind of write), so a test can check what the script says,
// what it leaves behind, and that the command it prints to finish by hand
// works when run as printed.

export const sqlite3Missing =
  spawnSync('sqlite3', ['-version'], { stdio: 'ignore' }).status !== 0 &&
  'needs the sqlite3 CLI, which the scripts shell out to';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const NOW_MS = Date.now();
// An ISO timestamp `ms` from now: negative is the past.
export const at = (ms: number) => new Date(NOW_MS + ms).toISOString();

export const scriptsDir = fileURLToPath(new URL('../../scripts/', import.meta.url));
export const REPO = fileURLToPath(new URL('../../../', import.meta.url));

const preloads = [
  new URL('../../scripts/email-audit/stub-resend.mts', import.meta.url),
  new URL('./stub-http.mts', import.meta.url),
].map((url) => `--import=${pathToFileURL(fileURLToPath(url)).href}`);

export type Fixture = { dbPath: string; db: DatabaseSync; capturePath: string; httpLogPath: string };

export type RunOptions = {
  // Extra environment, on top of what every send needs.
  env?: Record<string, string>;
  // stub-http.mts routes: "<METHOD> <host><path>" -> the JSON to answer with.
  routes?: Record<string, unknown>;
};

// Builds the schema once per test file (core/db.ts reads AUTH_DB_PATH when it
// loads, so it is imported only after the path is set) and returns the helpers
// bound to it.
export async function createBusyDb(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `zgx-${prefix}-`));
  process.env.AUTH_DB_PATH = path.join(dir, 'schema.db');
  const { getDb } = await import('../../core/db.ts');
  const schemaDb = getDb();

  // A fresh copy of the schema for one test, opened the way the site opens it.
  function fixture(t: TestContext, name: string): Fixture {
    const dbPath = path.join(dir, `${name}.db`);
    schemaDb.exec(`VACUUM INTO '${dbPath}'`);
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
    t.after(() => db.close());
    return {
      dbPath,
      db,
      capturePath: path.join(dir, `${name}.sent.ndjson`),
      httpLogPath: path.join(dir, `${name}.http.ndjson`),
    };
  }

  let seq = 0;

  // A verified member who joined 30 days ago, plus whatever `columns` sets.
  function member(f: Fixture, email: string, columns: Record<string, string | number | null> = {}): string {
    const id = `user_${++seq}`;
    const joined = at(-30 * DAY);
    f.db
      .prepare(
        `INSERT INTO users (id, email, tier, created_at, updated_at, email_verified_at)
         VALUES (?, ?, 'public', ?, ?, ?)`,
      )
      .run(id, email, joined, joined, joined);
    for (const [column, value] of Object.entries(columns)) {
      f.db.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).run(value, id);
    }
    return id;
  }

  function audit(f: Fixture, userId: string, type: string, createdAt: string, message: string): void {
    f.db
      .prepare(
        `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
         VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?)`,
      )
      .run(`audit_seed_${++seq}`, type, userId, message, createdAt);
  }

  // A real run of `script` against this test's copy, the way it is run for real.
  function run(f: Fixture, script: string, args: string[], opts: RunOptions = {}) {
    return spawnSync(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings', ...preloads, path.join(scriptsDir, script), ...args],
      {
        // No .env.local in the temp dir and a bare environment, so a run sees
        // only this database and these stubs.
        cwd: dir,
        env: {
          PATH: process.env.PATH ?? '',
          AUTH_DB_PATH: f.dbPath,
          NODE_ENV: 'test',
          RESEND_API_KEY: 're_test_key',
          RESEND_FROM_EMAIL: 'ZeroGEX <hello@zerogex.test>',
          NEXT_PUBLIC_APP_URL: 'https://zerogex.test',
          ZEROGEX_END_USER_TOKEN_SECRET: 'test-secret',
          CAPTURE_OUT: f.capturePath,
          STUB_HTTP_ROUTES: JSON.stringify(opts.routes ?? {}),
          STUB_HTTP_LOG: f.httpLogPath,
          ...opts.env,
        },
        encoding: 'utf8',
      },
    );
  }

  // The run under test. The lock is taken before the script starts and held
  // well past its start-up and its first write, so that write has to wait.
  async function runWhileLocked(f: Fixture, script: string, args: string[], opts: RunOptions = {}) {
    const lock = await holdWriteLock(f.dbPath, 3000);
    const result = run(f, script, args, opts);
    await lock.released;
    return result;
  }

  return { dir, fixture, member, audit, run, runWhileLocked };
}

export function column(f: Fixture, userId: string, name: string): string | number | null {
  const row = f.db.prepare(`SELECT ${name} AS value FROM users WHERE id = ?`).get(userId) as {
    value: string | number | null;
  };
  return row.value;
}

export function auditCount(f: Fixture, type: string, userId: string | null): number {
  const row = f.db
    .prepare('SELECT COUNT(*) AS n FROM audit_events WHERE type = ? AND user_id IS ?')
    .get(type, userId) as { n: number };
  return row.n;
}

// Who the run(s) emailed, in order, from the email-audit stub's capture.
export function sentTo(f: Fixture): string[] {
  if (!fs.existsSync(f.capturePath)) return [];
  return fs
    .readFileSync(f.capturePath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => [(JSON.parse(line) as { to: string | string[] }).to].flat().join());
}

// The requests stub-http.mts answered, in order.
export function httpCalls(f: Fixture): Array<{ method: string; url: string; body: string | null }> {
  if (!fs.existsSync(f.httpLogPath)) return [];
  return fs
    .readFileSync(f.httpLogPath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { method: string; url: string; body: string | null });
}

// Plays the live site, which writes to the database whenever a member is
// active: takes the write lock from another process and holds it for `ms`.
// Resolves once the lock is held; `released` settles when it lets go.
export async function holdWriteLock(dbPath: string, ms: number): Promise<{ released: Promise<void> }> {
  const holder = spawn(
    process.execPath,
    [
      '--no-warnings',
      '--input-type=module',
      '-e',
      `import { DatabaseSync } from 'node:sqlite';
       const db = new DatabaseSync(process.env.AUTH_DB_PATH);
       db.exec('BEGIN IMMEDIATE');
       console.log('held');
       setTimeout(() => { db.exec('COMMIT'); db.close(); }, ${ms});`,
    ],
    { env: { PATH: process.env.PATH ?? '', AUTH_DB_PATH: dbPath, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const released = new Promise<void>((resolve, reject) => {
    holder.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`lock holder exited with ${code}`))));
  });
  await new Promise<void>((resolve, reject) => {
    holder.stdout.on('data', (chunk) => {
      if (String(chunk).includes('held')) resolve();
    });
    released.then(() => reject(new Error('lock holder exited before taking the lock')), reject);
  });
  return { released };
}

let blocks = 0;

// Makes one kind of write fail from now on, the way a record step that still
// cannot write fails: every `op` on `table`, or only the rows `when` matches
// (an SQL condition on NEW or OLD, e.g. "NEW.type = 'member_comped'"). Until
// unblockWrites, the test's own seeding of that table fails too.
export function blockWrites(f: Fixture, op: 'INSERT' | 'UPDATE' | 'DELETE', table: string, when?: string): void {
  f.db.exec(
    `CREATE TRIGGER zgx_block_${++blocks} BEFORE ${op} ON ${table}${when ? ` WHEN ${when}` : ''}
     BEGIN SELECT RAISE(ABORT, 'write blocked by the test'); END;`,
  );
}

export function unblockWrites(f: Fixture): void {
  const triggers = f.db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'zgx_block_%'")
    .all() as Array<{ name: string }>;
  for (const { name } of triggers) f.db.exec(`DROP TRIGGER ${name};`);
}

// The command a script printed for finishing by hand: from its `sqlite3 ` line
// through the closing `SQL` of the heredoc, or that one line when there is no
// heredoc. Null when it printed none.
export function printedCommand(output: string): string | null {
  const lines = output.split('\n');
  const from = lines.findIndex((line) => line.trimStart().startsWith('sqlite3 '));
  if (from === -1) return null;
  const first = lines[from].trimStart();
  if (!first.includes("<<'SQL'")) return first;
  const to = lines.findIndex((line, i) => i > from && line === 'SQL');
  return to === -1 ? null : [first, ...lines.slice(from + 1, to + 1)].join('\n');
}

// Runs a printed command exactly as printed, the way the operator would paste it.
export function runPrinted(command: string) {
  return spawnSync('bash', ['-c', command], { encoding: 'utf8' });
}
