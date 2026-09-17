#!/usr/bin/env node
// Run from the frontend/ directory (or via `make backfill-payment-declines`):
//   node --experimental-strip-types scripts/backfill-payment-declines.mts
//
// Fills in the decline history that predates the tracker behind
// Admin → Monitoring → Stripe → Payment Declines, in two passes.
//
// PASS 1 — RECONSTRUCT (always runs, needs no Stripe key).
// Every `stripe_payment_failed` audit row becomes a decline: the invoice, the
// subscription, the attempt number and the day are all in the message. Their
// outcomes are then settled against the invoice ledger — an invoice later paid
// is recovered, an attempt with no closing event after thirty days is marked
// unresolved. What this pass CANNOT produce is the reason: nothing ever wrote
// the decline code down, so those rows land in "No usable decline code" and the
// report states the gap rather than hiding it.
//
// PASS 2 — ENRICH (needs STRIPE_SECRET_KEY; skip with SKIP_STRIPE=1).
// For each reason-less row, re-read the invoice from Stripe, walk to the charge
// its attempt produced, and stamp the issuer's actual decline code, the card,
// the amount and the currency onto it. This is one API read per invoice and is
// the slow half; LIMIT caps it.
//
// WHAT IT DOES NOT DO
//
//   * It never writes to Stripe. Every call is a list/read.
//   * It never touches users, subscriptions, tiers, access or email. The only
//     table it writes is payment_declines, which nothing in the billing path
//     reads.
//   * It never overwrites a reason already captured by the webhook, and never
//     downgrades a known category to 'unknown'.
//
// Idempotent: UNIQUE(invoice_id, attempt_count) means re-running adds only what
// is new.
//
// Flags / environment:
//   AUTH_DB_PATH        which SQLite file to write (same rule as the app)
//   STRIPE_SECRET_KEY   required for pass 2 only; read from env or .env.local
//   SKIP_STRIPE=1       run pass 1 only
//   LIMIT=<n>           cap how many invoices pass 2 re-reads (default 500)
//   RECHECK=1           also re-read invoices a previous run already fetched
//   DRY_RUN=1           report what pass 2 WOULD stamp, write nothing
//
// IMPORTANT: core/db.ts reads AUTH_DB_PATH from process.env only — it does NOT
// load .env.local the way Next.js does at app boot. The file is hoisted into
// process.env before the dynamic imports below; a static import would be
// hoisted above the mutation and open the wrong database.

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

const dryRun = process.env.DRY_RUN === '1';
const skipStripe = process.env.SKIP_STRIPE === '1';
const limit = Number(process.env.LIMIT) > 0 ? Number(process.env.LIMIT) : 500;
// Re-read invoices an earlier run already fetched. Needed once after the reader
// learns to keep something it used to discard — otherwise those rows are settled
// against the older, poorer read forever.
const recheck = process.env.RECHECK === '1';

const {
  backfillDeclinesFromAudit,
  countPaidInvoices,
  enrichDeclineWithReason,
  listDeclinesNeedingInvoiceRead,
  markDeclineInvoiceRead,
  recategorizeFromStoredCodes,
  unifyInvoiceKinds,
  reclassifyUnknownKinds,
} = await import('../core/paymentDeclinesServer.ts');
const { declineForAttempt, lookupInvoiceDecline } = await import('../core/stripeDeclineLookup.ts');
const { classifyDecline, describeDecline } = await import('../core/declineReason.ts');
const { readInvoicePriceId } = await import('../core/stripeInvoice.ts');

// Pass 3 — re-ask both classifiers now that more is known about each row. Runs
// whether or not pass 2 had anything to fetch: an enrichment that finished on an
// earlier run still needs converting into categories and kinds, and a decline
// code that only became recognisable when core/declineReason.ts learned it needs
// re-asking regardless.
function runPass3(): void {
  console.log('\nPass 3 — re-reading what is already on record…');
  const categories = recategorizeFromStoredCodes();
  console.log(
    `  reasons:  ${categories.examined} attempt(s) with an unnamed code · ` +
      `${categories.recategorized} now named`,
  );
  const kinds = reclassifyUnknownKinds();
  console.log(
    `  charges:  ${kinds.examined} invoice(s) examined · ${kinds.reclassified} moved off "unclassified"`,
  );
  const unified = unifyInvoiceKinds();
  if (unified.split > 0) {
    console.log(
      `  split:    ${unified.split} invoice(s) held more than one kind · ${unified.unified} collapsed to one`,
    );
  }
}

// ---------------------------------------------------------------------------
// Pass 1 — reconstruct from the audit log
// ---------------------------------------------------------------------------

// How much of the paid-invoice ledger exists decides how many declines can be
// settled as RECOVERED. A decline is aged out as unresolved only when no payment
// for it can be found, so running this before `make backfill-stripe-invoices`
// reports collected money as lost. Say so up front rather than letting the
// operator discover it in the report.
const ledger = countPaidInvoices();
console.log(
  `Invoice ledger: ${ledger.total} paid invoices on record` +
    (ledger.newestAt ? `, newest ${ledger.newestAt.slice(0, 10)}` : ''),
);
if (ledger.imported === 0) {
  console.log(
    '  ! stripe_invoice_history is EMPTY. Declines can only be settled against payments this\n' +
      '    database can see, so run `make backfill-stripe-invoices` first and then re-run this —\n' +
      '    otherwise recovered invoices are reported as unresolved. Re-running is safe: an\n' +
      '    unresolved close is revisited once the evidence exists.',
  );
}
console.log('\nPass 1 — reconstructing declines from stripe_payment_failed audit rows…');
const reconstructed = backfillDeclinesFromAudit();
console.log(
  `  ${reconstructed.scanned} audit rows read · ${reconstructed.inserted} declines added · ` +
    `${reconstructed.duplicates} already on record · ${reconstructed.unparseable} with no usable invoice id`,
);
console.log(
  `  settled: ${reconstructed.recovered} recovered · ${reconstructed.cancelled} lost to a cancellation · ` +
    `${reconstructed.agedOut} unresolved after ${30} days`,
);
console.log(
  '  amounts on reconstructed rows are ESTIMATED from the prevailing price; pass 2 replaces them with the real figure.',
);

