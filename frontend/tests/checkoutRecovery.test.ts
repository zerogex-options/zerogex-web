import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// scripts/send-checkout-recovery.mts, run with --dry-run against a throwaway
// database on the real schema. The nudge says "pick up where you left off", so
// it has to keep reaching everyone who never finished checkout, declined cards
// included, and never reach a member who did finish and has since lost the
// subscription. The 7-day money-back refund is the usual way that happens, and
// it leaves the users row looking exactly like an abandoned checkout.
//
// It is also a sales email, so it skips anyone who unsubscribed from marketing
// (users.marketing_unsubscribed_at) and carries a one-click unsubscribe. The
// timer sends it with YES=1 and nobody reviews the batch, so the last test runs
// a real send through the email-audit Resend stub.
//
// The script reads the database through the sqlite3 CLI, so this skips where
// that isn't installed.

const sqlite3Missing =
  spawnSync('sqlite3', ['-version'], { stdio: 'ignore' }).status !== 0 &&
  'needs the sqlite3 CLI, which the script shells out to';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-checkout-recovery-'));
const dbPath = path.join(dir, 'auth.db');
process.env.AUTH_DB_PATH = dbPath;
// Read at call time by the mailer and core/unsubToken.ts. Resend itself is
// never reached: every send below goes through a stub.
process.env.RESEND_API_KEY = 're_test_key';
process.env.RESEND_FROM_EMAIL = 'ZeroGEX <hello@zerogex.test>';
process.env.ZEROGEX_END_USER_TOKEN_SECRET = 'test-secret';

// Dynamic import: core/db.ts reads AUTH_DB_PATH at module load, so the
// assignment above has to land first. A static import would be hoisted past it.
const { getDb } = await import('../core/db.ts');
const { sendCheckoutRecoveryEmail } = await import('../core/mailer.ts');
const { verifyUnsubToken } = await import('../core/unsubToken.ts');
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

// Opened checkout and left, three days after unsubscribing from a marketing
// email.
const optedOut = member('opted-out@example.com');
db.prepare('UPDATE users SET marketing_unsubscribed_at = ? WHERE id = ?').run(hoursAgo(120), optedOut);
started(optedOut, hoursAgo(48));

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

test('someone who unsubscribed from marketing is skipped, and named on a dry run', { skip: sqlite3Missing }, () => {
  assert.equal(listedUnder('Eligible users:').has('opted-out@example.com'), false);
  assert.equal(
    listedUnder('Unsubscribed:').get('opted-out@example.com'),
    `started ${hoursAgo(48)}, unsubscribed ${hoursAgo(120)}`,
  );
});

test('the dry run counts all three groups', { skip: sqlite3Missing }, () => {
  assert.match(stdout, /^Checked out: +2 \(/m);
  assert.match(stdout, /^Unsubscribed: +1 \(/m);
  assert.match(stdout, /^Eligible users: +3$/m);
  assert.equal(listedUnder('Checked out:').size, 2);
  assert.equal(listedUnder('Unsubscribed:').size, 1);
  assert.equal(listedUnder('Eligible users:').size, 3);
});

type SentEmail = { to: string | string[]; subject: string; text: string; html: string; headers?: Record<string, string> };

const UNSUB = 'https://zerogex.test/unsubscribe?u=user_x&t=token';

// Same technique as tests/welcomeEmailApiKey.test.ts: stub the Resend SDK's
// fetch and read the payload that would have gone on the wire.
async function capture(send: () => Promise<void>): Promise<SentEmail> {
  const realFetch = globalThis.fetch;
  let sent: SentEmail | null = null;
  globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
    sent = JSON.parse(String(init?.body ?? '{}')) as SentEmail;
    return new Response(JSON.stringify({ id: 'email_test' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
  try {
    await send();
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.ok(sent, 'expected the mailer to issue a send request');
  return sent;
}

test('every variant carries the unsubscribe link and the one-click headers', async () => {
  const variants = {
    plain: { foundingDeadlineLabel: null },
    founding: { foundingDeadlineLabel: 'October 1, 2026' },
    promo: {
      foundingDeadlineLabel: null,
      promoDeadlineLabel: 'October 1, 2026',
      promoPricing: { basicMonthly: '$29.00', proMonthly: '$49.00' },
    },
  };
  for (const [name, variant] of Object.entries(variants)) {
    const sent = await capture(() => sendCheckoutRecoveryEmail('member@zerogex.test', { ...variant, unsubUrl: UNSUB }));

    assert.deepEqual(
      sent.headers,
      { 'List-Unsubscribe': `<${UNSUB}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      name,
    );
    assert.match(
      sent.text,
      /^You're receiving this because you created a ZeroGEX account\. Unsubscribe from emails like this:\nhttps:\/\/zerogex\.test\/unsubscribe\?u=user_x&t=token$/m,
      name,
    );
    assert.match(
      sent.html,
      /<a href="https:\/\/zerogex\.test\/unsubscribe\?u=user_x&amp;t=token"[^>]*>Unsubscribe from emails like this<\/a>/,
      name,
    );
  }
});

// Last on purpose: a real send stamps the latch, and the dry-run tests above
// read output captured before any of this ran.
test('a real send mails each eligible member their own unsubscribe link, and never the opted-out one', { skip: sqlite3Missing }, () => {
  const capturePath = path.join(dir, 'sent.ndjson');
  const stub = pathToFileURL(fileURLToPath(new URL('../scripts/email-audit/stub-resend.mts', import.meta.url))).href;
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', `--import=${stub}`, script, '--yes'], {
    cwd: dir,
    env: {
      PATH: process.env.PATH ?? '',
      AUTH_DB_PATH: dbPath,
      NODE_ENV: 'test',
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM_EMAIL: 'ZeroGEX <hello@zerogex.test>',
      NEXT_PUBLIC_APP_URL: 'https://zerogex.test',
      ZEROGEX_END_USER_TOKEN_SECRET: 'test-secret',
      CAPTURE_OUT: capturePath,
    },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);

  const sent = fs.readFileSync(capturePath, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as SentEmail);
  const idOf = (email: string) => (db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string }).id;
  assert.deepEqual(sent.map((e) => [e.to].flat().join()).sort(), [
    'abandoned@example.com',
    'came-back@example.com',
    'declined@example.com',
  ]);
  for (const email of sent) {
    const to = [email.to].flat().join();
    const link = new URL(String(email.headers?.['List-Unsubscribe']).slice(1, -1));
    assert.equal(link.origin + link.pathname, 'https://zerogex.test/unsubscribe', to);
    assert.equal(link.searchParams.get('u'), idOf(to), to);
    assert.ok(verifyUnsubToken(idOf(to), link.searchParams.get('t') ?? ''), `${to}: the /unsubscribe route accepts the token`);
    assert.ok(email.text.includes(link.href), `${to}: the footer carries the same link`);
  }

  const stamped = db
    .prepare('SELECT checkout_recovery_email_sent_at AS at FROM users WHERE email = ?')
    .get('opted-out@example.com') as { at: string | null };
  assert.equal(stamped.at, null, 'skipping a member must not mark them as sent');
});
