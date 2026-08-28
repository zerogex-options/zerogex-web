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
import { formatCardBrand } from '../core/stripeCard.ts';
import { classifyTrialEngagement, daysSinceLastSeen } from '../core/trialEngagement.ts';
import { classifySubscriberBucket } from '../core/subscriberBucket.ts';

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
  terms_accepted_at: string | null;
  terms_version_accepted: string | null;
  last_seen_at: string | null;
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
  payment_grace_started_at: string | null;
  payment_grace_reason: string | null;
  trial_reminder_email_sent_at: string | null;
  referred_by_code: string | null;
  referral_credit_months: number | null;
};

const rows = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, tier, created_at, email_verified_at,
          terms_accepted_at, terms_version_accepted, last_seen_at,
          founding_eligible, founding_member_started_at, founding_lifetime_applied_at,
          paid_welcome_email_sent_at, subscription_lapsed, subscription_status,
          stripe_customer_id, stripe_subscription_id, stripe_price_id,
          current_period_end, cancel_at_period_end,
          payment_grace_started_at, payment_grace_reason,
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
// Printed as one line because that is how it gets used: a chargeback asks what
// the member agreed to and when, and this answers both. A dash means the
// account predates the signup checkbox — say "no recorded acceptance", never
// imply one happened.
kv(
  'Terms accepted',
  user.terms_accepted_at
    ? `${user.terms_accepted_at} (effective ${orDash(user.terms_version_accepted)})`
    : '—',
);
// Engagement, not just recency: "used it once on signup day and never came
// back" is the shape that precedes a chargeback, and a bare timestamp buries
// it. A dash means the account predates last_seen_at — unknown, not dormant.
{
  const engagement = classifyTrialEngagement({
    trialStartIso: user.created_at,
    lastSeenAtIso: user.last_seen_at,
  });
  const idle = daysSinceLastSeen(user.last_seen_at, new Date().toISOString());
  kv(
    'Last seen',
    user.last_seen_at
      ? `${user.last_seen_at}${idle === null ? '' : ` (${idle}d ago)`} — ${
          engagement === 'dormant'
            ? 'DORMANT: no return visit after signup'
            : engagement === 'engaged'
              ? 'returned after signup'
              : 'engagement unknown'
        }`
      : '— (predates last_seen_at)',
  );
}
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
kv('Payment grace started', orDash(user.payment_grace_started_at));
kv('Payment grace reason', orDash(user.payment_grace_reason));
kv('Paid welcome sent', orDash(user.paid_welcome_email_sent_at));
kv('Subscription lapsed', yesNo(user.subscription_lapsed));
kv('Trial reminder sent', orDash(user.trial_reminder_email_sent_at));

// Which line of the admin Total Subscribers chart this member is on RIGHT NOW,
// and why. Uses the same classifier the chart's buckets are tested against
// (core/subscriberBucket), so "why isn't this person in Trial Grace?" is
// answerable here instead of by reading monitoring SQL by hand.
header('Admin monitoring bucket');
{
  const verdict = classifySubscriberBucket({
    subscriptionStatus: user.subscription_status,
    tier: user.tier,
    paymentGraceReason: user.payment_grace_reason,
    cancelAtPeriodEnd: Number(user.cancel_at_period_end) === 1,
  });
  kv('Counted as', verdict.label);
  kv('Because', verdict.why);
}

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

// Resolve a Stripe reference that may be a bare id string or an expanded object
// down to its id.
function idOf(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object' && typeof (ref as { id?: unknown }).id === 'string') {
    return (ref as { id: string }).id;
  }
  return null;
}

// The card the ~48h trial reminder will name at conversion, resolved the same
// way resolveCard does in send-trial-reminders.mts — subscription default, then
// customer invoice-settings default, then (for a Checkout-created trial that
// leaves both slots empty) the most recently attached card in the customer's
// PM list — plus which slot it came from. Read-only; mirrors the reminder so a
// blank charge/card line in the email is explained right here.
async function resolveCardOnFile(
  sub: Stripe.Subscription,
  customerId: string,
): Promise<{ brand: string | null; last4: string; source: string } | null> {
  const subPm = sub.default_payment_method;
  if (subPm && typeof subPm === 'object' && 'card' in subPm && subPm.card?.last4) {
    return { brand: subPm.card.brand ?? null, last4: subPm.card.last4, source: 'subscription default' };
  }

  let pmId = idOf(subPm);
  let source = 'subscription default';
  if (!pmId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!('deleted' in customer && customer.deleted)) {
      pmId = idOf(customer.invoice_settings?.default_payment_method);
      source = 'customer invoice-settings default';
    }
  }

  if (pmId) {
    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (pm.card?.last4) return { brand: pm.card.brand ?? null, last4: pm.card.last4, source };
    return null;
  }

  const cards = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
  const card = cards.data[0]?.card;
  if (card?.last4) {
    return { brand: card.brand ?? null, last4: card.last4, source: 'customer card list (no default set)' };
  }
  return null;
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

