#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/repair-refund-commissions.mts [--dry-run | --yes]
//
// Find refunds whose creator-partner commission was never reversed, reverse it,
// and put the right invoice on the record.
//
// WHY THEY WERE MISSED. The charge.refunded webhook read the refunded charge's
// invoice from `charge.invoice` on the event. Events are rendered in the webhook
// ENDPOINT's API version, and 2025-03-31.basil removed that field from the
// Charge, so it was never there: every subscription refund was logged "(no
// invoice — one-off charge)", and the commission reversal, which needs the
// invoice, never ran. A commission on a refunded invoice stayed 'accrued' and
// showed as owed in `make partner-commissions` at month-end. That includes the
// 7-day money-back refunds, which leave the reversal to the webhook. The webhook
// now resolves the invoice through core/chargeInvoice.ts.
//
// WHAT IT CHECKS. Every refund_issued audit row:
//   * rows that could not name the invoice: "(no invoice — one-off charge)" as
//     the webhook wrote it, or "(invoice could not be resolved: …)" from the
//     fixed webhook when Stripe would not answer. Each charge is re-read through
//     the webhook's own pinned client, the same lookup the webhook now makes.
//     Rows from `make backfill-refund-audit` are left alone: it read every
//     charge through the API, which still carries the invoice, so its "one-off"
//     rows are right. It also dedupes on the charge id, so it skips the rows
//     this script exists for and cannot fix them.
//   * rows that do name their invoice. The reversal should have run for these,
//     but the backfill never reversed anything, and a refund handled before its
//     invoice.paid accrued the commission leaves the same gap. Any commission
//     still 'accrued' on one of those invoices is reported too.
// A refund with no refund_issued row at all is invisible here; that is
// `make backfill-refund-audit`'s job, so run it first if it has never run.
//
// WHAT --yes DOES. Flips each commission still 'accrued' on a refunded invoice
// to 'reversed' (only if it is still 'accrued' at that moment), with a
// partner_commission_reversed audit row per flip, filed under the refunded
// member. For each refund that was logged without its invoice, it appends a
// refund_invoice_corrected row naming it, so `make diagnose-user` tells the true
// story. Existing rows are never rewritten.
//
// WHAT IT WILL NOT TOUCH. A commission already 'paid' to the partner: that money
// is out the door. Those are listed for a manual clawback.
//
// Idempotent: a second run finds the commissions reversed and the correction
// rows written, and has nothing left to do. Read-only without --yes.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { loadEnvLocal } from './env-local.mts';
import {
  lookupChargeInvoice,
  readRefundAuditRow,
  type ChargeInvoiceLookup,
} from '../core/chargeInvoice.ts';

type Args = { dryRun: boolean; yes: boolean; help: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, yes: false, help: false };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
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
  node --experimental-strip-types --no-warnings scripts/repair-refund-commissions.mts [--dry-run | --yes]

