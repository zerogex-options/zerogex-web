import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The reactivation email ("I extended your ZeroGEX free trial to 30 days")
// goes out daily with no review. Its cohort query had no deleted_at filter,
// though every other cohort query has one and account deletion doubles as the
// marketing opt-out, so a member who signed up, verified and then deleted the
// account was offered a trial on an account they can no longer sign in to.

const hasSqliteCli = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' }).status === 0;
const needsCli = hasSqliteCli ? false : 'needs the sqlite3 CLI on PATH, as the script does';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-reactivation-deleted-'));
const dbPath = path.join(dir, 'auth.db');
process.env.AUTH_DB_PATH = dbPath;

const { getDb } = await import('../core/db.ts');
const db = getDb();

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

function seedUser(id: string, createdAt: string, deletedAt: string | null): void {
  db.prepare(
    `INSERT INTO users (id, email, password_hash, tier, created_at, updated_at, email_verified_at, deleted_at)
     VALUES (?, ?, 'x', 'public', ?, ?, ?, ?)`,
  ).run(id, `${id}@example.test`, createdAt, createdAt, createdAt, deletedAt);
}

seedUser('still_here', daysAgo(30), null);
seedUser('deleted_member', daysAgo(30), daysAgo(20));

const scriptsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');

test('reactivation never offers the trial to a deleted account', { skip: needsCli }, () => {
  const out = execFileSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', path.join(scriptsDir, 'send-reactivation.mts'), '--dry-run'],
    {
      cwd: dir,
      env: { ...process.env, AUTH_DB_PATH: dbPath, ZEROGEX_END_USER_TOKEN_SECRET: 'test-secret' },
      encoding: 'utf8',
    },
  );
  assert.match(out, /still_here@example\.test/, out);
  assert.ok(!out.includes('deleted_member@example.test'), out);
});
