#!/usr/bin/env node
// Run from the frontend/ directory (or via `make audit-trial-conversions`):
//   node --experimental-strip-types scripts/audit-trial-conversions.mts
//
// READ-ONLY forensic audit of why trial conversions fail. Answers the questions
// the local decline table cannot, because they live in Stripe: what payment
// method was actually set up, whether its SetupIntent completed, how many times
// each invoice was really attempted, and — for every invoice still unpaid —
// whether Stripe is going to try again or has stopped.
//
// WHY THIS IS SEPARATE from `make backfill-payment-declines`. That command
// WRITES: it reconstructs rows and stamps reasons onto them. This one writes
// nothing at all, anywhere. It exists so an investigation can be run as often as
// you like, on production, without changing a single row — including while you
// are still deciding whether the numbers can be trusted.
//
// IT NEVER: creates, updates, voids or pays an invoice; creates or cancels a
// subscription; charges anything; attaches or detaches a payment method;
// contacts a customer; or writes to the local database. Every Stripe call below
// is a list or a retrieve.
//
// Flags / environment:
//   AUTH_DB_PATH        which SQLite file to read (same rule as the app)
//   STRIPE_SECRET_KEY   required; read from env or .env.local
//   DAYS=<n>            window, in days back from now (default 90)
//   LIMIT=<n>           cap subscriptions examined (default 400)
//   JSON=<path>         also write the full per-subscription detail as JSON

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
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
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

const days = Number(process.env.DAYS) > 0 ? Number(process.env.DAYS) : 90;
const limit = Number(process.env.LIMIT) > 0 ? Number(process.env.LIMIT) : 400;
const jsonPath = process.env.JSON;
const sinceUnix = Math.floor(Date.now() / 1000) - days * 86_400;

const stripe = new Stripe(secretKey);

type Row = {
  subscriptionId: string;
  status: string;
  created: string;
  trialEnd: string | null;
  /** What the card is: card / link / cashapp / …, from the default payment method. */
  methodType: string | null;
  cardBrand: string | null;
  cardFunding: string | null;
  cardCountry: string | null;
  /** Did the trial's SetupIntent actually complete? */
  setupStatus: string | null;
  /** The first REAL charge after the trial. */
  firstInvoiceId: string | null;
  firstInvoiceStatus: string | null;
  firstInvoicePaid: boolean;
  attempts: number;
  failedCharges: number;
  firstDeclineCode: string | null;
  nextAttemptAt: string | null;
  collectionMethod: string | null;
  amountDue: number;
};

const rows: Row[] = [];
const iso = (unix: number | null | undefined) =>
  unix == null || !Number.isFinite(unix) ? null : new Date(unix * 1000).toISOString();

function idOf(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object' && typeof (ref as { id?: unknown }).id === 'string') return (ref as { id: string }).id;
  return null;
}

console.log(`Auditing subscriptions created in the last ${days} days (limit ${limit})…\n`);

