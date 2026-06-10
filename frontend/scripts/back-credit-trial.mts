#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/back-credit-trial.mts \
//     [--dry-run | --yes]
//
// One-off backfill: credit every existing MONTHLY non-Founding subscriber
// 7/31 of their plan price, to retroactively grant the trial new signups now
// get. Annual subscribers are intentionally skipped (their annual rate is
// already discounted). Founding Members are also skipped — they have their
// own credit via scripts/credit-founders-july1-delay.mts.
//
// The credit is posted as a NEGATIVE customers balance transaction; Stripe
// auto-applies it to the next invoice.
//
// Idempotent: skips any user with an existing audit_events row of type
// `billing_trial_back_credit`.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';
import { Resend } from 'resend';

const TRIAL_DAYS = 7;
const MONTH_DAYS = 31;
const AUDIT_TYPE = 'billing_trial_back_credit';

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  previewTo: string | null;
};

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, yes: false, help: false, previewTo: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/back-credit-trial.mts \\
    [--dry-run | --yes | --preview-to <email>]

For each MONTHLY non-Founding active subscriber, posts a Stripe
customer-balance credit equal to ${TRIAL_DAYS}/${MONTH_DAYS} of the price they
paid on their most recent invoice. Auto-applies to their next invoice. On
--yes, also sends a notification email to the credited user.