Lists refunds whose creator-partner commission was never reversed, because the
refund webhook could not see which invoice the charge paid. --yes reverses the
commissions still accrued and appends audit rows naming the real invoice.
Commissions already paid to a partner are listed for a manual clawback.

  --yes      apply (default is a dry run that changes nothing)`);
  process.exit(0);
}
if (args.dryRun && args.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}

loadEnvLocal();

// Resolved the same way as core/db.ts, and checked first: getDb() on a wrong
// path quietly creates an empty database and reports nothing to repair.
const dbPath = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}
const stripeKey = process.env.STRIPE_SECRET_KEY ?? '';
if (!stripeKey) {
  console.error('STRIPE_SECRET_KEY is not set (env or frontend/.env.local). Charges are re-read from Stripe.');
  process.exit(1);
}

// Imported after the env is loaded: core/db.ts reads AUTH_DB_PATH on first use.
// getStripe() is the webhook's own client, pinned to the API version whose
// charges still carry `invoice`.
const { getDb } = await import('../core/db.ts');
const { getStripe } = await import('../core/stripe.ts');

const db = getDb();

console.log(`Auth DB:  ${dbPath}`);
console.log(`Stripe:   ${/^(sk|rk)_live_/.test(stripeKey) ? 'live' : 'test'} mode`);
console.log(`Mode:     ${args.yes ? 'APPLY' : 'DRY RUN (no writes)'}`);
console.log('');

type AuditRow = { user_id: string | null; email: string | null; message: string; created_at: string };

// One entry per refunded charge: a charge refunded in parts has a row per refund.
type Refund = {
  chargeId: string;
  userId: string | null;
  email: string | null;
  // The first row that could not name the invoice, if any.
  missedRow: AuditRow | null;
  invoiceId: string | null;
  lookup: ChargeInvoiceLookup | null;
};

const rows = db
  .prepare(
    `SELECT user_id, email, message, created_at FROM audit_events
      WHERE type = 'refund_issued'
      ORDER BY created_at ASC`,
  )
  .all() as AuditRow[];

const refunds = new Map<string, Refund>();
for (const row of rows) {
  const read = readRefundAuditRow(row.message);
  if (!read) continue;
  const refund = refunds.get(read.chargeId) ?? {
    chargeId: read.chargeId,
    userId: null,
    email: null,
    missedRow: null,
    invoiceId: null,
    lookup: null,
  };
  refund.userId = refund.userId ?? row.user_id;
  refund.email = refund.email ?? row.email;
  if (read.needsLookup) refund.missedRow = refund.missedRow ?? row;
  refund.invoiceId = refund.invoiceId ?? read.invoiceId;
  refunds.set(read.chargeId, refund);
}

const missed = [...refunds.values()].filter((refund) => refund.missedRow);
console.log(
  `refund_issued rows: ${rows.length} on ${refunds.size} charge(s), ` +
    `${missed.length} of them logged without their invoice`,
);

const stripe = getStripe();
for (const refund of missed) {
  // A later partial refund on the same charge may already name it.
  if (refund.invoiceId) continue;
  refund.lookup = await lookupChargeInvoice(stripe, { id: refund.chargeId });
  if (refund.lookup.kind === 'invoice') refund.invoiceId = refund.lookup.invoiceId;
}

// The charge id is followed by a space in the correction message, so ch_abc
// never matches ch_abcdef.
const correctedBefore = db.prepare(
  `SELECT 1 AS hit FROM audit_events
    WHERE type = 'refund_invoice_corrected' AND instr(message, ?) > 0
    LIMIT 1`,
);
const toCorrect = missed.filter(
  (refund) => refund.invoiceId && !correctedBefore.get(`charge ${refund.chargeId} `),
);

type Commission = {
  id: string;
  partner_user_id: string;
  partner_email: string | null;
  commission_amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  payout_reference: string | null;
};
const commissionsOn = db.prepare(
  `SELECT pc.id, pc.partner_user_id, u.email AS partner_email, pc.commission_amount,
          pc.currency, pc.status, pc.paid_at, pc.payout_reference
     FROM partner_commissions pc
     LEFT JOIN users u ON u.id = pc.partner_user_id
    WHERE pc.stripe_invoice_id = ?`,
);
// Keyed by commission: two charges refunded on one invoice (an invoice paid in
// parts) name the same commission, and it is reversed and reported once.
const toReverse = new Map<string, { refund: Refund; commission: Commission }>();
const toClawBack = new Map<string, { refund: Refund; commission: Commission }>();
for (const refund of refunds.values()) {
  if (!refund.invoiceId) continue;
  for (const commission of commissionsOn.all(refund.invoiceId) as Commission[]) {
    const bucket =
      commission.status === 'accrued' ? toReverse : commission.status === 'paid' ? toClawBack : null;
    if (bucket && !bucket.has(commission.id)) bucket.set(commission.id, { refund, commission });
  }
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
      amount / 100,
    );
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
const member = (refund: Refund) => refund.email ?? '(no local user)';
const partner = (commission: Commission) => commission.partner_email ?? commission.partner_user_id;

let unresolved = 0;
if (missed.length > 0) {
  console.log('');
  console.log('=== Refunds logged without their invoice ===');
  for (const refund of missed) {
    console.log(`  ${refund.missedRow?.created_at}  ${member(refund)}  ${refund.chargeId}`);
    if (refund.invoiceId) {
      const pending = toCorrect.includes(refund);
      console.log(
        `      paid invoice ${refund.invoiceId}` +
          (pending ? '; a correction row naming it will be appended' : '; correction row already written'),
      );
    } else if (refund.lookup?.kind === 'none') {
      console.log('      really a one-off charge: Stripe names no invoice. Nothing to do.');
    } else {
      unresolved += 1;
      const reason = refund.lookup?.kind === 'unknown' ? refund.lookup.reason : 'not looked up';
      console.log(`      COULD NOT RESOLVE (${reason}). Re-run to retry.`);
    }
  }
}

if (toReverse.size > 0) {
  console.log('');
  console.log('=== Commissions still accrued on a refunded invoice (to reverse) ===');
  for (const { refund, commission } of toReverse.values()) {
    console.log(
      `  ${commission.id}  ${money(commission.commission_amount, commission.currency)} to ${partner(commission)}` +
        `  invoice ${refund.invoiceId}, refunded to ${member(refund)} on ${refund.chargeId}`,
    );
  }
}

if (toClawBack.size > 0) {
  console.log('');
  console.log('=== Already PAID to the partner: claw these back by hand ===');
  for (const { refund, commission } of toClawBack.values()) {
    console.log(
      `  ${commission.id}  ${money(commission.commission_amount, commission.currency)} to ${partner(commission)}` +
        `  paid ${commission.paid_at ?? '—'}${commission.payout_reference ? ` (ref ${commission.payout_reference})` : ''}`,
    );
    console.log(`      invoice ${refund.invoiceId}, refunded to ${member(refund)} on ${refund.chargeId}`);
  }
}

console.log('');
console.log(`Correction rows to append:       ${toCorrect.length}`);
console.log(`Commissions to reverse:          ${toReverse.size}`);
console.log(`Paid commissions to claw back:   ${toClawBack.size}`);
if (unresolved > 0) console.log(`Charges Stripe did not resolve:  ${unresolved}`);

if (toCorrect.length === 0 && toReverse.size === 0) {
  console.log('');
  console.log(
    toClawBack.size > 0
      ? 'Nothing to reverse or correct. The clawbacks above are manual.'
      : 'Nothing to repair.',
  );
  process.exit(0);
}
if (!args.yes) {
  console.log('');
  console.log('[dry run] Nothing changed. Re-run with YES=1 (--yes) to apply.');
  process.exit(0);
}

const stamp = new Date().toISOString();
const reverse = db.prepare(
  `UPDATE partner_commissions SET status = 'reversed' WHERE id = ? AND status = 'accrued'`,
);
const audit = db.prepare(
  `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
   VALUES (?, ?, ?, NULL, ?, 'manual-script', ?, ?)`,
);
const auditId = () => `audit_${crypto.randomBytes(12).toString('hex')}`;

let reversed = 0;
db.exec('BEGIN');
try {
  for (const { refund, commission } of toReverse.values()) {
    // Only if still accrued: a payout marked since the read above is left alone.
    if (Number(reverse.run(commission.id).changes) === 0) continue;
    reversed += 1;
    audit.run(
      auditId(),
      'partner_commission_reversed',
      refund.userId,
      refund.email,
      `Charge ${refund.chargeId} refunded on invoice ${refund.invoiceId}; commission ${commission.id} ` +
        `(${money(commission.commission_amount, commission.currency)} to partner ${partner(commission)}) ` +
        'reversed by repair-refund-commissions: the refund webhook had not reversed it',
      stamp,
    );
  }
  for (const refund of toCorrect) {
    audit.run(
      auditId(),
      'refund_invoice_corrected',
      refund.userId,
      refund.email,
      `Refund on charge ${refund.chargeId} was against invoice ${refund.invoiceId}. The refund_issued row ` +
        `of ${refund.missedRow?.created_at} did not name it because the webhook could not see the invoice. ` +
        'Resolved by repair-refund-commissions.',
      stamp,
    );
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  console.error('Nothing was changed.');
  process.exit(1);
}

console.log('');
console.log(`Done. Reversed ${reversed} commission(s), appended ${toCorrect.length} correction row(s).`);
if (reversed < toReverse.size) {
  console.log(`${toReverse.size - reversed} commission(s) changed status since the read and were left alone.`);
}
if (toClawBack.size > 0) {
  console.log(`${toClawBack.size} paid commission(s) still need a manual clawback (listed above).`);
}
