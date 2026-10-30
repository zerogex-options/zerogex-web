import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The lapsed-member emails (win-back, return-intent, reactivation, the
// cancel-reason follow-up and the product-update campaign's cancelled audience)
// must never reach an account core/excludedAccounts.ts holds out: the admin, a
// creator partner on a free Pro grant, or a comped member. Each script picks
// its cohort in SQL through the sqlite3 CLI, so this
// runs the real scripts with --dry-run against a seeded DB and reads what they
// say they would do. A leak here does not throw. It emails a partner a discount
// to come back.
//
// Nor may they reach a member who unsubscribed from marketing
// (users.marketing_unsubscribed_at). All of them are promotional, and the
// win-back is a discount offer: a leak there sends a discount pitch to someone
// who asked for no more of them.

const hasSqliteCli = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' }).status === 0;
const needsCli = hasSqliteCli ? false : 'needs the sqlite3 CLI on PATH, as the scripts do';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-lapsed-mail-'));
const dbPath = path.join(dir, 'auth.db');
process.env.AUTH_DB_PATH = dbPath;

// core/db.ts reads AUTH_DB_PATH at module load, so the assignment has to land
// before the import does. getDb() builds the full production schema.
const { getDb } = await import('../core/db.ts');
const db = getDb();

const DAY_MS = 86_400_000;
const now = Date.now();
const daysAgo = (days: number) => new Date(now - days * DAY_MS).toISOString();

let auditSeq = 0;
function audit(type: string, iso: string, message: string, userId: string): void {
  db.prepare(
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?)`,
  ).run(`audit_${auditSeq++}`, type, userId, message, iso);
}

function seedUser(id: string, createdAt: string, columns: Record<string, string | number | null>): void {
  db.prepare(
    `INSERT INTO users (id, email, password_hash, tier, created_at, updated_at, email_verified_at)
     VALUES (?, ?, 'x', ?, ?, ?, ?)`,
  ).run(id, `${id}@example.test`, String(columns.tier ?? 'public'), createdAt, createdAt, createdAt);
  for (const [column, value] of Object.entries(columns)) {
    if (column === 'tier') continue;
    db.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).run(value, id);
  }
}

// ---------------------------------------------------------------------------
// The churned book. Every account here asked to cancel 41 days ago ("too
// expensive"), lost access 40 days ago, and logged back in 3 days ago, which
// puts each one inside the win-back window (30+ days since leaving), the
// return-intent window (a visit 24h to 14d old) and, with --days 60, the
// cancel-reason window. Only the customer should be written to.
// ---------------------------------------------------------------------------

function churnedMember(id: string, columns: Record<string, string | number | null>): void {
  seedUser(id, daysAgo(200), { subscription_lapsed: 1, first_payment_at: daysAgo(190), ...columns });
  audit('stripe_cancellation_requested', daysAgo(41), `Cancellation requested for sub_${id} cancel_feedback=too_expensive`, id);
  audit('stripe_subscription_deleted', daysAgo(40), `Subscription sub_${id} deleted`, id);
  audit('login_success', daysAgo(3), 'Login', id);
}

churnedMember('customer', { tier: 'public' });
// Paid, left, then set up as a creator partner. grant-partner-pro leaves
// subscription_lapsed = 1, which is how a partner lands in the churned book.
churnedMember('partner', {
  tier: 'pro',
  partner_tier: 'creator',
  partner_pro_grant_expires_at: new Date(now + 85 * DAY_MS).toISOString(),
});
// expire-partner-grants puts the tier back to public and keeps the partner.
churnedMember('expired_partner', {
  tier: 'public',
  partner_tier: 'creator',
  partner_pro_grant_expires_at: daysAgo(10),
});
// comp-member cancels the paid subscription, then writes the comped tier.
churnedMember('comped', { tier: 'pro' });
audit('billing_member_comped', daysAgo(39), 'Comped onto pro', 'comped');
churnedMember('admin', { tier: 'admin' });
// A customer like the first, except they clicked Unsubscribe on a marketing
// email two days ago. Nothing in core/excludedAccounts.ts holds them out, so
// the opt-out is the only thing keeping them from the win-back's discount.
churnedMember('opted_out', { tier: 'public', marketing_unsubscribed_at: daysAgo(2) });

const HELD_OUT = ['partner', 'expired_partner', 'comped', 'admin'];

// ---------------------------------------------------------------------------
// The verified-never-paid backlog the reactivation email works through. The
// partner never paid and their grant has run out, so they read as a cold
// public-tier signup. They also signed up first, so a capped batch reaches
// them before anyone else.
// ---------------------------------------------------------------------------

seedUser('idle_partner', daysAgo(100), {
  tier: 'public',
  partner_tier: 'creator',
  partner_pro_grant_expires_at: daysAgo(5),
});
seedUser('prospect', daysAgo(30), { tier: 'public' });

// ---------------------------------------------------------------------------

const scriptsDir = fileURLToPath(new URL('../scripts/', import.meta.url));

// send-product-update.mts reads its templates from ../docs/newsletters, relative
// to where it runs, so it runs from a stand-in frontend/ beside a link to the
// repo's docs/. Still no .env.local.
const productUpdateCwd = path.join(dir, 'frontend');
fs.mkdirSync(productUpdateCwd);
fs.symlinkSync(fileURLToPath(new URL('../../docs/', import.meta.url)), path.join(dir, 'docs'), 'dir');

function dryRun(script: string, args: string[] = [], cwd = dir): string {
  return execFileSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', path.join(scriptsDir, script), '--dry-run', ...args],
    {
      // The temp dir has no .env.local, so the script reads only this env and
      // this DB. A dry run sends nothing whatever else the env holds.
      cwd,
      env: {
        ...process.env,
        AUTH_DB_PATH: dbPath,
        ZEROGEX_END_USER_TOKEN_SECRET: 'test-secret',
        // The product-update cancelled template states the win-back rate.
        WINBACK_DISCOUNT_LABEL: '50% off your first year',
      },
      encoding: 'utf8',
    },
  );
}

/** Split a run's output at a heading: [what it reports before, the rest]. */
function splitAt(out: string, heading: string): [string, string] {
  const at = out.indexOf(heading);
  assert.ok(at >= 0, `no "${heading}" in:\n${out}`);
  return [out.slice(0, at), out.slice(at)];
}

/** Split a run's output at the held-out list: [what it reports before, the list]. */
function splitAtHeldOut(out: string): [string, string] {
  return splitAt(out, 'Skipped, not customers');
}

type CapturedEmail = { to: string | string[]; subject: string; text: string; html: string };

// The weekly timer runs `make winback DIGEST=1`, which emails the founder the
// recipient list and a draft instead of emailing members. The email-audit
// Resend stub is preloaded, so the digest is captured to a file, not sent.
function winbackDigest(): CapturedEmail {
  const capturePath = path.join(dir, 'winback-digest.ndjson');
  fs.rmSync(capturePath, { force: true });
  execFileSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--no-warnings',
      `--import=${pathToFileURL(path.join(scriptsDir, 'email-audit', 'stub-resend.mts')).href}`,
      path.join(scriptsDir, 'send-winback.mts'),
      '--digest',
      'founder@example.test',
    ],
    {
      cwd: dir,
      env: {
        ...process.env,
        AUTH_DB_PATH: dbPath,
        RESEND_API_KEY: 're_test_key',
        RESEND_FROM_EMAIL: 'ZeroGEX <hello@example.test>',
        CAPTURE_OUT: capturePath,
      },
      encoding: 'utf8',
    },
  );
  const sent = fs.readFileSync(capturePath, 'utf8').trim().split('\n');
  assert.equal(sent.length, 1, 'the digest is one email, to the founder');
  return JSON.parse(sent[0]) as CapturedEmail;
}

test('win-back names the partners, the comped member and the admin as skipped', { skip: needsCli }, () => {
  const out = dryRun('send-winback.mts');
  const [report, heldOut] = splitAtHeldOut(out);

  assert.match(report, /^Eligible users: +1$/m, out);
  assert.match(report, /^ {2}- customer@example\.test: churned /m, out);
  for (const id of HELD_OUT) assert.ok(!report.includes(`${id}@example.test`), `${id} is not eligible:\n${out}`);

  assert.match(heldOut, /^ {2}- partner@example\.test: partner_grant, churned /m);
  assert.match(heldOut, /^ {2}- expired_partner@example\.test: partner_grant, churned /m);
  assert.match(heldOut, /^ {2}- comped@example\.test: comped, churned /m);
  assert.match(heldOut, /^ {2}- admin@example\.test: admin, churned /m);
  assert.ok(!heldOut.includes('customer@example.test'), out);
});

test('win-back names a member who unsubscribed from marketing as skipped', { skip: needsCli }, () => {
  const out = dryRun('send-winback.mts');
  const [report, optedOut] = splitAt(out, 'Skipped, unsubscribed from marketing');

  assert.match(report, /^Eligible users: +1$/m, out);
  assert.ok(!report.includes('opted_out@example.test'), `opted_out is not eligible:\n${out}`);

  assert.match(optedOut, /^ {2}- opted_out@example\.test: unsubscribed 20\d\d-\d\d-\d\dT[^,]+, churned /m, out);
  assert.ok(!optedOut.includes('customer@example.test'), out);
});

test('the win-back digest lists only the customer, and says who was skipped and why', { skip: needsCli }, () => {
  const digest = winbackDigest();

  assert.deepEqual([digest.to].flat(), ['founder@example.test']);
  assert.match(digest.subject, /Win-back review — 1 churned member ready/);

  const [, afterRecipients] = splitAt(digest.text, 'Recipients (1):');
  const [recipients, afterSkipped] = splitAt(afterRecipients, 'Skipped (5), not emailed:');
  const [skipped, draft] = splitAt(afterSkipped, 'DRAFT that will be sent');

  assert.equal(recipients.trim(), 'Recipients (1):\n  - customer@example.test');
  assert.match(skipped, /^ {2}- opted_out@example\.test: unsubscribed from marketing on 20\d\d-\d\d-\d\d$/m);
  for (const id of HELD_OUT) assert.match(skipped, new RegExp(`^ {2}- ${id}@example\\.test: not a customer \\(`, 'm'));
  assert.ok(!skipped.includes('customer@example.test'), digest.text);

  // The embedded draft is for the founder to read. Its unsubscribe link is the
  // real footer, but unsigned: a click in the founder's inbox must not opt a
  // member out.
  assert.match(draft, /Unsubscribe from emails like this:\nhttps?:\/\/\S+\/unsubscribe$/m);
  assert.doesNotMatch(digest.text, /unsubscribe\?/);
  assert.doesNotMatch(digest.html, /unsubscribe\?/);
});

test('return-intent counts and names them as skipped', { skip: needsCli }, () => {
  const out = dryRun('send-return-intent.mts');
  const [report, heldOut] = splitAtHeldOut(out);

  assert.match(report, /^Eligible: +1$/m, out);
  assert.match(report, /^ +2 {2}partner-grant$/m, out);
  assert.match(report, /^ +1 {2}comped$/m, out);
  assert.match(report, /^ +1 {2}operator$/m, out);

  assert.match(heldOut, /^ {2}- partner@example\.test: partner-grant$/m);
  assert.match(heldOut, /^ {2}- expired_partner@example\.test: partner-grant$/m);
  assert.match(heldOut, /^ {2}- comped@example\.test: comped$/m);
  assert.match(heldOut, /^ {2}- admin@example\.test: operator$/m);

  const members = heldOut.slice(heldOut.indexOf('Eligible members:'));
  assert.match(members, /^ {2}- customer@example\.test: /m, out);
  for (const id of HELD_OUT) assert.ok(!members.includes(`${id}@example.test`), `${id} is not eligible:\n${out}`);
});

test('reactivation skips the lapsed partner, and the partner does not use up the batch', { skip: needsCli }, () => {
  const out = dryRun('send-reactivation.mts', ['--limit', '1']);
  const [report, heldOut] = splitAtHeldOut(out);

  assert.match(report, /^Eligible this run: +1$/m, out);
  assert.match(report, /^ {2}- prospect@example\.test: signed up /m, out);
  assert.ok(!report.includes('idle_partner@example.test'), out);
  assert.match(heldOut, /^ {2}- idle_partner@example\.test: partner_grant, signed up /m);
});

test('the cancel-reason follow-up skips them, by name, under their own reasons', { skip: needsCli }, () => {
  const out = dryRun('send-cancel-reason-followup.mts', ['--days', '60']);

  assert.match(out, /^Eligible: +1$/m, out);
  assert.match(out, /^ +2 {2}partner_grant$/m, out);
  assert.match(out, /^ +1 {2}comped$/m, out);
  assert.match(out, /^ +1 {2}admin$/m, out);
  assert.match(out, /^ {2}- partner@example\.test \(too_expensive\): partner_grant$/m, out);
  assert.match(out, /^ {2}- comped@example\.test \(too_expensive\): comped$/m, out);

  const willEmail = out.slice(out.indexOf('Will email:'));
  assert.match(willEmail, /^ {2}- customer@example\.test: /m, out);
  for (const id of HELD_OUT) assert.ok(!willEmail.includes(`${id}@example.test`), `${id} is not emailed:\n${out}`);
});

test('the product-update cancelled audience drops them from the cohort, and from --csv', { skip: needsCli }, () => {
  // August is the campaign with a cancelled variant. The CSV is the cohort
  // handed to Resend's UI, which the script's own skip list never sees.
  const csvPath = path.join(dir, 'cancelled.csv');
  const out = dryRun(
    'send-product-update.mts',
    ['--campaign', '2026-08', '--audience', 'cancelled', '--allow-missing-coupon', '--csv', csvPath],
    productUpdateCwd,
  );
  const [report, heldOut] = splitAtHeldOut(out);

  assert.match(report, /^Cohort size: +1$/m, out);
  assert.match(report, /^To send: +1$/m, out);
  assert.match(report, /^ {2}- customer@example\.test \(signed up /m, out);
  for (const id of HELD_OUT) assert.ok(!report.includes(`${id}@example.test`), `${id} is not in the cohort:\n${out}`);

  assert.match(heldOut, /^ {2}- partner@example\.test: partner_grant$/m);
  assert.match(heldOut, /^ {2}- expired_partner@example\.test: partner_grant$/m);
  assert.match(heldOut, /^ {2}- comped@example\.test: comped$/m);
  assert.match(heldOut, /^ {2}- admin@example\.test: admin$/m);

  assert.equal(fs.readFileSync(csvPath, 'utf8'), 'email\ncustomer@example.test\n');
});
