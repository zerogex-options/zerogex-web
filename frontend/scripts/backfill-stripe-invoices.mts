#!/usr/bin/env node
// Run from the frontend/ directory (or via `make backfill-stripe-invoices`):
//   node --experimental-strip-types scripts/backfill-stripe-invoices.mts
//
// Imports the REAL successful-invoice history from Stripe into
// `stripe_invoice_history`, which is what the renewal metrics on
// Admin → Monitoring → Growth read.
//
// WHY THIS EXISTS
//
// A renewal is money moving a second time. It cannot be inferred from access
// having lasted about a month — that counts a customer who cancelled on day 25
// of a 30-day period as retained — so it has to be SEEN, in an invoice whose
// `billing_reason` is `subscription_cycle`.
//
// The app only started writing `stripe_invoice_paid` audit rows when that event
// type shipped, so every renewal that fell due before then is invisible in
// audit_events. Without this import the dashboard can only report those
// customers as "unobservable" (which it does, honestly, rather than calling them
// churn) and the first-renewal denominator stays near zero for weeks. This
// script fills in the history that already exists in Stripe.
//
// WHAT IT DOES NOT DO
//
//   * It never writes to Stripe. Every call is a list/read.
//   * It never touches users, audit_events, subscriptions, tiers or access. The
//     only table it writes is stripe_invoice_history, which nothing in the
//     billing path reads.
//   * It never changes what a customer is charged or what they can see.
//
// It is idempotent: invoice_id is the primary key and rows are upserted, so
// re-running after more invoices exist simply adds them.
//
// Flags / environment:
//   STRIPE_SECRET_KEY   required; read from env or .env.local
//   AUTH_DB_PATH        which SQLite file to write (same rule as the app)
//   SINCE=<YYYY-MM-DD>  only import invoices created on or after this date
//   LIMIT=<n>           stop after n invoices (smoke test)
//   DRY_RUN=1           fetch and report, write nothing
//
// IMPORTANT: core/db.ts reads AUTH_DB_PATH from process.env only — it does NOT
// load .env.local the way Next.js does at app boot. The file is hoisted into
// process.env before the dynamic import below; a static import would be hoisted
// above the mutation and open the wrong database.

import fs from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';

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
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const envLocal = parseEnvFile(path.join(process.cwd(), '.env.local'));
for (const key of ['AUTH_DB_PATH', 'STRIPE_SECRET_KEY']) {
  if (envLocal[key] && !process.env[key]) process.env[key] = envLocal[key];
}

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('STRIPE_SECRET_KEY is not set (env or .env.local). Nothing to do.');
  process.exit(1);
}

const dryRun = process.env.DRY_RUN === '1';
const limit = Number(process.env.LIMIT) > 0 ? Number(process.env.LIMIT) : Infinity;
const sinceRaw = process.env.SINCE;
const sinceUnix = sinceRaw ? Math.floor(Date.parse(`${sinceRaw}T00:00:00Z`) / 1000) : undefined;
if (sinceRaw && !Number.isFinite(sinceUnix)) {
  console.error(`SINCE="${sinceRaw}" is not a YYYY-MM-DD date.`);
  process.exit(1);
}

const { getDb } = await import('../core/db.ts');
const db = getDb();

// customer id → user id, so an invoice can be attributed without a second
// lookup per row. Deleted accounts are included on purpose: their invoices are
// real history, and the dashboard excludes the accounts it needs to exclude by
// its own rule (core/excludedAccounts.ts), not by who is still signed up.
const customerToUser = new Map<string, string>();
for (const row of db
  .prepare('SELECT id, stripe_customer_id FROM users WHERE stripe_customer_id IS NOT NULL')
  .all() as Array<{ id: string; stripe_customer_id: string }>) {
  customerToUser.set(row.stripe_customer_id, row.id);
}
console.log(`${customerToUser.size} Stripe customers mapped to local accounts.`);

const stripe = new Stripe(secretKey);

