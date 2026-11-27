#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/backfill-courtesy-refunds.mts \
//     [--dry-run | --yes] [--since YYYY-MM-DD]
//
// Record the courtesy refunds given before the charge.refunded webhook started
// recording them, so each one counts as that customer's one refund under the
// money-back guarantee's limit (core/courtesyRefunds.ts). Without this, the
// courtesy refunds already given (a converted trial or a renewal, refunded in
// the Stripe Dashboard) leave those customers free to get a second refund
// through the guarantee on a later plan.
//
// Walks Stripe's refunds, groups them by charge, re-reads each charge through
// the pinned client (core/stripe.ts, whose charges still name their invoice),
// and applies the decision the webhook applies: a full refund marked
// "Requested by customer", not issued by the money-back flow, on a subscription
// payment. Prints every one it would record, and how many refunds it left out
// and why, so the list can be checked before anything is written.
//
// Dry run by default. --yes writes each row, plus a courtesy_refund_recorded
// audit row stamped at the refund's own time (ip 'backfill-script'), so
// diagnose-user shows it in the member's history. Idempotent: a charge already
// recorded, by the webhook or an earlier run, is left alone.

import crypto from 'node:crypto';
import path from 'node:path';

import { loadEnvLocal } from './env-local.mts';
// Types only: erased at runtime, so nothing loads before the env does.
import type { CourtesyRefundLike, CourtesyRefundRecord, NotCourtesyReason } from '../core/courtesyRefunds.ts';

type Args = { dryRun: boolean; yes: boolean; help: boolean; since: string | null };

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, yes: false, help: false, since: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--since') args.since = argv[(i += 1)] ?? null;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/backfill-courtesy-refunds.mts \\
    [--dry-run | --yes] [--since YYYY-MM-DD]

Records past courtesy refunds (full, "Requested by customer", outside the
money-back guarantee) so each counts as that customer's one refund.

  --since   only refunds created on or after this date (default: all)
  --yes     write the rows (default is a dry run that changes nothing)`);
  process.exit(0);
}
if (args.dryRun && args.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}
let sinceUnix: number | null = null;
if (args.since) {
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(args.since) ? Date.parse(`${args.since}T00:00:00Z`) : Number.NaN;
  if (!Number.isFinite(ms)) {
    console.error(`Error: --since must be a date like 2026-10-01, not "${args.since}".`);
    process.exit(1);
  }
  sinceUnix = Math.floor(ms / 1000);
}

loadEnvLocal();
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY not set in env or .env.local.');
  process.exit(1);
}

// Imported after the env is loaded: core/db.ts reads AUTH_DB_PATH when it loads.
const { getDb } = await import('../core/db.ts');
const { getStripe } = await import('../core/stripe.ts');
const { lookupChargeInvoice } = await import('../core/chargeInvoice.ts');
const { findUserByCustomerIdIncludingDeleted } = await import('../core/billingUser.ts');
const {
  NOT_COURTESY_LABELS,
  courtesyRefundRecord,
  decideCourtesyRefund,
  isCourtesyRefundRecorded,
  recordCourtesyRefund,
} = await import('../core/courtesyRefunds.ts');

function money(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

console.log(`Auth DB:  ${process.env.AUTH_DB_PATH ?? path.join(process.cwd(), 'data', 'auth.db')}`);
console.log(`Refunds:  ${args.since ? `created on or after ${args.since}` : 'all'}`);
console.log(args.yes ? 'Mode:     WRITE (--yes)\n' : 'Mode:     dry run, nothing is written\n');

const stripe = getStripe();
const db = getDb();

// Every refund, grouped by the charge it refunded.
const refundsByCharge = new Map<string, CourtesyRefundLike[]>();
let refundsRead = 0;
for await (const refund of stripe.refunds.list({
  limit: 100,
  ...(sinceUnix != null ? { created: { gte: sinceUnix } } : {}),
})) {
  refundsRead += 1;
  const chargeId = typeof refund.charge === 'string' ? refund.charge : refund.charge?.id ?? null;
  if (!chargeId) continue;
  const list = refundsByCharge.get(chargeId) ?? [];
  list.push(refund);
  refundsByCharge.set(chargeId, list);
}

const toRecord: CourtesyRefundRecord[] = [];
const leftOut = new Map<NotCourtesyReason, number>();
const errors: string[] = [];
let alreadyRecorded = 0;

for (const [chargeId, refunds] of refundsByCharge) {
  let charge;
  try {
    charge = await stripe.charges.retrieve(chargeId);
  } catch (err) {
    errors.push(`charge ${chargeId}: ${err instanceof Error ? err.message : String(err)}`);
    continue;
  }
  const invoice = await lookupChargeInvoice(stripe, charge);
  const decision = decideCourtesyRefund({ charge, refunds, invoice });
  if (!decision.counts) {
    leftOut.set(decision.why, (leftOut.get(decision.why) ?? 0) + 1);
    continue;
  }
  const user = decision.customerId ? findUserByCustomerIdIncludingDeleted(decision.customerId) : null;
  const record = courtesyRefundRecord(charge, decision, user ? { id: user.id, email: user.email } : null, 'backfill');
  const line =
    `${record.refundedAtIso.slice(0, 10)}  ${money(record.amountRefunded, record.currency).padStart(10)}  ` +
    `${record.email ?? record.customerId ?? 'unknown customer'}  (charge ${record.chargeId})`;
  if (isCourtesyRefundRecorded(record.chargeId)) {
    alreadyRecorded += 1;
    console.log(`  already recorded  ${line}`);
    continue;
  }
  toRecord.push(record);
  console.log(`  ${args.yes ? 'recording   ' : 'would record'}      ${line}`);
}

let written = 0;
if (args.yes) {
  const nowIso = new Date().toISOString();
  for (const record of toRecord) {
    db.exec('BEGIN IMMEDIATE');
    try {
      if (recordCourtesyRefund(record, nowIso) === 'recorded') {
        db.prepare(
          `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
           VALUES (?, 'courtesy_refund_recorded', ?, NULL, ?, 'backfill-script', ?, ?)`,
        ).run(
          `audit_${crypto.randomBytes(12).toString('hex')}`,
          record.userId,
          record.email,
          `Charge ${record.chargeId} refunded in full at the customer's request, outside the money-back ` +
            'guarantee: their one refund. The guarantee is off for this account, email and card. [backfilled]',
          record.refundedAtIso,
        );
        written += 1;
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      errors.push(`charge ${record.chargeId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

console.log(`\nRead ${refundsRead} refund(s) on ${refundsByCharge.size} charge(s).`);
console.log(
  args.yes
    ? `Courtesy refunds: ${written} recorded, ${alreadyRecorded} already recorded.`
    : `Courtesy refunds: ${toRecord.length} to record, ${alreadyRecorded} already recorded.`,
);
if (leftOut.size > 0) {
  console.log('Left out (these never count):');
  for (const [why, count] of leftOut) console.log(`  ${String(count).padStart(4)}  ${NOT_COURTESY_LABELS[why]}`);
}
if (errors.length > 0) {
  console.log(`\n${errors.length} error(s), nothing written for these. Re-run to retry:`);
  for (const error of errors) console.log(`  ${error}`);
}
if (!args.yes) {
  console.log(
    toRecord.length > 0
      ? '\nDry run: nothing written. Check the list above, then re-run with YES=1.'
      : '\nDry run: nothing to record.',
  );
}
process.exit(errors.length > 0 ? 1 : 0);
