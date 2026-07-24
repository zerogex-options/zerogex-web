#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-trial-reminders.mts \
//     [--dry-run | --yes] [--window-hours N] [--preview-to <email>]
//
// Finds every user whose free trial converts to a paid charge in roughly the
// next 48 hours and has not yet been nudged, then sends a one-shot reminder
// email so they have time to cancel cleanly if the service isn't a fit.
// Intended to be scheduled (cron or systemd timer) every few hours.
//
// Each reminder also spells out the exact post-trial charge and — when a card
// can be named — the last four digits of the card on file, both read live from
// Stripe per user (never hardcoded), so a member whose card is stale or
// expiring can fix it before the trial-end charge fails into past_due. A member
// who checked out with Link or a wallet has no nameable card, so the reminder
// still quotes the price but with neutral "payment method on file" wording. The charge is taken from Stripe's
// upcoming-invoice preview, so it reflects any discount on the subscription
// (promo, founding, referral, ...) — the real amount that will be billed, not
// the plan's list price. That enrichment is best-effort: with STRIPE_SECRET_KEY
// unset, or on any per-user Stripe error, the reminder still sends without that
// one line.
//
// Eligibility:
//   - users.subscription_status = 'trialing'
//   - users.current_period_end falls in the trailing 48h window centred on
//     "48 hours from now", widened by +/- WINDOW_HOURS/2 on each side so a
//     run that lands a few hours late still catches the cohort exactly once.
//   - users.trial_reminder_email_sent_at IS NULL (idempotency latch; the
//     Stripe webhook clears it on every fresh transition into 'trialing').
//
// Side effects on send:
//   - Resend email via core/mailer.ts sendTrialReminderEmail().
//   - Stamps users.trial_reminder_email_sent_at = now.
//   - Writes a `trial_reminder_email_sent` row into audit_events.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';
import { buildTrialReminderEmail, sendTrialReminderEmail } from '../core/mailer.ts';
import { formatCardBrand } from '../core/stripeCard.ts';

// 48h from now is the target; a 6h window on each side absorbs a daily cron
// landing at an arbitrary clock time without ever double- or zero-counting.
const TARGET_HOURS = 48;
const DEFAULT_WINDOW_HOURS = 6;

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  windowHours: number;
  previewTo: string | null;
  // Render one specific member's REAL reminder (resolved live from Stripe) to
  // files without sending or writing to the DB — a dry-run preview of the exact
  // copy that member would receive, regardless of the send window or the latch.
  render: string | null;
  // Optional output directory for --render (defaults to the OS temp dir).
  out: string | null;
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
    // Match Next.js's dotenv loader: strip a matched pair of surrounding
    // quotes so RESEND_FROM_EMAIL="ZeroGEX <hello@zerogex.com>" stays a
    // valid From header instead of arriving at Resend with literal quotes.
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
    windowHours: DEFAULT_WINDOW_HOURS,
    previewTo: null,
    render: null,
    out: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--window-hours') {
      const value = Number(argv[++i] ?? '');
      if (!Number.isFinite(value) || value <= 0) {
        console.error(`Error: --window-hours expects a positive number, got "${argv[i]}".`);
        process.exit(1);
      }
      args.windowHours = value;
    } else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--render') args.render = argv[++i] ?? null;
    else if (arg === '--out') args.out = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-trial-reminders.mts \\
    [--dry-run | --yes] [--window-hours N] [--preview-to <email>]

Finds users whose 'trialing' subscription ends in ~${TARGET_HOURS}h and sends a
one-time courtesy reminder email so they can cancel cleanly if they don't
want to be charged.

Eligibility:
  - subscription_status='trialing'
  - current_period_end in [now+${TARGET_HOURS}h - W/2, now+${TARGET_HOURS}h + W/2],
    where W is --window-hours (default ${DEFAULT_WINDOW_HOURS}).
  - trial_reminder_email_sent_at IS NULL (latch; cleared on each fresh
    transition into 'trialing' by the Stripe webhook).