let seen = 0;
for await (const sub of stripe.subscriptions.list({
  created: { gte: sinceUnix },
  status: 'all',
  limit: 100,
  expand: ['data.default_payment_method', 'data.pending_setup_intent'],
})) {
  if (seen >= limit) break;
  seen += 1;

  // Only subscriptions that HAD a trial are in scope: this audit is about the
  // trial-to-paid step, and a no-trial signup never takes it.
  if (!sub.trial_end) continue;

  const pm = sub.default_payment_method;
  const pmObject = pm && typeof pm === 'object' ? (pm as Stripe.PaymentMethod) : null;
  const psi = sub.pending_setup_intent;
  const psiObject = psi && typeof psi === 'object' ? (psi as Stripe.SetupIntent) : null;

  const row: Row = {
    subscriptionId: sub.id,
    status: sub.status,
    created: iso(sub.created) ?? '',
    trialEnd: iso(sub.trial_end),
    methodType: pmObject?.type ?? null,
    cardBrand: pmObject?.card?.brand ?? null,
    cardFunding: pmObject?.card?.funding ?? null,
    cardCountry: pmObject?.card?.country ?? null,
    setupStatus: psiObject?.status ?? (psi == null ? 'none-pending' : 'unexpanded'),
    firstInvoiceId: null,
    firstInvoiceStatus: null,
    firstInvoicePaid: false,
    attempts: 0,
    failedCharges: 0,
    firstDeclineCode: null,
    nextAttemptAt: null,
    collectionMethod: null,
    amountDue: 0,
  };

  // The first invoice with real money on it — the conversion charge.
  const invoices = await stripe.invoices.list({ subscription: sub.id, limit: 20 });
  const billed = invoices.data
    .filter((invoice) => (invoice.amount_due ?? 0) > 0)
    .sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
  const first = billed[0];
  if (first) {
    row.firstInvoiceId = first.id ?? null;
    row.firstInvoiceStatus = first.status ?? null;
    row.firstInvoicePaid = first.status === 'paid';
    row.attempts = first.attempt_count ?? 0;
    row.nextAttemptAt = iso(first.next_payment_attempt);
    row.collectionMethod = first.collection_method ?? null;
    row.amountDue = first.amount_due ?? 0;

    // Every charge the invoice's payment intents produced, so a FAILED one is
    // visible even after the invoice was later paid.
    const intentId = idOf((first as unknown as { payment_intent?: unknown }).payment_intent);
    if (intentId) {
      const charges = await stripe.charges.list({ payment_intent: intentId, limit: 100 });
      const failed = charges.data.filter((charge) => charge.status === 'failed').sort((a, b) => a.created - b.created);
      row.failedCharges = failed.length;
      const outcome = failed[0]?.outcome as { reason?: string | null } | undefined;
      row.firstDeclineCode = outcome?.reason ?? failed[0]?.failure_code ?? null;
    }
  }
  rows.push(row);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const pct = (n: number, d: number) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`);
const tally = (key: (row: Row) => string | null, filter: (row: Row) => boolean = () => true) => {
  const counts = new Map<string, { total: number; failed: number }>();
  for (const row of rows.filter(filter)) {
    if (!row.firstInvoiceId) continue;
    const k = key(row) ?? '(unknown)';
    const cell = counts.get(k) ?? { total: 0, failed: 0 };
    cell.total += 1;
    if (row.failedCharges > 0) cell.failed += 1;
    counts.set(k, cell);
  }
  return [...counts.entries()].sort((a, b) => b[1].total - a[1].total);
};

const billedRows = rows.filter((row) => row.firstInvoiceId);
const declined = billedRows.filter((row) => row.failedCharges > 0);

console.log(`Trials examined:            ${rows.length}`);
console.log(`Reached a real first charge:${String(billedRows.length).padStart(5)}`);
console.log(`  of those, declined at least once: ${declined.length} (${pct(declined.length, billedRows.length)})`);
console.log(`  eventually paid:                  ${billedRows.filter((r) => r.firstInvoicePaid).length}`);

console.log('\n── Setup readiness at the time of the charge ──');
for (const [status, cell] of tally((row) => row.setupStatus)) {
  console.log(`  ${status.padEnd(24)} ${String(cell.total).padStart(4)} charged · ${String(cell.failed).padStart(4)} declined (${pct(cell.failed, cell.total)})`);
}

console.log('\n── By payment method type ── (off-session reliability differs sharply)');
for (const [type, cell] of tally((row) => row.methodType)) {
  console.log(`  ${type.padEnd(24)} ${String(cell.total).padStart(4)} charged · ${String(cell.failed).padStart(4)} declined (${pct(cell.failed, cell.total)})`);
}

console.log('\n── By card brand ──');
for (const [brand, cell] of tally((row) => row.cardBrand)) {
  console.log(`  ${brand.padEnd(24)} ${String(cell.total).padStart(4)} charged · ${String(cell.failed).padStart(4)} declined (${pct(cell.failed, cell.total)})`);
}

console.log('\n── By card funding ── (prepaid and debit decline differently)');
for (const [funding, cell] of tally((row) => row.cardFunding)) {
  console.log(`  ${funding.padEnd(24)} ${String(cell.total).padStart(4)} charged · ${String(cell.failed).padStart(4)} declined (${pct(cell.failed, cell.total)})`);
}

console.log('\n── By issuing country ──');
for (const [country, cell] of tally((row) => row.cardCountry).slice(0, 15)) {
  console.log(`  ${country.padEnd(24)} ${String(cell.total).padStart(4)} charged · ${String(cell.failed).padStart(4)} declined (${pct(cell.failed, cell.total)})`);
}

console.log('\n── Attempts actually made on declined invoices ──');
const byAttempts = new Map<number, number>();
for (const row of declined) byAttempts.set(row.attempts, (byAttempts.get(row.attempts) ?? 0) + 1);
for (const [attempts, count] of [...byAttempts.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${String(attempts).padStart(2)} attempt(s)  ${count} invoice(s)`);
}
console.log('  If declined invoices stop at 1 attempt, Stripe Smart Retries may be off in the Dashboard.');

