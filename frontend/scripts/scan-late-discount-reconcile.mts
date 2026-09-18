#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/scan-late-discount-reconcile.mts
//   node --experimental-strip-types --no-warnings scripts/scan-late-discount-reconcile.mts --since 2026-06-01 --csv
//
// Read-only. Sizes and names the cohort charged the WRONG amount for one cycle
// because a plan switch reconciled its coupons a moment too late.
//
// THE BUG (fixed forward in app/api/webhooks/stripe/route.ts —
// reconcileDiscountOnOpenInvoice; this script finds everyone hit BEFORE that):
//
//   1. The billing portal schedules downgrades at period end
//      (schedule_at_period_end — scripts/setup-billing-portal.mts). For a
//      TRIALING member, period end is trial end.
//   2. At that boundary Stripe applies the new price, flips the subscription to
//      `active`, and DRAWS THE FIRST INVOICE — all at once.
//   3. Our webhook reacts to that `active` event and calls
//      maybeReconcileDiscountOnPlanSwitch, which swaps the coupon via
//      subscriptions.update. That binds the NEXT cycle. The invoice already
//      drawn keeps whatever discounts existed seconds earlier.
//
// So the member is billed at the wrong rate exactly once: too MUCH when the
// incoming plan's promo never lands, too LITTLE when the outgoing plan's promo
// rides along. The audit row billing_discount_reconciled_on_switch is the
// fingerprint — this script pairs each one with the invoice drawn just before it
// and prices the difference.
//
// The verdict uses core/stripeInvoice.ts's decideLateDiscountFix — the same
// function the webhook now calls — so this scan and the live fix can never
// disagree about what counts as mispriced.
//
// MONEY IS APPROXIMATE where several coupons stack: each is priced against the
// invoice subtotal independently, while Stripe applies them in sequence. Single
// -coupon cases (effectively all of them) are exact. Always confirm against the
// hosted invoice before issuing a credit.
//
// Writes nothing. Calls Stripe read-only. Never touches Resend.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import Stripe from 'stripe';

import { decideLateDiscountFix, readInvoiceCouponIds } from '../core/stripeInvoice.ts';

const RECONCILE_AUDIT_TYPES = [
  'billing_discount_reconciled_on_switch',
  'billing_discount_reconciled_manual',
];

