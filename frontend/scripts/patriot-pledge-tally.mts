#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22), or via `make patriot-pledge-tally`:
//   node --experimental-strip-types --no-warnings scripts/patriot-pledge-tally.mts \
//     [--csv <path>] [--json <path>] [--all] [--verbose]
//
// Computes exactly what ZeroGEX owes Folds of Honor under the September 11
// 25th-anniversary drive: 100% of the first month collected from every
// subscription started inside the pledge window, annual subscribers counted at
// one twelfth of their annual payment (core/patriotPledge.ts holds the window
// and the arithmetic; this script only supplies real Stripe numbers to it).
//
// READ-ONLY. It never writes to Stripe, the database, or the repo. Publishing
// the donation to the site is still `make quarterly-receipt` — this script just
// tells you the number to put in.
//
// WHEN TO RUN IT
//   Not on the last day of the drive. Every signup carries a 7-day trial, so a
//   subscription started Monday September 14 is not charged until roughly
//   September 21. Run it once the last trial has converted — September 22 or
//   later — or the total will be missing most of the campaign. `--all` shows
//   the still-pending rows so you can see what you are waiting on.
//
// HOW A SUBSCRIPTION QUALIFIES
//   Its `created` timestamp falls inside the window. Deliberately NOT its first
//   invoice date: the trial pushes every invoice past the window, so filtering
//   on invoices would zero out the campaign we advertised.
//
// WHAT COUNTS AS THE FIRST MONTH
//   The earliest invoice on that subscription with status `paid`, measured by
//   `amount_paid` — what actually cleared, after the 25% coupon and after any
//   credit or proration Stripe applied. A trial that was cancelled before it
//   converted has no paid invoice and owes nothing. Refunded invoices are
//   subtracted (see --verbose for the per-row detail).
//
// Stripe's processing fee is NOT deducted. The charity receives the full gross
// receipt; the fee comes out of our side. That is what /giving promises.
//
// Flags:
//   --csv <path>    Write the per-invoice ledger as CSV (for the receipt page)
//   --json <path>   Write the full tally as JSON
//   --all           Also list qualifying subs with no paid invoice yet
//   --verbose       Show every row, including refunds and skips
//   --help

import fs from 'node:fs';
import path from 'node:path';

import Stripe from 'stripe';

import {
  PATRIOT_PLEDGE_START_ISO,
  PATRIOT_PLEDGE_END_ISO,
  PATRIOT_PLEDGE_START_LABEL,
  PATRIOT_PLEDGE_END_LABEL,
  PATRIOT_PLEDGE_PARTNER,
  PATRIOT_PLEDGE_DISCOUNT_PCT,
  tallyPledge,
  formatUsdCents,
  type PledgeInvoice,
} from '../core/patriotPledge.ts';

type Cadence = 'monthly' | 'annual';

