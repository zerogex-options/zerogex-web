import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// scripts/send-verified-never-paid.mts against a throwaway database on the real
// schema, and the email it sends. The nudge pitches the free trial to a verified
// signup who never opened checkout, so it is a sales email: it skips anyone who
// unsubscribed from marketing (users.marketing_unsubscribed_at) and carries a
// one-click unsubscribe. The timer sends it with YES=1 every two hours and
// nobody reviews the batch, so a real send runs here too, through the
// email-audit Resend stub.
//
// The script reads the database through the sqlite3 CLI, so the tests that run
// it skip where that isn't installed.

const sqlite3Missing =
  spawnSync('sqlite3', ['-version'], { stdio: 'ignore' }).status !== 0 &&
  'needs the sqlite3 CLI, which the script shells out to';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-verified-never-paid-'));
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
const { sendVerifiedNeverPaidEmail } = await import('../core/mailer.ts');
const { verifyUnsubToken } = await import('../core/unsubToken.ts');
const db = getDb();

const HOUR = 3_600_000;
const NOW_MS = Date.now();
const hoursAgo = (hours: number) => new Date(NOW_MS - hours * HOUR).toISOString();

let seq = 0;

function signup(email: string, signedUpHoursAgo: number, unsubscribedHoursAgo: number | null = null): void {
  const at = hoursAgo(signedUpHoursAgo);
  db.prepare(
    `INSERT INTO users (id, email, tier, created_at, updated_at, email_verified_at, marketing_unsubscribed_at)
     VALUES (?, ?, 'public', ?, ?, ?, ?)`,
  ).run(`user_${++seq}`, email, at, at, at, unsubscribedHoursAgo == null ? null : hoursAgo(unsubscribedHoursAgo));
}

// Signed up first, then unsubscribed from a marketing email. Oldest in the
// window, so a capped batch would reach them before anyone else.
signup('opted-out@example.com', 6, 4);
// Verified signups who never opened checkout.
signup('fresh@example.com', 5);
signup('fresher@example.com', 3);

const script = fileURLToPath(new URL('../scripts/send-verified-never-paid.mts', import.meta.url));

function dryRun(args: string[] = []): string {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', script, '--dry-run', ...args], {
    // No .env.local in the temp dir and a bare environment, so the run sees
    // only this database.
    cwd: dir,
    env: { PATH: process.env.PATH ?? '', AUTH_DB_PATH: dbPath, NODE_ENV: 'test' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

// The "  - <email>: ..." lines printed under the line starting with `heading`,
// keyed by email.
function listedUnder(stdout: string, heading: string): Map<string, string> {
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

test('someone who unsubscribed from marketing is skipped, and named on a dry run', { skip: sqlite3Missing }, () => {
  const stdout = dryRun();

  assert.match(stdout, /^Unsubscribed: +1 \(/m);
  assert.equal(
    listedUnder(stdout, 'Unsubscribed:').get('opted-out@example.com'),
    `signed up ${hoursAgo(6)}, unsubscribed ${hoursAgo(4)}`,
  );
  assert.match(stdout, /^Eligible users: +2$/m);
  assert.deepEqual([...listedUnder(stdout, 'Eligible users:').keys()], ['fresh@example.com', 'fresher@example.com']);
});

test('an opted-out signup never takes a slot in a capped batch', { skip: sqlite3Missing }, () => {
  // They signed up first, so a cap applied before the opt-out check would hand
  // them the one slot on every run, and nobody would ever be sent anything.
  const stdout = dryRun(['--limit', '1']);

  assert.deepEqual([...listedUnder(stdout, 'This batch:').keys()], ['fresh@example.com']);
});

type SentEmail = { to: string | string[]; subject: string; text: string; html: string; headers?: Record<string, string> };

const UNSUB = 'https://zerogex.test/unsubscribe?u=user_x&t=token';

test('the email carries the unsubscribe link and the one-click headers', async () => {
  // Same technique as tests/welcomeEmailApiKey.test.ts: stub the Resend SDK's
  // fetch and read the payload that would have gone on the wire.
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
    await sendVerifiedNeverPaidEmail('member@zerogex.test', { unsubUrl: UNSUB });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.ok(sent, 'expected the mailer to issue a send request');
  const email = sent as SentEmail;

  assert.deepEqual(email.headers, {
    'List-Unsubscribe': `<${UNSUB}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  });
  assert.match(
    email.text,
    /^You're receiving this because you created a ZeroGEX account\. Unsubscribe from emails like this:\nhttps:\/\/zerogex\.test\/unsubscribe\?u=user_x&t=token$/m,
  );
  assert.match(
    email.html,
    /<a href="https:\/\/zerogex\.test\/unsubscribe\?u=user_x&amp;t=token"[^>]*>Unsubscribe from emails like this<\/a>/,
  );
  // The pitch itself is unchanged.
  assert.equal(email.subject, 'Quick note from Michael at ZeroGEX');
  assert.match(email.text, /\/pricing\?trial=1/);
});

// Last on purpose: a real send stamps the latch the dry runs above depend on.
test('a real send mails each eligible signup their own unsubscribe link, and never the opted-out one', { skip: sqlite3Missing }, () => {
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
  assert.deepEqual(sent.map((e) => [e.to].flat().join()).sort(), ['fresh@example.com', 'fresher@example.com']);
  for (const email of sent) {
    const to = [email.to].flat().join();
    const link = new URL(String(email.headers?.['List-Unsubscribe']).slice(1, -1));
    assert.equal(link.origin + link.pathname, 'https://zerogex.test/unsubscribe', to);
    assert.equal(link.searchParams.get('u'), idOf(to), to);
    assert.ok(verifyUnsubToken(idOf(to), link.searchParams.get('t') ?? ''), `${to}: the /unsubscribe route accepts the token`);
    assert.ok(email.text.includes(link.href), `${to}: the footer carries the same link`);
  }

  const stamped = db
    .prepare('SELECT verified_never_paid_email_sent_at AS at FROM users WHERE email = ?')
    .get('opted-out@example.com') as { at: string | null };
  assert.equal(stamped.at, null, 'skipping a member must not mark them as sent');
});