// ---------------------------------------------------------------------------
// Pass 2 — enrich with the real issuer reason
// ---------------------------------------------------------------------------

const secretKey = process.env.STRIPE_SECRET_KEY;
// Pass 3 reads only what is already stored, so it runs on every path — including
// the ones that cannot talk to Stripe. Skipping it with pass 2 meant a
// classifier improvement could never reach an existing row without a Stripe key,
// which is the opposite of what pass 3 is for.
if (skipStripe) {
  console.log('\nPass 2 skipped (SKIP_STRIPE=1). Newly reconstructed rows carry no decline reason.');
  runPass3();
  process.exit(0);
}
if (!secretKey) {
  console.log('\nPass 2 skipped: STRIPE_SECRET_KEY is not set (env or .env.local).');
  console.log('Counts and outcomes are complete; the reasons behind them are not.');
  runPass3();
  process.exit(0);
}

const pending = listDeclinesNeedingInvoiceRead(limit, { includeAlreadyRead: recheck });
if (pending.length === 0) {
  console.log('\nPass 2 — every decline on record has been read from Stripe. Nothing to do.');
  console.log('  (RECHECK=1 re-reads them, for when this reader keeps more than the one that ran before.)');
  runPass3();
  process.exit(0);
}

console.log(`\nPass 2 — re-reading ${pending.length} invoice(s) from Stripe…`);
const stripe = new Stripe(secretKey);

const byCategory = new Map<string, number>();
let stamped = 0;
let noReason = 0;
let facts = 0;
let recoveredFromHistory = 0;
let failed = 0;

for (const row of pending) {
  try {
    // The invoice is fetched rather than the charge directly: which object holds
    // the reason depends on the API version the invoice renders in, and
    // lookupInvoiceDecline is the one place that knows the order to try.
    const invoice = await stripe.invoices.retrieve(row.invoiceId);
    const found = await lookupInvoiceDecline(stripe, invoice);
    // Line this ATTEMPT up with its own failure where the lookup recovered
    // several, rather than stamping one reason across every retry.
    const lookup = { ...found, decline: declineForAttempt(found, row.attemptCount) };
    if (found.fromHistory) recoveredFromHistory += 1;
    if (lookup.decline) {
      const category = classifyDecline(lookup.decline);
      byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
    } else {
      noReason += 1;
    }
    if (dryRun) {
      console.log(
        `  [dry] ${row.invoiceId} attempt ${row.attemptCount}: ${describeDecline(lookup.decline)}` +
          ` · billing_reason=${invoice.billing_reason ?? 'unknown'}`,
      );
      continue;
    }
    // Written whether or not a reason came back. The invoice has been fetched
    // and it carries the billing reason, the real amount, the plan and the card
    // — discarding all of that because the ONE field we came for was missing is
    // how rows end up permanently unclassifiable AND stuck on an estimate.
    const wrote = enrichDeclineWithReason(row.invoiceId, row.attemptCount, lookup.decline, {
      chargeId: lookup.chargeId,
      amountDue: typeof invoice.amount_due === 'number' ? invoice.amount_due : null,
      currency: invoice.currency ?? null,
      billingReason: invoice.billing_reason ?? null,
      priceId: readInvoicePriceId(invoice),
      cardBrand: lookup.card?.brand ?? null,
      cardLast4: lookup.card?.last4 ?? null,
      cardFunding: lookup.card?.funding ?? null,
      cardCountry: lookup.card?.country ?? null,
      nextAttemptAt:
        typeof invoice.next_payment_attempt === 'number'
          ? new Date(invoice.next_payment_attempt * 1000).toISOString()
          : null,
      collectionMethod: invoice.collection_method ?? null,
      invoiceStatus: invoice.status ?? null,
    });
    // The invoice has been read. Recorded whatever came back, so the next run
    // spends no API call asking again.
    markDeclineInvoiceRead(row.invoiceId, row.attemptCount);
    if (lookup.decline) {
      if (wrote) stamped += 1;
    } else if (wrote) {
      facts += 1;
    }
  } catch (err) {
    failed += 1;
    const message = err instanceof Error ? err.message : 'lookup failed';
    console.warn(`  ! ${row.invoiceId}: ${message}`);
  }
}

console.log(
  `\n${dryRun ? 'Would stamp' : 'Stamped'} ${dryRun ? byCategory.size : stamped} decline(s) with a reason · ` +
    `${noReason} carried none even in Stripe${dryRun ? '' : ` (${facts} still gave up their billing reason and real amount)`} · ` +
    `${failed} lookup error(s)`,
);
for (const [category, count] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${category.padEnd(24)} ${count}`);
}
if (recoveredFromHistory > 0) {
  console.log(
    `  ${recoveredFromHistory} reason(s) recovered from a FAILED charge in history — invoices that were\n` +
      '    later paid, whose latest charge is the successful one and carries no decline data.',
  );
}
if (pending.length === limit) {
  console.log(`\nStopped at LIMIT=${limit}. Re-run to continue.`);
}

if (!dryRun) {
  // Pass 3 consumes what pass 2 wrote: the real billing reason is what lets a
  // reconstructed decline be told apart as a conversion or a renewal.
  runPass3();
}