Options:
      --dry-run             Print eligible users; no email, no DB writes.
  -y, --yes                 Send emails and stamp users.
      --window-hours N      Override the +/- N/2 hour window (default ${DEFAULT_WINDOW_HOURS}).
      --preview-to <email>  Render the email and send ONE copy to <email>
                            with a sample trial-end date. No DB writes.
      --render <email>      Render THIS member's real reminder (charge + card
                            resolved live from Stripe) to .html/.txt files and
                            print the text version. Never sends, never writes to
                            the DB, ignores the send window and the sent-latch.
      --out <dir>           Output directory for --render (default: OS temp dir).
  -h, --help                Show this help.

Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL from env or
.env.local. STRIPE_SECRET_KEY (optional) enables the exact charge/card line;
without it, reminders still send minus that line. Set AUTH_DB_PATH to override
the default DB path.`);
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

// The exact post-trial charge and the card that will be charged, resolved live
// from Stripe. Passed to the mailer so the reminder can spell out "your
// subscription will begin at $X/month using your Visa card ending in 4242" —
// the amount, brand, and last-4 are never hardcoded. The amount is the real
// discounted charge from the upcoming-invoice preview (see resolveBillingDetails),
// always this user's actual plan, discounts, and card on file.
type BillingDetails = {
  // Formatted post-trial charge, e.g. "$29.00/month" — the upcoming invoice's
  // discount-aware amount_due, paired with the plan's own billing interval.
  chargeLabel: string;
  // Display-ready brand ("Visa") or null when unknown (wallet / Link / a brand
  // code we don't map), in which case the mailer uses a neutral phrasing.
  cardBrand: string | null;
  // Last four of the card that will be charged, or null when no card can be
  // named at all — a Link/wallet member has a chargeable method but no
  // brand/last4 to show. The mailer then quotes the price with neutral
  // "payment method on file" wording rather than dropping the line.
  cardLast4: string | null;
};

// Card-brand labels + formatCardBrand live in core/stripeCard.ts now, shared
// with the payment-failed dunning email so both name a card identically.

// Resolve a Stripe reference that may be either a bare id string or an expanded
// object down to its id. Mirrors the idOf helper in dedupe-payment-methods.mjs.
function idOf(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object' && typeof (ref as { id?: unknown }).id === 'string') {
    return (ref as { id: string }).id;
  }
  return null;
}

function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (typeof amount !== 'number' || !currency) return null;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

// The brand + last four of the card Stripe will actually charge when the trial
// converts: the subscription's own default payment method if set, else the
// customer's invoice-settings default (Stripe's fallback when the sub has none),
// else — for a subscription created through Stripe Checkout with a trial, which
// populates NEITHER default slot — the most recently attached card in the
// customer's payment-method list. Mirrors the resolution order in
// scripts/dedupe-payment-methods.mjs. Returns null when no card can be found
// (e.g. a Link/wallet method with no card object). brand is the raw Stripe code
// — the caller normalizes it.
async function resolveCard(
  stripe: Stripe,
  sub: Stripe.Subscription,
  customerId: string | null,
): Promise<{ brand: string | null; last4: string } | null> {
  // default_payment_method is expanded on the subscription retrieve below, so
  // when set it arrives as a full PaymentMethod object.
  const subPm = sub.default_payment_method;
  if (subPm && typeof subPm === 'object' && 'card' in subPm && subPm.card?.last4) {
    return { brand: subPm.card.brand ?? null, last4: subPm.card.last4 };
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
    if (pm.card?.last4) return { brand: pm.card.brand ?? null, last4: pm.card.last4 };
    return null;
  }

  // No default payment method on the subscription OR the customer. That is the
  // normal shape for a Checkout-created trial: Checkout attaches the collected
  // card to the customer but leaves both default slots empty, so the card lives
  // only in the customer's payment-method list. Name the most recently attached
  // card (Stripe lists newest first) — for a fresh trial that is the single card
  // the member just entered at checkout. Without this the reminder silently
  // dropped the charge/card line for essentially every Checkout trial.
  if (!customerId) return null;
  const cards = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
    limit: 1,
  });
  const card = cards.data[0]?.card;
  if (card?.last4) return { brand: card.brand ?? null, last4: card.last4 };
  return null;
}

// Live-from-Stripe charge + card for one user. Returns null (caller then omits
// the billing line) only when the CHARGE can't be established: no subscription
// on file, or the upcoming charge can't be previewed / is <= 0. A missing card
// no longer nulls the result — when the charge resolves but no card can be named
// (a Link/wallet member), the card fields come back null and the mailer quotes
// the price with neutral wording. Stripe errors propagate to the caller, which
// treats them as non-fatal and sends the reminder without the line.
async function resolveBillingDetails(
  stripe: Stripe,
  customerId: string | null,
  subscriptionId: string | null,
): Promise<BillingDetails | null> {
  if (!subscriptionId) return null;

  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price', 'default_payment_method'],
  });

  // The AMOUNT must be what Stripe will actually charge when the trial converts,
  // NOT the plan's list price. Reading price.unit_amount (the rack rate) was the
  // bug: a member on a promo/founding/referral discount was quoted the full
  // standard rate — e.g. "$59.00/month" for someone whose real post-trial charge
  // is $29.00. The upcoming invoice is Stripe's own preview of that first real
  // invoice, so its amount_due already reflects every discount on the
  // subscription (public promo, founding intro/lifetime, win-back, campaign, and
  // stacked referee coupons) plus any account-credit balance — with no discount
  // math on our side to drift out of sync with what Stripe bills. The cadence
  // (monthly/annual) still comes from the plan's own recurring interval.
  const price = sub.items.data[0]?.price ?? null;
  const interval = price?.recurring?.interval ?? null;

  const upcoming = await stripe.invoices.retrieveUpcoming(
    customerId
      ? { customer: customerId, subscription: subscriptionId }
      : { subscription: subscriptionId },
  );

  // amount_due <= 0 means the first period is fully covered (e.g. a
  // 100%-off-first-month referee coupon, or an account credit that zeroes the
  // invoice). "Your subscription will begin at $0.00/month" would contradict the
  // "your first payment will be charged then" framing, so drop the billing line
  // rather than quote a $0 charge — the reminder still sends without it.
  if (typeof upcoming.amount_due !== 'number' || upcoming.amount_due <= 0) return null;
  const money = formatMoney(upcoming.amount_due, upcoming.currency);
  if (!money) return null;
  const chargeLabel = interval ? `${money}/${interval}` : money;

  // The card is best-effort: a resolvable charge with no nameable card (Link /
  // wallet) still yields a billing line — the price with neutral wording — so we
  // do NOT null the result here. Only a missing/zero charge (handled above) does.
  const card = await resolveCard(stripe, sub, customerId);
  return {
    chargeLabel,
    cardBrand: card ? formatCardBrand(card.brand) : null,
    cardLast4: card ? card.last4 : null,
  };
}

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  usage();
  process.exit(0);
}

const exclusiveFlags = [
  cliArgs.dryRun,
  cliArgs.yes,
  !!cliArgs.previewTo,
  !!cliArgs.render,
].filter(Boolean).length;
if (exclusiveFlags > 1) {
  console.error('Error: --dry-run, --yes, --preview-to, and --render are mutually exclusive.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));

const RESEND_API_KEY = process.env.RESEND_API_KEY || envLocal.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || envLocal.RESEND_FROM_EMAIL;
const NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || '';
// Optional: used only to enrich the reminder with the exact post-trial charge
// and the card on file. Absent key => reminders still send, minus that line.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || envLocal.STRIPE_SECRET_KEY;

if ((cliArgs.yes || cliArgs.previewTo) && (!RESEND_API_KEY || !RESEND_FROM_EMAIL)) {
  console.error('Error: RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send emails.');
  process.exit(1);
}

// mailer.ts reads these lazily inside getClient()/getFromAddress(), so
// stuffing them into process.env after the static import is correct.
if (RESEND_API_KEY) process.env.RESEND_API_KEY = RESEND_API_KEY;
if (RESEND_FROM_EMAIL) process.env.RESEND_FROM_EMAIL = RESEND_FROM_EMAIL;
if (NEXT_PUBLIC_APP_URL) process.env.NEXT_PUBLIC_APP_URL = NEXT_PUBLIC_APP_URL;

if (cliArgs.previewTo) {
  const sample = new Date(Date.now() + TARGET_HOURS * 3600_000).toISOString();
  console.log(`Sending preview to ${cliArgs.previewTo} (sample trial end ${sample})...`);
  // Sample billing so the preview renders the charge/card line. Real sends pull
  // these live from Stripe per user (see resolveBillingDetails); this is just
  // representative data for eyeballing the layout.
  await sendTrialReminderEmail(cliArgs.previewTo, {
    trialEndIso: sample,
    billing: { chargeLabel: '$29.00/month', cardBrand: 'Visa', cardLast4: '4242' },
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

// --render <email>: dry-run preview of one member's REAL reminder. Resolves the
// same live-from-Stripe charge + card the send loop would, builds the exact wire
// copy via buildTrialReminderEmail, and writes it to files — no send, no DB
// writes, and it ignores both the send window and the sent-latch so any member
// (already-nudged or not) can be previewed on demand.
if (cliArgs.render) {
  const email = cliArgs.render;
  const rows = querySqlite<UserRow>(
    dbPath,
    `SELECT id, email, current_period_end, stripe_customer_id, stripe_subscription_id
     FROM users
     WHERE email = '${escapeSqlLiteral(email)}'
     LIMIT 1;`,
  );
  const user = rows[0];
  if (!user) {
    console.error(`No user found with email ${email}.`);
    process.exit(1);
  }
  if (!user.current_period_end) {
    console.error(
      `User ${email} has no current_period_end (not on a trial/subscription); nothing to render.`,
    );
    process.exit(1);
  }

  // Best-effort Stripe enrichment, identical to the send loop: no key or a
  // per-user Stripe error just drops the charge/card line from the preview.
  const stripeForRender: Stripe | null = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
  if (!stripeForRender) {
    console.warn('Warning: STRIPE_SECRET_KEY not set — rendering WITHOUT the charge/card line.');
  }
  let billing: BillingDetails | null = null;
  if (stripeForRender) {
    try {
      billing = await resolveBillingDetails(
        stripeForRender,
        user.stripe_customer_id,
        user.stripe_subscription_id,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      console.warn(
        `Could not resolve Stripe billing details (${message}); rendering without the charge/card line.`,
      );
    }
  }

  const { subject, html, text } = buildTrialReminderEmail({
    trialEndIso: user.current_period_end,
    billing,
  });

  const outDir = cliArgs.out ?? os.tmpdir();
  const safeName = email.replace(/[^a-zA-Z0-9._-]/g, '_');
  const htmlPath = path.join(outDir, `zerogex-trial-reminder-${safeName}.html`);
  const textPath = path.join(outDir, `zerogex-trial-reminder-${safeName}.txt`);
  fs.writeFileSync(htmlPath, html);
  fs.writeFileSync(textPath, text);

  console.log(`Rendered trial reminder for ${email} — NOT sent, no DB writes.`);
  console.log(`Trial end:     ${user.current_period_end}`);
  console.log(`Subject:       ${subject}`);
  console.log(
    `Billing line:  ${
      billing
        ? billing.cardLast4
          ? `included — ${billing.chargeLabel} on ${billing.cardBrand ?? 'card'} ending ${billing.cardLast4}`
          : `included — ${billing.chargeLabel}, neutral method (no nameable card on file)`
        : 'omitted (no resolvable upcoming charge)'
    }`,
  );
  console.log(`HTML file:     ${htmlPath}`);
  console.log(`Text file:     ${textPath}`);
  console.log('\n----- text version -----\n');
  console.log(text);
  process.exit(0);
}

// Compute the inclusive [low, high] ISO bounds bracketing now+48h. SQLite
// compares ISO strings lexicographically, which works because Stripe writes
// strict ISO-8601 with the 'Z' suffix into current_period_end.
const nowMs = Date.now();
const halfWindowMs = (cliArgs.windowHours * 3600_000) / 2;
const targetMs = nowMs + TARGET_HOURS * 3600_000;
const lowIso = new Date(targetMs - halfWindowMs).toISOString();
const highIso = new Date(targetMs + halfWindowMs).toISOString();

type UserRow = {
  id: string;
  email: string;
  current_period_end: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

const eligible = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, current_period_end, stripe_customer_id, stripe_subscription_id
   FROM users
   WHERE subscription_status = 'trialing'
     AND trial_reminder_email_sent_at IS NULL
     AND current_period_end IS NOT NULL
     AND current_period_end >= '${escapeSqlLiteral(lowIso)}'
     AND current_period_end <= '${escapeSqlLiteral(highIso)}'
   ORDER BY current_period_end ASC;`,
);