// Every payment method attached to the customer, across all types. This makes a
// "Card on file: none resolvable" above self-explanatory: the member may have
// checked out with Link or a wallet (a non-card PM, so no brand/last4 to name),
// or have no PM at all (a real conversion risk — the trial-end charge will fail).
try {
  const pms = await stripe.paymentMethods.list({ customer: user.stripe_customer_id, limit: 20 });
  header('Stripe payment methods (all types)');
  if (pms.data.length === 0) {
    console.log('  (none attached — trial-end charge has nothing to bill)');
  } else {
    for (const pm of pms.data) {
      const detail = pm.card
        ? `${formatCardBrand(pm.card.brand) ?? pm.card.brand ?? 'card'} ····${pm.card.last4} exp ${pm.card.exp_month}/${pm.card.exp_year}`
        : '(no card object — wallet/bank/Link)';
      kv(pm.type, `${pm.id} — ${detail}`);
    }
  }
} catch (err) {
  const e = err as StripeError;
  header('Stripe payment methods (all types)');
  kv('Lookup error', e.message);
}

if (user.stripe_subscription_id) {
  try {
    const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id, {
      expand: ['items.data.price', 'discounts', 'default_payment_method'],
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
    // The exact amount Stripe will charge on the next cycle, AFTER every applied
    // discount — i.e. what the ~48h trial reminder now quotes (both read it from
    // the upcoming-invoice preview). Shown right under the list price + discounts
    // so a discounted member's real charge is obvious at a glance ($59 list, a
    // coupon, $29 upcoming). Best-effort: a sub with nothing upcoming (set to
    // cancel at period end, etc.) has no preview, so we say so rather than crash.
    try {
      const upcoming = await stripe.invoices.retrieveUpcoming({
        customer: user.stripe_customer_id,
        subscription: sub.id,
      });
      kv(
        'Upcoming invoice',
        `${formatMoney(upcoming.amount_due, upcoming.currency)} (next charge, after all discounts)`,
      );
    } catch (e) {
      const upErr = e as StripeError;
      kv(
        'Upcoming invoice',
        upErr.code === 'invoice_upcoming_none'
          ? 'none scheduled (e.g. cancels at period end)'
          : `unavailable (${upErr.message})`,
      );
    }

    // The payment-method slots Stripe consults to auto-charge when the trial
    // converts: the subscription's own default first, then the customer's
    // invoice-settings default. This is the ground truth for "will the renewal
    // actually charge?" — distinct from the "Card on file" line below, which for
    // a Checkout trial falls back to the newest card in the PM list for DISPLAY
    // even when neither default is wired. sub.default_payment_method is expanded
    // on the retrieve above, so when it's set we decode its card inline.
    const subDefaultPm = sub.default_payment_method;
    const subDefaultId = idOf(subDefaultPm);
    const subDefaultDesc =
      subDefaultPm && typeof subDefaultPm === 'object'
        ? subDefaultPm.card
          ? `${subDefaultPm.id} — ${formatCardBrand(subDefaultPm.card.brand) ?? subDefaultPm.card.brand ?? 'card'} ····${subDefaultPm.card.last4}`
          : `${subDefaultPm.id} — (no card object — wallet/bank/Link)`
        : subDefaultId ?? 'not set';
    kv('Sub default PM', subDefaultDesc);

    let customerDefaultPmId: string | null = null;
    try {
      const cust = await stripe.customers.retrieve(user.stripe_customer_id);
      if (!('deleted' in cust && cust.deleted)) {
        customerDefaultPmId = idOf(cust.invoice_settings?.default_payment_method);
      }
    } catch {
      // Non-fatal: the sub slot still prints; only the customer fallback is unknown.
    }
    kv('Customer default PM', customerDefaultPmId ?? 'not set');
    if (!subDefaultId && !customerDefaultPmId) {
      console.log(
        '      note: neither default set — Stripe has no wired PM for the auto-charge;',
      );
      console.log(
        '            conversion relies on Stripe finding a usable method at invoice time.',
      );
    }

    // The card the ~48h reminder will name (or why it can't) — same resolution
    // the reminder uses. When this says "none resolvable", the reminder still
    // quotes the price but with neutral "payment method on file" wording rather
    // than naming a card. "no default set" means the card lives only in the
    // customer's PM list (typical for a Checkout trial); the reminder falls back
    // to it too for display.
    try {
      const cardOnFile = await resolveCardOnFile(sub, user.stripe_customer_id);
      kv(
        'Card on file',
        cardOnFile
          ? `${formatCardBrand(cardOnFile.brand) ?? cardOnFile.brand ?? 'card'} ending in ${cardOnFile.last4} — ${cardOnFile.source}`
          : 'none resolvable — reminder shows the price with neutral wording, no card named',
      );
    } catch (e) {
      kv('Card on file', `unavailable (${(e as StripeError).message})`);
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