type Args = {
  csv: string | null;
  json: string | null;
  all: boolean;
  verbose: boolean;
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
  const args: Args = { csv: null, json: null, all: false, verbose: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--csv') args.csv = (argv[++i] ?? '').trim() || null;
    else if (arg === '--json') args.json = (argv[++i] ?? '').trim() || null;
    else if (arg === '--all') args.all = true;
    else if (arg === '--verbose' || arg === '-v') args.verbose = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/patriot-pledge-tally.mts \\
    [--csv <path>] [--json <path>] [--all] [--verbose]

Read-only. Computes the ${PATRIOT_PLEDGE_PARTNER} donation owed under the
September 11 25th-anniversary drive (${PATRIOT_PLEDGE_START_LABEL} – ${PATRIOT_PLEDGE_END_LABEL}).

Run it on or after September 22, once every 7-day trial from the window has
converted. Reads STRIPE_SECRET_KEY and the four STRIPE_PRICE_* ids from env or
.env.local.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
function envOrLocal(key: string): string | undefined {
  return process.env[key] || envLocal[key];
}

const STRIPE_SECRET_KEY = envOrLocal('STRIPE_SECRET_KEY');
if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY not set in env or .env.local.');
  console.error('Tip: run this from the frontend/ directory so .env.local is found.');
  process.exit(1);
}

// Price id -> cadence. Tier does not affect the donation (both tiers donate the
// full first month), so only the cadence matters here: it decides whether the
// row is taken whole or split twelve ways.
const CADENCE_BY_PRICE = new Map<string, Cadence>();
for (const [key, cadence] of [
  ['STRIPE_PRICE_BASIC_MONTHLY', 'monthly'],
  ['STRIPE_PRICE_PRO_MONTHLY', 'monthly'],
  ['STRIPE_PRICE_BASIC_ANNUAL', 'annual'],
  ['STRIPE_PRICE_PRO_ANNUAL', 'annual'],
] as const) {
  const id = envOrLocal(key);
  if (id) CADENCE_BY_PRICE.set(id, cadence);
}
if (CADENCE_BY_PRICE.size === 0) {
  console.error('Error: no STRIPE_PRICE_* ids configured — cannot tell monthly from annual.');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

const startSec = Math.floor(Date.parse(PATRIOT_PLEDGE_START_ISO) / 1000);
const endSec = Math.floor(Date.parse(PATRIOT_PLEDGE_END_ISO) / 1000);

// Fall back to the subscription's own interval when the price id isn't one of
// the four configured SKUs (a legacy price, or a plan created by hand in the
// dashboard). Better than dropping the row and under-paying the charity.
function cadenceOf(sub: Stripe.Subscription): Cadence | null {
  for (const item of sub.items.data) {
    const priceId = typeof item.price === 'string' ? item.price : item.price?.id;
    if (priceId && CADENCE_BY_PRICE.has(priceId)) return CADENCE_BY_PRICE.get(priceId)!;
  }
  const interval = sub.items.data[0]?.price?.recurring?.interval;
  if (interval === 'year') return 'annual';
  if (interval === 'month') return 'monthly';
  return null;
}

type Row = {
  subscriptionId: string;
  customerEmail: string;
  cadence: Cadence;
  createdIso: string;
  status: 'paid' | 'pending' | 'unpaid';
  invoiceId: string | null;
  invoiceIso: string | null;
  collectedCents: number;
  refundedCents: number;
  note: string;
};

async function firstPaidInvoice(subId: string): Promise<Stripe.Invoice | null> {
  // Oldest first: the first paid invoice on the sub is the "first month",
  // whether it landed on day 1 or after a 7-day trial.
  const invoices: Stripe.Invoice[] = [];
  for await (const inv of stripe.invoices.list({ subscription: subId, limit: 100 })) {
    invoices.push(inv);
  }
  invoices.sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
  return invoices.find((inv) => inv.status === 'paid' && (inv.amount_paid ?? 0) > 0) ?? null;
}

async function main() {
  console.log('');
  console.log(`ZeroGEX — ${PATRIOT_PLEDGE_PARTNER} 25th-anniversary pledge tally`);
  console.log(`Window:  ${PATRIOT_PLEDGE_START_LABEL} – ${PATRIOT_PLEDGE_END_LABEL} (ET)`);
  console.log(`Offer:   ${PATRIOT_PLEDGE_DISCOUNT_PCT}% off · 100% of the first month donated`);
  console.log(`Stripe:  ${STRIPE_SECRET_KEY!.startsWith('sk_live') ? 'LIVE mode' : 'test mode'}`);
  console.log('');

  const rows: Row[] = [];
  let scanned = 0;

  for await (const sub of stripe.subscriptions.list({
    created: { gte: startSec, lte: endSec },
    status: 'all',
    limit: 100,
    expand: ['data.customer'],
  })) {
    scanned++;
    const cadence = cadenceOf(sub);
    if (!cadence) {
      if (args.verbose) console.log(`  skip ${sub.id}: no recognizable cadence`);
      continue;
    }

    const customer = sub.customer;
    const email =
      typeof customer === 'object' && customer && !('deleted' in customer && customer.deleted)
        ? (customer as Stripe.Customer).email ?? '—'
        : '—';

    const invoice = await firstPaidInvoice(sub.id);
    const createdIso = new Date((sub.created ?? 0) * 1000).toISOString();

    if (!invoice) {
      // Either still trialing (will convert and owe later) or cancelled during
      // the trial (owes nothing, ever).
      const stillLive = sub.status === 'trialing' || sub.status === 'active';
      rows.push({
        subscriptionId: sub.id,
        customerEmail: email,
        cadence,
        createdIso,
        status: stillLive ? 'pending' : 'unpaid',
        invoiceId: null,
        invoiceIso: null,
        collectedCents: 0,
        refundedCents: 0,
        note: stillLive ? `trial not yet converted (${sub.status})` : `no payment (${sub.status})`,
      });
      continue;
    }

    // Net of refunds: if we gave the money back, we did not collect it, and the
    // pledge is on what we collected.
    const refunded = (invoice as unknown as { amount_refunded?: number }).amount_refunded ?? 0;
    const net = Math.max(0, (invoice.amount_paid ?? 0) - refunded);

    rows.push({
      subscriptionId: sub.id,
      customerEmail: email,
      cadence,
      createdIso,
      status: 'paid',
      invoiceId: invoice.id ?? null,
      invoiceIso: new Date((invoice.created ?? 0) * 1000).toISOString(),
      collectedCents: net,
      refundedCents: refunded,
      note: refunded > 0 ? `net of ${formatUsdCents(refunded)} refunded` : '',
    });
  }

  const paidRows = rows.filter((r) => r.status === 'paid' && r.collectedCents > 0);
  const pendingRows = rows.filter((r) => r.status === 'pending');
  const unpaidRows = rows.filter((r) => r.status === 'unpaid');

  const tally = tallyPledge(
    paidRows.map<PledgeInvoice>((r) => ({
      invoiceId: r.invoiceId ?? r.subscriptionId,
      cadence: r.cadence,
      collectedCents: r.collectedCents,
    })),
  );
  const donationByInvoice = new Map(tally.lines.map((l) => [l.invoiceId, l.donationCents]));

  console.log(`Subscriptions created in window: ${scanned}`);
  console.log(`  paid (counted):   ${paidRows.length}`);
  console.log(`  pending (trial):  ${pendingRows.length}`);
  console.log(`  never paid:       ${unpaidRows.length}`);
  console.log('');

  if (paidRows.length > 0) {
    console.log('Ledger');
    console.log('─'.repeat(84));
    console.log(
      `${'Invoice'.padEnd(28)}${'Email'.padEnd(28)}${'Cad'.padEnd(9)}${'Collected'.padStart(10)}${'Donate'.padStart(9)}`,
    );
    console.log('─'.repeat(84));
    for (const r of paidRows) {
      const key = r.invoiceId ?? r.subscriptionId;
      const donation = donationByInvoice.get(key) ?? 0;
      console.log(
        `${key.padEnd(28)}${r.customerEmail.slice(0, 26).padEnd(28)}${r.cadence.padEnd(9)}` +
          `${formatUsdCents(r.collectedCents).padStart(10)}${formatUsdCents(donation).padStart(9)}`,
      );
      if (r.note && args.verbose) console.log(`  ${' '.repeat(26)}↳ ${r.note}`);
    }
    console.log('─'.repeat(84));
  }

  if ((args.all || args.verbose) && pendingRows.length > 0) {
    console.log('');
    console.log(`Pending — trials from the window that have not converted yet:`);
    for (const r of pendingRows) {
      console.log(`  ${r.subscriptionId}  ${r.customerEmail}  ${r.cadence}  (${r.note})`);
    }
    console.log('  These will owe once they convert. Re-run after the last trial ends.');
  }

  console.log('');
  console.log(`Collected (first month, ${paidRows.length} subs): ${formatUsdCents(tally.collectedCents)}`);
  console.log(`OWED TO ${PATRIOT_PLEDGE_PARTNER.toUpperCase()}:${' '.repeat(Math.max(1, 22 - PATRIOT_PLEDGE_PARTNER.length))}${formatUsdCents(tally.donationCents)}`);
  console.log('');

  if (pendingRows.length > 0) {
    console.log(
      `⚠  ${pendingRows.length} trial(s) still open — this total is NOT final. Re-run after they convert.`,
    );
    console.log('');
  }

  console.log('Next: make quarterly-receipt AMOUNT=' + (tally.donationCents / 100).toFixed(2));
  console.log('');

  if (args.csv) {
    const header = 'invoice_id,subscription_id,email,cadence,created,invoice_date,collected_usd,donation_usd\n';
    const body = paidRows
      .map((r) => {
        const key = r.invoiceId ?? r.subscriptionId;
        const donation = donationByInvoice.get(key) ?? 0;
        return [
          key,
          r.subscriptionId,
          JSON.stringify(r.customerEmail),
          r.cadence,
          r.createdIso,
          r.invoiceIso ?? '',
          (r.collectedCents / 100).toFixed(2),
          (donation / 100).toFixed(2),
        ].join(',');
      })
      .join('\n');
    fs.writeFileSync(args.csv, header + body + '\n');
    console.log(`Wrote CSV ledger: ${args.csv}`);
  }

  if (args.json) {
    fs.writeFileSync(
      args.json,
      JSON.stringify(
        {
          window: { startIso: PATRIOT_PLEDGE_START_ISO, endIso: PATRIOT_PLEDGE_END_ISO },
          partner: PATRIOT_PLEDGE_PARTNER,
          generatedAtIso: new Date().toISOString(),
          subscriptionsInWindow: scanned,
          paidCount: paidRows.length,
          pendingCount: pendingRows.length,
          collectedCents: tally.collectedCents,
          donationCents: tally.donationCents,
          donationUsd: Number((tally.donationCents / 100).toFixed(2)),
          final: pendingRows.length === 0,
          lines: tally.lines,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`Wrote JSON tally: ${args.json}`);
  }
}

main().catch((err) => {
  console.error('Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
