#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-card-expiry-reminders.mts \
//     [--dry-run | --yes] [--threshold-days N] [--limit N] [--preview-to <email>]
//
// Proactive card-expiry reminder. Finds ACTIVE subscribers whose card on file
// expires soon and emails them to update it BEFORE a renewal is declined into
// past_due — the one involuntary-churn vector Stripe's Smart Retries can't save
// (a dead card stays dead). Intended to run on a daily systemd timer.
//
// The decision (which cards, when, and once-per-card) is the pure
// core/cardExpiry.ts decideCardExpiryReminder; this script is just the live
// Stripe card lookup + the SQLite cohort/latch I/O around it.
//
// Eligibility:
//   - users.subscription_status = 'active' with a Stripe subscription + customer
//   - card on file (resolved live from Stripe) expires within --threshold-days
//     (default 45) and is not already past
//   - users.card_expiry_notified_ym != the card's "YYYY-MM" (re-arms when the
//     member swaps in a card with a different expiry)
//
// Side effects on send:
//   - Resend email via core/mailer.ts sendCardExpiringEmail()
//   - Stamps users.card_expiry_notified_ym = the card's "YYYY-MM"
//   - Writes a `card_expiry_reminder_sent` row into audit_events

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';
import { sendCardExpiringEmail } from '../core/mailer.ts';
import { formatCardBrand } from '../core/stripeCard.ts';
import { decideCardExpiryReminder } from '../core/cardExpiry.ts';

const DEFAULT_THRESHOLD_DAYS = 45;
const DEFAULT_LIMIT = 500;

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  thresholdDays: number;
  limit: number;
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
  const args: Args = {
    dryRun: false,
    yes: false,
    help: false,
    thresholdDays: DEFAULT_THRESHOLD_DAYS,
    limit: DEFAULT_LIMIT,
    previewTo: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--threshold-days') {
      const v = Number(argv[++i] ?? '');
      if (!Number.isFinite(v) || v <= 0) {
        console.error(`Error: --threshold-days expects a positive number, got "${argv[i]}".`);
        process.exit(1);
      }
      args.thresholdDays = v;
    } else if (arg === '--limit') {
      const v = Number(argv[++i] ?? '');
      if (!Number.isFinite(v) || v <= 0) {
        console.error(`Error: --limit expects a positive number, got "${argv[i]}".`);
        process.exit(1);
      }
      args.limit = Math.floor(v);
    } else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-card-expiry-reminders.mts \\
    [--dry-run | --yes] [--threshold-days N] [--limit N] [--preview-to <email>]

Emails ACTIVE subscribers whose card on file expires within --threshold-days
(default ${DEFAULT_THRESHOLD_DAYS}) so they can update it before a renewal fails. Idempotent
per card expiry via users.card_expiry_notified_ym (re-arms on a new expiry).