type Args = {
  since: string | null;
  windowMinutes: number;
  csv: boolean;
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
  const args: Args = { since: null, windowMinutes: 15, csv: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--since') args.since = (argv[(i += 1)] ?? '').trim() || null;
    else if (arg === '--window-minutes') args.windowMinutes = Number(argv[(i += 1)]);
    else if (arg === '--csv') args.csv = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  if (!Number.isFinite(args.windowMinutes) || args.windowMinutes <= 0) args.windowMinutes = 15;
  // A switch reconciles seconds after the invoice is drawn; a wide window only
  // risks pairing an audit row with an unrelated earlier invoice.
  args.windowMinutes = Math.min(args.windowMinutes, 120);
  return args;
}

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  console.log(`
Usage: scan-late-discount-reconcile.mts [--since YYYY-MM-DD] [--window-minutes N] [--csv]

Lists members whose plan switch reconciled its coupons AFTER Stripe had already
drawn that cycle's invoice, with the amount over- or under-charged.

  --since YYYY-MM-DD   Only audit rows on/after this date (default: all).
  --window-minutes N   How far BEFORE the audit row to look for the invoice it
                       raced (default 15, max 120).
  --csv                Machine-readable rows instead of the table.

Read-only: no writes, no emails, Stripe reads only. Reads STRIPE_SECRET_KEY and
AUTH_DB_PATH from env or .env.local.
`);
  process.exit(0);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const stripeKey = process.env.STRIPE_SECRET_KEY || envLocal.STRIPE_SECRET_KEY;
const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');

if (!stripeKey) {
  console.error('Error: STRIPE_SECRET_KEY not set (env or frontend/.env.local).');
  process.exit(1);
}
if (!fs.existsSync(dbPath)) {
  console.error(`Error: auth DB not found at ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

const stripe = new Stripe(stripeKey);
const db = new DatabaseSync(dbPath, { readOnly: true });

// stripped [a, b], applied [c] — 'none' is the empty marker the webhook writes.
const MESSAGE_RE =
  /on sub (sub_[A-Za-z0-9]+).*?: stripped \[([^\]]*)\], applied \[([^\]]*)\]/;

function couponList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== 'none');
}

function money(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

type Row = {
  email: string;
  at: string;
  sub: string;
  invoice: string;
  status: string;
  charged: number;
  should: number;
  delta: number;
  currency: string;
  missing: string[];
  stale: string[];
};

const placeholders = RECONCILE_AUDIT_TYPES.map(() => '?').join(', ');
const params: (string | number)[] = [...RECONCILE_AUDIT_TYPES];
let sql = `SELECT email, message, created_at FROM audit_events WHERE type IN (${placeholders})`;
if (cliArgs.since) {
  sql += ' AND created_at >= ?';
  params.push(cliArgs.since);
}
sql += ' ORDER BY created_at ASC';

const auditRows = db.prepare(sql).all(...params) as Array<{
  email: string | null;
  message: string;
  created_at: string;
}>;

const couponCache = new Map<string, Stripe.Coupon | null>();
async function getCoupon(id: string): Promise<Stripe.Coupon | null> {
  if (couponCache.has(id)) return couponCache.get(id) ?? null;
  try {
    const c = await stripe.coupons.retrieve(id);
    couponCache.set(id, c);
    return c;
  } catch {
    couponCache.set(id, null);
    return null;
  }
}

// What this coupon would take off a subtotal, in minor units.
async function couponValue(id: string, subtotal: number): Promise<number> {
  const c = await getCoupon(id);
  if (!c) return 0;
  if (typeof c.amount_off === 'number') return Math.min(c.amount_off, subtotal);
  if (typeof c.percent_off === 'number') return Math.round((subtotal * c.percent_off) / 100);
  return 0;
}

const rows: Row[] = [];
let skippedNoInvoice = 0;
let skippedClean = 0;
let noMoneyAtStake = 0;

for (const audit of auditRows) {
  const match = MESSAGE_RE.exec(audit.message);
  if (!match) continue;
  const [, subId, strippedRaw, appliedRaw] = match;

  const intended = couponList(appliedRaw);
  const managed = [...new Set([...intended, ...couponList(strippedRaw)])];

  const auditUnix = Math.floor(new Date(audit.created_at).getTime() / 1000);
  if (!Number.isFinite(auditUnix)) continue;

  let invoices: Stripe.ApiList<Stripe.Invoice>;
  try {
    invoices = await stripe.invoices.list({
      subscription: subId,
      limit: 10,
      expand: ['data.discounts'],
    });
  } catch {
    skippedNoInvoice += 1;
    continue;
  }

  // The invoice this reconcile raced: drawn at or just before the audit row.
  const windowSec = cliArgs.windowMinutes * 60;
  const invoice = invoices.data.find(
    (inv) => inv.created <= auditUnix && inv.created >= auditUnix - windowSec,
  );
  if (!invoice?.id) {
    skippedNoInvoice += 1;
    continue;
  }

  const decision = decideLateDiscountFix({
    invoiceStatus: invoice.status,
    invoiceCouponIds: readInvoiceCouponIds(invoice),
    intendedCouponIds: intended,
    managedCouponIds: managed,
  });
  if (decision.action === 'none') {
    skippedClean += 1;
    continue;
  }

  const subtotal = invoice.subtotal ?? invoice.total;
  let intendedDiscount = 0;
  for (const id of intended) intendedDiscount += await couponValue(id, subtotal);
  const should = Math.max(0, subtotal - intendedDiscount);
  const delta = invoice.total - should;

  // No money at stake, so nothing was mispriced — drop it before it reaches the
  // table. Overwhelmingly this is the HEALTHY path: a switch made mid-trial
  // reconciles while the subscription is still `trialing`, and the newest
  // invoice behind it is the $0.00 one Stripe draws at trial start. That
  // invoice genuinely lacks the coupon, so the discount comparison flags it —
  // but $0 discounted by anything is still $0, and the coupon lands correctly
  // on the trial-end invoice that follows. The webhook skips these via its
  // `status !== 'active'` guard; the scan reads audit rows after the fact and
  // has no status to guard on, so it settles the question with the money.
  if (delta === 0) {
    noMoneyAtStake += 1;
    continue;
  }

  rows.push({
    email: audit.email || '(unknown)',
    at: audit.created_at,
    sub: subId,
    invoice: invoice.id,
    status: invoice.status ?? 'unknown',
    charged: invoice.total,
    should,
    delta,
    currency: invoice.currency || 'usd',
    missing: decision.missing,
    stale: decision.stale,
  });
}

db.close();

if (cliArgs.csv) {
  console.log('email,audit_at,subscription,invoice,status,charged_minor,should_minor,delta_minor,currency,missing,stale');
  for (const r of rows) {
    console.log(
      [
        r.email,
        r.at,
        r.sub,
        r.invoice,
        r.status,
        r.charged,
        r.should,
        r.delta,
        r.currency,
        `"${r.missing.join(' ')}"`,
        `"${r.stale.join(' ')}"`,
      ].join(','),
    );
  }
  process.exit(0);
}

const over = rows.filter((r) => r.delta > 0);
const under = rows.filter((r) => r.delta < 0);
const overTotal = over.reduce((sum, r) => sum + r.delta, 0);
const underTotal = under.reduce((sum, r) => sum + r.delta, 0);
const currency = rows[0]?.currency ?? 'usd';

console.log(`Auth DB: ${dbPath}`);
console.log(
  `Scanned: ${auditRows.length} plan-switch reconcile events${cliArgs.since ? ` since ${cliArgs.since}` : ''}`,
);
console.log(
  `Charged wrong: ${rows.length}  ·  ${noMoneyAtStake} reconciled with no money at stake ` +
    `(mid-trial switches ahead of a $0 invoice)  ·  ${skippedClean} already correct  ·  ` +
    `${skippedNoInvoice} with no invoice in the ${cliArgs.windowMinutes}m window\n`,
);

if (rows.length === 0) {
  console.log('Nobody was charged the wrong amount. Nothing to credit.');
  process.exit(0);
}

const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));
console.log(
  `${pad('MEMBER', 34)}${pad('WHEN', 21)}${pad('INVOICE', 29)}${pad('STATUS', 8)}${pad('CHARGED', 12)}${pad('SHOULD BE', 12)}DELTA`,
);
console.log('-'.repeat(132));
for (const r of rows.sort((a, b) => b.delta - a.delta)) {
  const sign = r.delta > 0 ? '+' : '';
  console.log(
    pad(r.email, 34) +
      pad(r.at.slice(0, 19).replace('T', ' '), 21) +
      pad(r.invoice, 29) +
      pad(r.status, 8) +
      pad(money(r.charged, r.currency), 12) +
      pad(money(r.should, r.currency), 12) +
      `${sign}${(r.delta / 100).toFixed(2)}`,
  );
  const detail = [
    r.missing.length ? `never applied: ${r.missing.join(', ')}` : '',
    r.stale.length ? `rode along: ${r.stale.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('  ·  ');
  if (detail) console.log(`${' '.repeat(34)}${detail}`);
}

console.log(`\nRead:`);
if (over.length) {
  console.log(
    `  • OVERCHARGED: ${over.length} member(s), ${money(overTotal, currency)} owed back. These are the ones to credit —`,
  );
  console.log(
    `    they paid full rate for a plan whose promo the switch was supposed to carry across.`,
  );
}
if (under.length) {
  console.log(
    `  • UNDERCHARGED: ${under.length} member(s), ${money(Math.abs(underTotal), currency)} short — the outgoing plan's`,
  );
  console.log(
    `    coupon rode along one cycle. Almost certainly write off: clawing it back costs more than it recovers.`,
  );
}
console.log(
  `  • Each member is affected for ONE cycle only; the reconciled coupon binds every cycle after it.`,
);
console.log(`\nHow to make each one whole depends on whether they are staying:`);
console.log(
  `  • STAYING — a negative customer balance transaction (the mechanism`,
);
console.log(`    scripts/back-credit-trial.mts uses); Stripe auto-applies it to the next invoice.`);
console.log(
  `  • LEAVING or already gone — REFUND the invoice instead. A balance credit is applied to`,
);
console.log(
  `    a next invoice that will never be drawn, so it silently returns nothing. Being`,
);
console.log(
  `    overcharged is itself a reason to cancel, so expect this column to skew to leavers:`,
);
console.log(`    check each member's cancel_at_period_end before choosing.`);
console.log(`\nConfirm the amount on the hosted invoice before either.`);