console.log('\n── Still unpaid: is Stripe going to try again? ──');
const unpaid = billedRows.filter((row) => row.firstInvoiceStatus === 'open');
if (unpaid.length === 0) {
  console.log('  Nothing open.');
} else {
  for (const row of unpaid) {
    const state = row.collectionMethod === 'send_invoice'
      ? 'MANUAL COLLECTION — Stripe will never charge it'
      : row.nextAttemptAt
        ? `retry scheduled ${row.nextAttemptAt}`
        : 'NO RETRY SCHEDULED — Stripe has stopped';
    console.log(`  ${row.firstInvoiceId}  $${(row.amountDue / 100).toFixed(2)}  ${row.attempts} attempt(s)  ${state}`);
  }
}

console.log('\n── First decline reason, from the FAILED charge ──');
const byReason = new Map<string, number>();
for (const row of declined) byReason.set(row.firstDeclineCode ?? '(none)', (byReason.get(row.firstDeclineCode ?? '(none)') ?? 0) + 1);
for (const [reason, count] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${reason.padEnd(36)} ${count}`);
}

// A country that declines everything is only actionable once you know WHY.
// "The issuer refused a cross-border recurring charge" and "authentication was
// required and never completed" look identical in a country table and have
// opposite fixes: the first is risk scoring you largely cannot argue with, the
// second is a mandate problem you can actually solve. Small samples are called
// out as such rather than being quietly presented as a finding.
console.log('\n── Decline reasons for the worst countries ──');
const countryTotals = new Map<string, { total: number; failed: number }>();
for (const row of billedRows) {
  const key = row.cardCountry ?? '(unknown)';
  const cell = countryTotals.get(key) ?? { total: 0, failed: 0 };
  cell.total += 1;
  if (row.failedCharges > 0) cell.failed += 1;
  countryTotals.set(key, cell);
}
const worst = [...countryTotals.entries()]
  .filter(([country, cell]) => country !== '(unknown)' && cell.failed > 0 && cell.failed / cell.total >= 0.5)
  .sort((a, b) => b[1].failed - a[1].failed);
if (worst.length === 0) {
  console.log('  No country is failing at 50% or worse.');
}
for (const [country, cell] of worst) {
  const reasons = new Map<string, number>();
  for (const row of declined.filter((r) => (r.cardCountry ?? '(unknown)') === country)) {
    const code = row.firstDeclineCode ?? '(none)';
    reasons.set(code, (reasons.get(code) ?? 0) + 1);
  }
  const caveat = cell.total < 5 ? '  ← too few charges to call a trend' : '';
  console.log(`  ${country}  ${cell.failed}/${cell.total} declined${caveat}`);
  for (const [code, count] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`      ${code.padEnd(36)} ${count}`);
  }
}
console.log(
  '  Read these two ways: authentication_required / *_authentication_* means an SCA mandate\n' +
    '  problem, which IS fixable. transaction_not_allowed / do_not_honor / generic_decline on a\n' +
    '  foreign card is cross-border risk scoring, which mostly is not.',
);

if (jsonPath) {
  fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2));
  console.log(`\nPer-subscription detail written to ${jsonPath}`);
}
console.log('\nRead-only: nothing in Stripe or the local database was modified.');