Options:
      --dry-run             Print who WOULD be emailed; no send, no DB writes.
  -y, --yes                 Send emails and stamp the latch. Requires STRIPE_SECRET_KEY.
      --threshold-days N    Expiry window in days (default ${DEFAULT_THRESHOLD_DAYS}).
      --limit N             Cap subscriptions checked per run (default ${DEFAULT_LIMIT}) to
                            bound Stripe lookups.
      --preview-to <email>  Send ONE sample card-expiry email to <email>. No DB writes.
  -h, --help                Show this help.

Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL, STRIPE_SECRET_KEY
from env or .env.local. Set AUTH_DB_PATH to override the default DB path.`);
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
      typeof stderr === 'string' ? stderr : stderr?.toString?.() ?? (err as Error).message;
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

// Defensive: the app's core/db.ts creates this column at boot, but a cron tick
// can land before the app has restarted onto the new code. ALTER is a no-op once
// the column exists, so add it here too so the SELECT/UPDATE never error.
function ensureColumn(dbPath: string, table: string, column: string, def: string) {
  const info = querySqlite<{ name: string }>(dbPath, `PRAGMA table_info(${table});`);
  if (info.some((c) => c.name === column)) return;
  execSqlite(dbPath, `ALTER TABLE ${table} ADD COLUMN ${column} ${def};`);
}

// Resolve a Stripe reference (bare id or expanded object) to its id.
function idOf(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object' && typeof (ref as { id?: unknown }).id === 'string') {
    return (ref as { id: string }).id;
  }
  return null;
}

type ResolvedCard = {
  brand: string | null;
  last4: string;
  expMonth: number;
  expYear: number;
};

// The card Stripe will charge on renewal + its expiry: the subscription's own
// default payment method, else the customer's invoice-settings default, else the
// most recently attached card (the Checkout-trial shape that leaves both default
// slots empty). Returns null when no card object is resolvable (a wallet/Link
// method has no expiry). Mirrors the resolution order in send-trial-reminders.mts.
async function resolveCardWithExpiry(
  stripe: Stripe,
  subscriptionId: string,
  customerId: string | null,
): Promise<ResolvedCard | null> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method'],
  });
  const subPm = sub.default_payment_method;
  if (subPm && typeof subPm === 'object' && 'card' in subPm && subPm.card?.last4) {
    const c = subPm.card;
    return { brand: c.brand ?? null, last4: c.last4, expMonth: c.exp_month, expYear: c.exp_year };
  }

  let pmId = idOf(subPm);
  if (!pmId && customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!('deleted' in customer && customer.deleted)) {
      pmId = idOf(customer.invoice_settings?.default_payment_method);
    }
  }
  if (pmId) {
    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (pm.card?.last4) {
      return {
        brand: pm.card.brand ?? null,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      };
    }
    return null;
  }

  if (!customerId) return null;
  const cards = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
  const card = cards.data[0]?.card;
  if (card?.last4) {
    return { brand: card.brand ?? null, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year };
  }
  return null;
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
}
if (cliArgs.dryRun && cliArgs.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));

const RESEND_API_KEY = process.env.RESEND_API_KEY || envLocal.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || envLocal.RESEND_FROM_EMAIL;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || '';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || envLocal.STRIPE_SECRET_KEY;

if ((cliArgs.yes || cliArgs.previewTo) && (!RESEND_API_KEY || !RESEND_FROM_EMAIL)) {
  console.error('Error: RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send emails.');
  process.exit(1);
}
if (cliArgs.yes && !STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY is required to read card expiries. Set it to send.');
  process.exit(1);
}

// mailer.ts reads these lazily, so setting them post-import is correct.
if (RESEND_API_KEY) process.env.RESEND_API_KEY = RESEND_API_KEY;
if (RESEND_FROM_EMAIL) process.env.RESEND_FROM_EMAIL = RESEND_FROM_EMAIL;
if (NEXT_PUBLIC_APP_URL) process.env.NEXT_PUBLIC_APP_URL = NEXT_PUBLIC_APP_URL;

if (cliArgs.previewTo) {
  console.log(`Sending preview to ${cliArgs.previewTo}...`);
  await sendCardExpiringEmail(cliArgs.previewTo, {
    cardBrand: 'Visa',
    cardLast4: '4242',
    expiryLabel: '09/2026',
  });
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
ensureColumn(dbPath, 'users', 'card_expiry_notified_ym', 'TEXT');

const stripe: Stripe | null = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
if (!stripe) {
  // Only reachable on --dry-run (real sends require the key above): we can list
  // the cohort but can't read card expiries without Stripe, so there's nothing
  // to decide. Say so plainly instead of silently reporting zero.
  console.error('Error: STRIPE_SECRET_KEY is not set — cannot read card expiries.');
  process.exit(1);
}

type UserRow = {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  card_expiry_notified_ym: string | null;
};

const candidates = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, stripe_customer_id, stripe_subscription_id, card_expiry_notified_ym
   FROM users
   WHERE subscription_status = 'active'
     AND stripe_subscription_id IS NOT NULL
     AND stripe_customer_id IS NOT NULL
     AND deleted_at IS NULL
   ORDER BY current_period_end ASC
   LIMIT ${cliArgs.limit};`,
);

console.log(`Auth DB:            ${dbPath}`);
console.log(`Threshold:          ${cliArgs.thresholdDays} days`);
console.log(`Active subs to scan: ${candidates.length} (limit ${cliArgs.limit})`);

const nowMs = Date.now();
let successCount = 0;
let failCount = 0;
let skippedCount = 0;

for (const user of candidates) {
  try {
    const card = await resolveCardWithExpiry(
      stripe,
      user.stripe_subscription_id!,
      user.stripe_customer_id,
    );
    if (!card) {
      skippedCount++;
      continue; // wallet/Link or no card object — nothing to warn about
    }

    const decision = decideCardExpiryReminder({
      expMonth: card.expMonth,
      expYear: card.expYear,
      nowMs,
      alreadyNotifiedYm: user.card_expiry_notified_ym,
      thresholdDays: cliArgs.thresholdDays,
    });
    if (!decision.shouldNotify || !decision.expiryLabel || !decision.notifyYm) {
      skippedCount++;
      continue;
    }

    if (cliArgs.dryRun) {
      console.log(
        `  [would email] ${user.email}: ${card.brand ?? 'card'} ****${card.last4} expires ${decision.expiryLabel}`,
      );
      successCount++;
      continue;
    }

    await sendCardExpiringEmail(user.email, {
      cardBrand: formatCardBrand(card.brand),
      cardLast4: card.last4,
      expiryLabel: decision.expiryLabel,
    });

    const stamp = new Date().toISOString();
    // Stamp the latch FIRST so a crash after send doesn't re-nag next run.
    execSqlite(
      dbPath,
      `UPDATE users
       SET card_expiry_notified_ym = '${escapeSqlLiteral(decision.notifyYm)}',
           updated_at = '${escapeSqlLiteral(stamp)}'
       WHERE id = '${escapeSqlLiteral(user.id)}';`,
    );
    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    execSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         'card_expiry_reminder_sent',
         '${escapeSqlLiteral(user.id)}',
         NULL,
         '${escapeSqlLiteral(user.email)}',
         'cron-script',
         '${escapeSqlLiteral(`Card ****${card.last4} expiring ${decision.expiryLabel}; reminder sent`)}',
         '${escapeSqlLiteral(stamp)}'
       );`,
    );
    successCount++;
  } catch (err) {
    failCount++;
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  FAIL ${user.email}: ${message}`);
  }
}

if (cliArgs.dryRun) {
  console.log(`\n[dry-run] ${successCount} would be emailed, ${skippedCount} skipped (not expiring / already warned / no card).`);
} else {
  console.log(`\nDone. ${successCount} sent, ${skippedCount} skipped, ${failCount} failed.`);
}
process.exit(failCount > 0 ? 1 : 0);