Skipped cohorts:
  - Annual subscribers (annual rate is already discounted).
  - Founding Members (handled by credit-founders-july1-delay.mts).
  - Users already credited (audit_events.type = \`${AUDIT_TYPE}\`).

Options:
      --dry-run             Print what would happen; no Stripe or DB writes.
  -y, --yes                 Apply the credits and send emails.
      --preview-to <email>  Render the notification email and send ONE copy
                            to <email> with a sample amount. No Stripe or DB
                            writes; exits immediately.
  -h, --help                Show this help.

Reads STRIPE_SECRET_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL from env or
.env.local. Set AUTH_DB_PATH to override the default DB path.`);
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH.');
    console.error('Install it with: sudo apt-get install sqlite3');
    process.exit(1);
  }
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function runSqlite(dbPath: string, sql: string): string {
  try {
    return execFileSync('sqlite3', ['-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr;
    const message =
      typeof stderr === 'string'
        ? stderr
        : stderr?.toString?.() ?? (err as Error).message;
    throw new Error(message.trim() || (err as Error).message);
  }
}

function querySqlite<T = Record<string, unknown>>(dbPath: string, sql: string): T[] {
  const output = runSqlite(dbPath, sql).trim();
  if (!output) return [];
  return JSON.parse(output) as T[];
}

function execSqlite(dbPath: string, sql: string) {
  runSqlite(dbPath, sql);
}

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  usage();
  process.exit(0);
}

const exclusiveFlags = [cliArgs.dryRun, cliArgs.yes, !!cliArgs.previewTo].filter(Boolean).length;
if (exclusiveFlags > 1) {
  console.error('Error: --dry-run, --yes, and --preview-to are mutually exclusive.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || envLocal.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY not set in env or .env.local.');
  process.exit(1);
}

const RESEND_API_KEY = process.env.RESEND_API_KEY || envLocal.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || envLocal.RESEND_FROM_EMAIL;
if ((cliArgs.yes || cliArgs.previewTo) && (!RESEND_API_KEY || !RESEND_FROM_EMAIL)) {
  console.error('Error: RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send emails.');
  process.exit(1);
}

function formatUsd(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTrialBackCreditEmail(amountFormatted: string): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = 'A small credit on your ZeroGEX account';
  const text = [
    'Hello,',
    '',
    `A quick note — I recently introduced a 7-day free trial for new ZeroGEX signups. Since you subscribed before that, I credited your account ${amountFormatted} — roughly 7 days at your current plan rate. The credit will apply automatically to your next invoice.`,
    '',
    'Thanks for being an early supporter — it means a lot.',
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
  ].join('\n');
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>A quick note &mdash; I recently introduced a 7-day free trial for new ZeroGEX signups. Since you subscribed before that, I credited your account <strong>${escapeHtml(amountFormatted)}</strong> &mdash; roughly 7 days at your current plan rate. The credit will apply automatically to your next invoice.</p>
      <p>Thanks for being an early supporter &mdash; it means a lot.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
    </div>
  `.trim();
  return { subject, text, html };
}

let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) resend = new Resend(RESEND_API_KEY!);
  return resend;
}

async function sendBackCreditEmail(to: string, amountFormatted: string): Promise<void> {
  const { subject, text, html } = renderTrialBackCreditEmail(amountFormatted);
  const result = await getResend().emails.send({
    from: RESEND_FROM_EMAIL!,
    to,
    subject,
    text,
    html,
  });
  if (result.error) throw new Error(`Resend error: ${result.error.message}`);
}

if (cliArgs.previewTo) {
  const sample = formatUsd(881, 'usd'); // $8.81 — matches a $39 monthly plan
  console.log(`Sending preview to ${cliArgs.previewTo} (sample amount ${sample})...`);
  await sendBackCreditEmail(cliArgs.previewTo, sample);
  console.log('Preview sent.');
  process.exit(0);
}

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

ensureSqlite3Cli();

const stripe = new Stripe(STRIPE_SECRET_KEY);

type UserRow = {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  founding_member_started_at: string | null;
};

const users = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, stripe_customer_id, stripe_subscription_id,
          subscription_status, founding_member_started_at
   FROM users
   WHERE stripe_customer_id IS NOT NULL
     AND stripe_subscription_id IS NOT NULL
     AND subscription_status IN ('active','trialing')
     AND founding_member_started_at IS NULL
   ORDER BY id ASC;`,
);

if (users.length === 0) {
  console.log('No eligible subscribers found.');
  process.exit(0);
}

const alreadyCredited = new Set(
  querySqlite<{ user_id: string }>(
    dbPath,
    `SELECT user_id FROM audit_events
     WHERE type = '${escapeSqlLiteral(AUDIT_TYPE)}' AND user_id IS NOT NULL;`,
  ).map((r) => r.user_id),
);

const eligible = users.filter((u) => !alreadyCredited.has(u.id));
const skippedAlready = users.length - eligible.length;

console.log(`Auth DB:               ${dbPath}`);
console.log(`Non-founding actives:  ${users.length}`);
console.log(`Already credited:      ${skippedAlready}`);
console.log(`To consider:           ${eligible.length}`);

if (eligible.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

type CreditPlan = {
  user: UserRow;
  amount: number;
  currency: string;
  basis: string;
};

async function planCredit(user: UserRow): Promise<CreditPlan | { skip: string }> {
  if (!user.stripe_customer_id || !user.stripe_subscription_id) {
    return { skip: 'missing stripe ids' };
  }
  // Read interval from the live subscription so annual is excluded even if
  // the user later switched plans from the price the DB last cached.
  const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
  const interval = subscription.items.data[0]?.price.recurring?.interval;
  if (interval !== 'month') {
    return { skip: `interval=${interval ?? 'unknown'} (monthly only)` };
  }

  const invoices = await stripe.invoices.list({
    customer: user.stripe_customer_id,
    status: 'paid',
    limit: 1,
  });
  const inv = invoices.data[0];
  if (!inv || !inv.amount_paid || !inv.currency) {
    return { skip: 'no paid invoice yet' };
  }
  // 7/31 of what they actually paid, post-discount.
  const amount = Math.round((inv.amount_paid * TRIAL_DAYS) / MONTH_DAYS);
  if (amount <= 0) return { skip: 'computed credit is zero' };
  return {
    user,
    amount,
    currency: inv.currency,
    basis: `invoice ${inv.id} paid ${(inv.amount_paid / 100).toFixed(2)} ${inv.currency.toUpperCase()}; ${TRIAL_DAYS}/${MONTH_DAYS}`,
  };
}

const plans: CreditPlan[] = [];
const skips: Array<{ user: UserRow; reason: string }> = [];

for (const user of eligible) {
  try {
    const plan = await planCredit(user);
    if ('skip' in plan) skips.push({ user, reason: plan.skip });
    else plans.push(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    skips.push({ user, reason: `error: ${message}` });
  }
}

const totalsByCurrency = new Map<string, number>();
for (const p of plans) {
  totalsByCurrency.set(p.currency, (totalsByCurrency.get(p.currency) ?? 0) + p.amount);
}

console.log(`\nWill credit: ${plans.length}`);
console.log(`Will skip:   ${skips.length}`);
for (const [cur, total] of totalsByCurrency) {
  console.log(`  Total ${cur.toUpperCase()}: ${(total / 100).toFixed(2)}`);
}

const sample = plans.slice(0, 10);
for (const p of sample) {
  console.log(
    `  - ${p.user.email}: ${(p.amount / 100).toFixed(2)} ${p.currency.toUpperCase()} (${p.basis})`,
  );
}
if (plans.length > sample.length) {
  console.log(`  ... and ${plans.length - sample.length} more`);
}

if (skips.length > 0) {
  console.log('\nSkipped (sample):');
  for (const s of skips.slice(0, 8)) {
    console.log(`  - ${s.user.email}: ${s.reason}`);
  }
  if (skips.length > 8) console.log(`  ... and ${skips.length - 8} more`);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No credits posted, no audit rows written.');
  process.exit(0);
}

if (!cliArgs.yes) {
  console.log(
    '\nRefusing to write without --yes. Re-run with --yes to apply, or --dry-run to preview.',
  );
  process.exit(1);
}

let successCount = 0;
let failCount = 0;
let emailFailCount = 0;

for (const plan of plans) {
  try {
    await stripe.customers.createBalanceTransaction(plan.user.stripe_customer_id!, {
      amount: -plan.amount,
      currency: plan.currency,
      description: `Trial back-credit: ${TRIAL_DAYS}/${MONTH_DAYS} of plan`,
    });

    const nowIso = new Date().toISOString();
    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    execSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         '${escapeSqlLiteral(AUDIT_TYPE)}',
         '${escapeSqlLiteral(plan.user.id)}',
         NULL,
         '${escapeSqlLiteral(plan.user.email)}',
         'manual-script',
         '${escapeSqlLiteral(`Credited ${plan.amount} ${plan.currency.toUpperCase()} (${plan.basis})`)}',
         '${escapeSqlLiteral(nowIso)}'
       );`,
    );
    successCount++;

    // Notify after the credit + audit row are committed. A mail failure must
    // NOT cause the credit to be re-attempted on a re-run (the audit row is
    // the idempotency latch), so swallow and log.
    try {
      await sendBackCreditEmail(plan.user.email, formatUsd(plan.amount, plan.currency));
    } catch (err) {
      emailFailCount++;
      const message = err instanceof Error ? err.message : 'unknown error';
      console.error(`  EMAIL-FAIL ${plan.user.email}: ${message}`);
    }
  } catch (err) {
    failCount++;
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  FAIL ${plan.user.email}: ${message}`);
  }
}

console.log(
  `\nDone. ${successCount} credited, ${failCount} failed${emailFailCount ? `, ${emailFailCount} email send(s) failed (credit still posted)` : ''}.`,
);