const upsert = db.prepare(`
  INSERT INTO stripe_invoice_history
    (invoice_id, user_id, customer_id, subscription_id, price_id, status,
     billing_reason, amount_paid, currency, paid_at, period_start, period_end, imported_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(invoice_id) DO UPDATE SET
    user_id = excluded.user_id,
    subscription_id = excluded.subscription_id,
    price_id = excluded.price_id,
    status = excluded.status,
    billing_reason = excluded.billing_reason,
    amount_paid = excluded.amount_paid,
    currency = excluded.currency,
    paid_at = excluded.paid_at,
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    imported_at = excluded.imported_at
`);

const isoOf = (unix: number | null | undefined): string | null =>
  unix == null || !Number.isFinite(unix) ? null : new Date(unix * 1000).toISOString();

type Counters = { seen: number; written: number; unmatched: number; zero: number };
const counters: Counters = { seen: 0, written: 0, unmatched: 0, zero: 0 };
const byReason = new Map<string, number>();
let earliest: string | null = null;
let latest: string | null = null;

const importedAt = new Date().toISOString();

// `status: 'paid'` is the whole population that matters: an invoice that never
// cleared is not a payment, and a renewal that failed shows up in the audit
// trail as a payment failure instead.
for await (const invoice of stripe.invoices.list({
  status: 'paid',
  limit: 100,
  ...(sinceUnix ? { created: { gte: sinceUnix } } : {}),
})) {
  if (counters.seen >= limit) break;
  counters.seen += 1;

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
  const userId = customerId ? customerToUser.get(customerId) ?? null : null;
  if (!userId) {
    counters.unmatched += 1;
    continue;
  }
  if (!invoice.amount_paid) {
    // A zero invoice is a fully-discounted period, not money moving. Kept out so
    // it can never be mistaken for a renewal payment.
    counters.zero += 1;
    continue;
  }

  const line = invoice.lines?.data?.[0];
  const subscriptionField = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
  const subscriptionId = typeof subscriptionField === 'string'
    ? subscriptionField
    : subscriptionField?.id
      ?? (typeof line?.subscription === 'string' ? line.subscription : line?.subscription?.id)
      ?? null;
  const priceId = line?.pricing?.price_details?.price
    ?? (line as unknown as { price?: { id?: string } } | undefined)?.price?.id
    ?? null;
  const paidAt = isoOf(invoice.status_transitions?.paid_at ?? invoice.created);
  const period = line?.period;

  byReason.set(invoice.billing_reason ?? 'unknown', (byReason.get(invoice.billing_reason ?? 'unknown') ?? 0) + 1);
  if (paidAt && (earliest == null || paidAt < earliest)) earliest = paidAt;
  if (paidAt && (latest == null || paidAt > latest)) latest = paidAt;

  if (!dryRun) {
    upsert.run(
      invoice.id ?? `unknown_${counters.seen}`,
      userId,
      customerId,
      subscriptionId,
      priceId,
      'paid',
      invoice.billing_reason ?? null,
      invoice.amount_paid,
      invoice.currency ?? null,
      paidAt ?? importedAt,
      isoOf(period?.start),
      isoOf(period?.end),
      importedAt,
    );
  }
  counters.written += 1;
  if (counters.seen % 200 === 0) console.log(`  …${counters.seen} invoices scanned`);
}

console.log('');
console.log(`Invoices scanned:        ${counters.seen}`);
console.log(`Imported:                ${counters.written}${dryRun ? ' (DRY_RUN — nothing written)' : ''}`);
console.log(`Skipped, no local user:  ${counters.unmatched}`);
console.log(`Skipped, zero amount:    ${counters.zero}`);
console.log(`Paid between:            ${earliest ?? '—'} … ${latest ?? '—'}`);
console.log('By billing reason:');
for (const [reason, count] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
  const note = reason === 'subscription_cycle' ? '  ← renewals'
    : reason === 'subscription_create' ? '  ← first payments'
    : reason === 'subscription_update' ? '  ← prorations, never counted as renewals'
    : '';
  console.log(`  ${reason.padEnd(24)} ${String(count).padStart(6)}${note}`);
}
if (!dryRun) {
  const stored = db.prepare('SELECT COUNT(*) AS c, MIN(paid_at) AS first FROM stripe_invoice_history').get() as { c: number; first: string | null };
  console.log('');
  console.log(`stripe_invoice_history now holds ${stored.c} invoices, earliest ${stored.first ?? '—'}.`);
  console.log('Reload Admin → Monitoring → Growth; the renewal ladder reads this table.');
}