console.log(`Auth DB:          ${dbPath}`);
console.log(`Window:           ${lowIso}  →  ${highIso}`);
console.log(`Eligible users:   ${eligible.length}`);

if (eligible.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

const sample = eligible.slice(0, 10);
for (const u of sample) {
  console.log(`  - ${u.email}: trial ends ${u.current_period_end}`);
}
if (eligible.length > sample.length) {
  console.log(`  ... and ${eligible.length - sample.length} more`);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No emails sent, no audit rows written.');
  process.exit(0);
}

if (!cliArgs.yes) {
  console.log(
    '\nRefusing to send without --yes. Re-run with --yes to deliver, or --dry-run to preview.',
  );
  process.exit(1);
}

// Best-effort Stripe enrichment for the charge/card line. Stripe is optional
// plumbing here: when the key is unset we warn once and send every reminder
// without that line rather than blocking the whole run — the cancel-in-time
// nudge matters more than the line. A per-user lookup failure is handled the
// same way inside the loop.
const stripe: Stripe | null = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
if (!stripe) {
  console.warn(
    '\nWarning: STRIPE_SECRET_KEY is not set — reminders will send WITHOUT the exact charge/card line.',
  );
}

let successCount = 0;
let failCount = 0;

for (const user of eligible) {
  try {
    // Resolve the exact charge + card on file. Non-fatal: a Stripe hiccup for
    // one user drops just that user's billing line, never their reminder.
    let billing: BillingDetails | null = null;
    if (stripe) {
      try {
        billing = await resolveBillingDetails(
          stripe,
          user.stripe_customer_id,
          user.stripe_subscription_id,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        console.warn(
          `  WARN ${user.email}: could not resolve Stripe billing details (${message}); sending without the charge/card line.`,
        );
      }
    }

    await sendTrialReminderEmail(user.email, {
      trialEndIso: user.current_period_end,
      billing,
    });
    const nowIso = new Date().toISOString();
    // Stamp the latch FIRST so a partial run that crashes after some sends
    // doesn't re-send to anyone who already received. The audit row is
    // best-effort; the latch is the source of truth for idempotency.
    execSqlite(
      dbPath,
      `UPDATE users
       SET trial_reminder_email_sent_at = '${escapeSqlLiteral(nowIso)}',
           updated_at = '${escapeSqlLiteral(nowIso)}'
       WHERE id = '${escapeSqlLiteral(user.id)}';`,
    );

    const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
    execSqlite(
      dbPath,
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (
         '${escapeSqlLiteral(auditId)}',
         'trial_reminder_email_sent',
         '${escapeSqlLiteral(user.id)}',
         NULL,
         '${escapeSqlLiteral(user.email)}',
         'cron-script',
         '${escapeSqlLiteral(`Trial-end reminder sent; current_period_end=${user.current_period_end}`)}',
         '${escapeSqlLiteral(nowIso)}'
       );`,
    );
    successCount++;
  } catch (err) {
    failCount++;
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  FAIL ${user.email}: ${message}`);
  }
}

console.log(`\nDone. ${successCount} sent, ${failCount} failed.`);
process.exit(failCount > 0 ? 1 : 0);
