import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// scripts/send-checkout-recovery.mts, run with --dry-run against a throwaway
// database on the real schema. The nudge says "pick up where you left off", so
// it has to keep reaching everyone who never finished checkout, declined cards
// included, and never reach a member who did finish and has since lost the
// subscription. The 7-day money-back refund is the usual way that happens, and
// it leaves the users row looking exactly like an abandoned checkout.
//
// The script reads the database through the sqlite3 CLI, so this skips where
// that isn't installed.

const sqlite3Missing =
  spawnSync('sqlite3', ['-version'], { stdio: 'ignore' }).status !== 0 &&
  'needs the sqlite3 CLI, which the script shells out to';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-checkout-recovery-'));
const dbPath = path.join(dir, 'auth.db');
process.env.AUTH_DB_PATH = dbPath;

// Dynamic import: core/db.ts reads AUTH_DB_PATH at module load, so the
// assignment above has to land first. A static import would be hoisted past it.
const { getDb } = await import('../core/db.ts');
const db = getDb();

const HOUR = 3_600_000;
const NOW_MS = Date.now();
const hoursAgo = (hours: number) => new Date(NOW_MS - hours * HOUR).toISOString();

let seq = 0;

function member(email: string): string {
  const id = `user_${++seq}`;
  const joined = hoursAgo(24 * 30);
  db.prepare(
    `INSERT INTO users (id, email, tier, created_at, updated_at, email_verified_at)
     VALUES (?, ?, 'public', ?, ?, ?)`,
  ).run(id, email, joined, joined, joined);
  return id;
}

function audit(userId: string, type: string, at: string, message: string) {
  db.prepare(
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?)`,
  ).run(`audit_${++seq}`, type, userId, message, at);
}

// The rows app/api/billing/checkout and the Stripe webhook write.
const started = (userId: string, at: string) =>
  audit(userId, 'billing_checkout_started', at, 'tier=pro cadence=quarterly');
const synced = (userId: string, at: string, sub: string, status: string, tier: string) =>
  audit(userId, 'stripe_subscription_sync', at, `Subscription ${sub} status=${status} tier=${tier} cancelAtPeriodEnd=false`);
const firstPayment = (userId: string, at: string, sub: string) =>
  audit(userId, 'stripe_first_payment', at, `First payment cleared on sub ${sub} (invoice in_1, 11500 usd)`);
const ended = (userId: string, at: string, sub: string) =>
  audit(userId, 'stripe_subscription_deleted', at, `Subscription ${sub} ended; tier reset to public`);

// Paid at checkout, then took the money-back refund the next day.
const refunded = member('refunded@example.com');
started(refunded, hoursAgo(48));
synced(refunded, hoursAgo(47.9), 'sub_refunded', 'active', 'pro');
firstPayment(refunded, hoursAgo(47.9), 'sub_refunded');
ended(refunded, hoursAgo(27), 'sub_refunded');

// Started a trial at checkout and canceled it. Nothing was charged, so there is
// no stripe_first_payment and the subscription sync has to carry it alone.
const trialCanceled = member('trial-canceled@example.com');
started(trialCanceled, hoursAgo(72));
synced(trialCanceled, hoursAgo(71.9), 'sub_trial', 'trialing', 'pro');
ended(trialCanceled, hoursAgo(50), 'sub_trial');

// Opened checkout and left.
const abandoned = member('abandoned@example.com');
started(abandoned, hoursAgo(48));

// Card declined at checkout. Stripe still creates the subscription, as
// incomplete, and the webhook syncs it before releasing it a day later.
const declined = member('declined@example.com');
started(declined, hoursAgo(48));
synced(declined, hoursAgo(47.9), 'sub_declined', 'incomplete', 'public');
audit(
  declined,
  'stripe_subscription_unstarted_released',
  hoursAgo(25),
  'Subscription sub_declined expired before its first payment; released so the member can check out again',
);

// Refunded an earlier checkout, came back, and abandoned the new one.
const cameBack = member('came-back@example.com');
started(cameBack, hoursAgo(150));
synced(cameBack, hoursAgo(149.9), 'sub_first', 'active', 'pro');
firstPayment(cameBack, hoursAgo(149.9), 'sub_first');
ended(cameBack, hoursAgo(130), 'sub_first');
started(cameBack, hoursAgo(30));

const script = fileURLToPath(new URL('../scripts/send-checkout-recovery.mts', import.meta.url));

function dryRun(): string {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', script, '--dry-run'], {
    // The script reads .env.local from its working directory, and a real one
    // could switch on the promo copy and its live Stripe price lookup. The bare
    // environment is for the same reason.
    cwd: dir,
    env: { PATH: process.env.PATH ?? '', AUTH_DB_PATH: dbPath, NODE_ENV: 'test' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

const stdout = sqlite3Missing ? '' : dryRun();

// The "  - <email>: ..." lines printed under the line starting with `heading`,
// keyed by email.
function listedUnder(heading: string): Map<string, string> {
  const lines = stdout.split('\n');
  const at = lines.findIndex((line) => line.startsWith(heading));
  assert.notEqual(at, -1, `no "${heading}" line in:\n${stdout}`);
  const listed = new Map<string, string>();
  for (const line of lines.slice(at + 1)) {
    const m = /^ {2}- ([^:]+): (.*)$/.exec(line);
    if (!m) break;
    listed.set(m[1], m[2]);
  }
  return listed;
}

test('a member who checked out and then took the money-back refund is not nudged', { skip: sqlite3Missing }, () => {
  assert.equal(listedUnder('Eligible users:').has('refunded@example.com'), false);
  assert.equal(
    listedUnder('Checked out:').get('refunded@example.com'),
    `started ${hoursAgo(48)}, subscription last seen ${hoursAgo(47.9)}`,
  );
});

test('a trial canceled after checkout counts as checked out too', { skip: sqlite3Missing }, () => {
  assert.equal(listedUnder('Eligible users:').has('trial-canceled@example.com'), false);
  assert.equal(
    listedUnder('Checked out:').get('trial-canceled@example.com'),
    `started ${hoursAgo(72)}, subscription last seen ${hoursAgo(71.9)}`,
  );
});

test('someone who never finished checkout is still nudged', { skip: sqlite3Missing }, () => {
  assert.equal(
    listedUnder('Eligible users:').get('abandoned@example.com'),
    `started ${hoursAgo(48)} (variant: generic)`,
  );
});

test('a declined card is not a finished checkout', { skip: sqlite3Missing }, () => {
  assert.equal(
    listedUnder('Eligible users:').get('declined@example.com'),
    `started ${hoursAgo(48)} (variant: generic)`,
  );
  assert.equal(listedUnder('Checked out:').has('declined@example.com'), false);
});

test('a member who comes back after a refund and abandons again is nudged for the new attempt', { skip: sqlite3Missing }, () => {
  assert.equal(
    listedUnder('Eligible users:').get('came-back@example.com'),
    `started ${hoursAgo(30)} (variant: generic)`,
  );
  assert.equal(listedUnder('Checked out:').has('came-back@example.com'), false);
});

test('the dry run counts both groups', { skip: sqlite3Missing }, () => {
  assert.match(stdout, /^Checked out: +2 \(/m);
  assert.match(stdout, /^Eligible users: +3$/m);
  assert.equal(listedUnder('Checked out:').size, 2);
  assert.equal(listedUnder('Eligible users:').size, 3);
});
