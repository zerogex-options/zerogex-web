#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/diagnose-user.mts --email <email>
//
// Prints everything we know about a single user in one place: DB row, recent
// audit_events, the live Stripe customer/subscription/invoice state, and a
// short interpretation that flags the most common subscription-state bugs
// (no-trial founder, stale stripe_customer_id, drifted webhook state, etc.).
//
// Read-only — no DB or Stripe mutations.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

// The July-1 founding deferral landed in commit 06b7128. founders whose
// subscription started before this got charged immediately; founders after it
// should have a trial_end of July 1, 09:30 ET.
const FOUNDING_DEFERRAL_DEPLOY_ISO = '2026-06-10T14:33:00.000Z';
const FOUNDING_DEADLINE_ISO = '2026-07-01T13:30:00.000Z';

type Args = {
  email: string | null;
  help: boolean;
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
  const args: Args = { email: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (!arg.startsWith('--') && !args.email) args.email = arg;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/diagnose-user.mts --email <email>

Prints the DB row, last 20 audit_events, and live Stripe state (customer,
subscription, last 5 invoices) for one user. Read-only.

Options:
  -e, --email <email>   Target user. Required.
  -h, --help            Show this help.

Reads STRIPE_SECRET_KEY and AUTH_DB_PATH from env or .env.local. Stripe data
is skipped (with a note) if STRIPE_SECRET_KEY is not set.`);
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

function querySqlite<T = Record<string, unknown>>(dbPath: string, sql: string): T[] {
  try {
    const out = execFileSync('sqlite3', ['-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (!out) return [];
    return JSON.parse(out) as T[];
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr;
    const message =
      typeof stderr === 'string' ? stderr : stderr?.toString?.() ?? (err as Error).message;
    throw new Error(message.trim() || (err as Error).message);
  }
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
}
if (!cliArgs.email) {
  usage();
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
function envOrLocal(key: string): string | undefined {
  return process.env[key] || envLocal[key] || undefined;
}

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

ensureSqlite3Cli();

type UserRow = {
  id: string;
  email: string;
  tier: string | null;
  created_at: string | null;
  email_verified_at: string | null;
  founding_eligible: number | null;
  founding_member_started_at: string | null;
  founding_lifetime_applied_at: string | null;
  paid_welcome_email_sent_at: string | null;
  subscription_lapsed: number | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: number | null;
  trial_reminder_email_sent_at: string | null;
  referred_by_code: string | null;
  referral_credit_months: number | null;
};

const rows = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, tier, created_at, email_verified_at,
          founding_eligible, founding_member_started_at, founding_lifetime_applied_at,
          paid_welcome_email_sent_at, subscription_lapsed, subscription_status,
          stripe_customer_id, stripe_subscription_id, stripe_price_id,
          current_period_end, cancel_at_period_end,
          trial_reminder_email_sent_at,
          referred_by_code, referral_credit_months
   FROM users
   WHERE LOWER(email) = '${escapeSqlLiteral(cliArgs.email.toLowerCase())}'
   LIMIT 1;`,
);

if (rows.length === 0) {
  console.error(`No user found with email ${cliArgs.email}`);
  process.exit(1);
}
const user = rows[0];

type AuditRow = {
  type: string;
  message: string | null;
  ip: string | null;
  created_at: string;
};
const audit = querySqlite<AuditRow>(
  dbPath,
  `SELECT type, message, ip, created_at FROM audit_events
   WHERE user_id = '${escapeSqlLiteral(user.id)}'
   ORDER BY created_at DESC
   LIMIT 20;`,
);

const yesNo = (v: number | null | undefined) => (Number(v) === 1 ? 'yes' : 'no');
const orDash = (v: string | null | undefined) => (v ? v : '—');

function header(title: string) {
  console.log(`\n=== ${title} ===`);
}
function kv(label: string, value: string) {
  console.log(`  ${label.padEnd(28)} ${value}`);
}

header(`User: ${user.email}`);
kv('ID', user.id);
kv('Tier', user.tier ?? 'public');
kv('Account created', orDash(user.created_at));
kv('Email verified', orDash(user.email_verified_at));
kv('Founding eligible', yesNo(user.founding_eligible));
kv('Referred by code', orDash(user.referred_by_code));
kv('Referral credit months', String(user.referral_credit_months ?? 0));

header('Founding state');
kv('Founding started at', orDash(user.founding_member_started_at));
kv('Founding lifetime applied', orDash(user.founding_lifetime_applied_at));

header('Subscription state (DB)');
kv('Status', orDash(user.subscription_status));
kv('Stripe customer id', orDash(user.stripe_customer_id));
kv('Stripe subscription id', orDash(user.stripe_subscription_id));
kv('Stripe price id', orDash(user.stripe_price_id));
kv('Current period end', orDash(user.current_period_end));
kv('Cancel at period end', yesNo(user.cancel_at_period_end));
kv('Paid welcome sent', orDash(user.paid_welcome_email_sent_at));
kv('Subscription lapsed', yesNo(user.subscription_lapsed));
kv('Trial reminder sent', orDash(user.trial_reminder_email_sent_at));

// Deferral analysis — what the checkout route would have computed at the
// time of subscription. Surfaces the exact reason a founder might NOT have
// gotten the July-1 deferral.
header('Deferral analysis');
const hasPriorPaidSub =
  !!user.paid_welcome_email_sent_at || Number(user.subscription_lapsed) === 1;
kv('hasPriorPaidSubscription', yesNo(hasPriorPaidSub ? 1 : 0));
kv('Founding deadline', FOUNDING_DEADLINE_ISO);
kv('Deferral deployed at', FOUNDING_DEFERRAL_DEPLOY_ISO);

const startedAt = user.founding_member_started_at
  ? Date.parse(user.founding_member_started_at)
  : null;
const deployedAt = Date.parse(FOUNDING_DEFERRAL_DEPLOY_ISO);
const deadlineAt = Date.parse(FOUNDING_DEADLINE_ISO);

console.log('');
if (startedAt == null) {
  console.log('  NOTE: user never completed a founding subscription redemption.');
} else if (startedAt < deployedAt) {
  console.log(
    '  NOTE: founding redemption happened BEFORE the July-1 deferral was deployed.',
  );
  console.log('        The immediate charge was expected at the time of redemption.');
  console.log(
    '        scripts/credit-founders-july1-delay.mts is the remediation for this cohort.',
  );
} else if (startedAt >= deployedAt) {
  console.log('  NOTE: founding redemption happened AFTER the July-1 deferral was deployed.');
  if (user.subscription_status === 'trialing') {
    console.log('        Status is trialing — deferral most likely applied correctly.');
  } else if (user.subscription_status === 'active') {
    if (hasPriorPaidSub) {
      console.log(
        '        Status is active and hasPriorPaidSubscription is true → deferral was',
      );
      console.log('        intentionally skipped (route.ts:139-146 requires no prior paid sub).');
      console.log(
        '        Check the billing_checkout_started audit row below: trial=0 confirms this.',
      );
    } else {
      console.log(
        '        BUG SUSPECTED: status is active and no prior paid sub, yet not trialing.',
      );
      console.log(
        '        Check the billing_checkout_started audit row below for the trial= value:',
      );
      console.log('          trial=founding_july1 → checkout sent it; investigate Stripe side');
      console.log('          trial=7d            → fell through to 7-day; foundingApplied was false');
      console.log('          trial=0             → no trial; both conditions failed at checkout');
    }
  } else {
    console.log(`        Status is '${user.subscription_status ?? 'null'}'.`);
  }
}
if (deadlineAt - Date.now() < 48 * 60 * 60 * 1000) {
  console.log(
    '  NOTE: founding deadline is within 48h (or past). New founders subscribing now',
  );
  console.log('        will fall back to the 7-day trial — that is by design.');
}

if (audit.length > 0) {
  header('Recent audit events (last 20)');
  for (const row of audit) {
    const msg = row.message ? ` — ${row.message}` : '';
    console.log(`  ${row.created_at}  ${row.type.padEnd(36)}${msg}`);
  }
}

// --- Stripe side -----------------------------------------------------------

const STRIPE_SECRET_KEY = envOrLocal('STRIPE_SECRET_KEY');
if (!STRIPE_SECRET_KEY) {
  header('Stripe');
  console.log('  STRIPE_SECRET_KEY not set; skipping Stripe lookup.');
  process.exit(0);
}
if (!user.stripe_customer_id) {
  header('Stripe');
  console.log('  User has no stripe_customer_id; nothing to fetch.');
  process.exit(0);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

type StripeError = Error & { code?: string; statusCode?: number };

function isoFromUnix(unix: number | null | undefined): string {
  if (unix == null) return '—';
  return new Date(unix * 1000).toISOString();
}

function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || currency == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

try {
  const customer = await stripe.customers.retrieve(user.stripe_customer_id);
  header('Stripe customer');
  if (customer.deleted) {
    kv('ID', user.stripe_customer_id);
    kv('Status', 'DELETED on Stripe (resource_missing)');
  } else {
    kv('ID', customer.id);
    kv('Created', isoFromUnix(customer.created));
    kv('Email', customer.email ?? '—');
    const balance = customer.balance;
    if (typeof balance === 'number' && balance !== 0) {
      kv(
        'Balance',
        `${formatMoney(balance, customer.currency ?? 'usd')} (negative = credit applied to next invoice)`,
      );
    }
  }
} catch (err) {
  const e = err as StripeError;
  header('Stripe customer');
  kv('ID', user.stripe_customer_id);
  kv('Lookup error', e.code === 'resource_missing' ? 'resource_missing' : e.message);
}

if (user.stripe_subscription_id) {
  try {
    const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id, {
      expand: ['items.data.price', 'discounts'],
    });
    header('Stripe subscription');
    kv('ID', sub.id);
    kv('Status', sub.status);
    kv('Trial start', isoFromUnix(sub.trial_start));
    kv('Trial end', isoFromUnix(sub.trial_end));
    const item0 = sub.items.data[0];
    if (item0?.price) {
      kv(
        'Item 0 price',
        `${item0.price.id} — ${formatMoney(item0.price.unit_amount, item0.price.currency)} / ${item0.price.recurring?.interval ?? '?'}`,
      );
    }
    const itemPeriodEnd = (item0 as unknown as { current_period_end?: number } | undefined)
      ?.current_period_end;
    const subPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
    kv('Current period end', isoFromUnix(itemPeriodEnd ?? subPeriodEnd ?? null));
    kv('Cancel at period end', sub.cancel_at_period_end ? 'yes' : 'no');
    const discounts = (sub as unknown as { discounts?: Array<{ coupon?: { id?: string } } | string> })
      .discounts;
    if (discounts && discounts.length > 0) {
      const ids = discounts.map((d) => {
        if (typeof d === 'string') return d;
        return d.coupon?.id ?? '?';
      });
      kv('Discounts', ids.join(', '));
    } else {
      kv('Discounts', 'none');
    }
    const metaPairs = Object.entries(sub.metadata ?? {});
    if (metaPairs.length > 0) {
      kv('Metadata', metaPairs.map(([k, v]) => `${k}=${v}`).join(', '));
    }
  } catch (err) {
    const e = err as StripeError;
    header('Stripe subscription');
    kv('ID', user.stripe_subscription_id);
    kv('Lookup error', e.code === 'resource_missing' ? 'resource_missing' : e.message);
  }
}

try {
  const invoices = await stripe.invoices.list({
    customer: user.stripe_customer_id,
    limit: 5,
  });
  header('Stripe invoices (last 5)');
  if (invoices.data.length === 0) {
    console.log('  (none)');
  }
  for (const inv of invoices.data) {
    const amount = formatMoney(inv.amount_due, inv.currency);
    const paidAt = inv.status === 'paid' ? isoFromUnix(inv.status_transitions?.paid_at ?? null) : '';
    console.log(
      `  ${inv.id}  ${amount}  status=${inv.status}  attempt=${inv.attempt_count}  created=${isoFromUnix(inv.created)}${paidAt ? `  paid=${paidAt}` : ''}`,
    );
    if (inv.hosted_invoice_url) {
      console.log(`    hosted_invoice_url: ${inv.hosted_invoice_url}`);
    }
  }
} catch (err) {
  const e = err as StripeError;
  header('Stripe invoices (last 5)');
  kv('Lookup error', e.message);
}

console.log('');
