// Reads the audit streams the Subscriber Ledger is built from, and builds it.
//
// Its own module, rather than part of core/monitoring.ts, because two places
// count off the same rows and must never disagree: the admin monitoring page
// (the ledger itself, and the Forward-Looking Growth Rate's payment failures)
// and the Growth tab's daily rollup (core/dailyMetrics.ts). The rollup also runs
// under bare Node from scripts/backfill-daily-metrics.mts, so this module
// follows the same rules dailyMetrics does: not `server-only`, and relative
// imports only (the "@/" alias is a bundler feature the script's loader lacks).
// It is still server code: it opens the SQLite DB through ./db.ts.
import { getDb } from './db.ts';
import { MONEY_BACK_REFUND_AUDIT_TYPES } from './cancelDecisions.ts';
import { parseCancellationReasonFromMessage } from './cancellationReason.ts';
import {
  buildSubscriberLedger,
  type LedgerDeclineEvent,
  type LedgerDeleteEvent,
  type LedgerPaymentEvent,
  type LedgerRecoveryEvent,
  type LedgerRefundEvent,
  type LedgerRow,
  type LedgerSyncEvent,
} from './subscriberBucket.ts';
import {
  isSubscriptionPaymentEvidence,
  SUBSCRIPTION_PAYMENT_AUDIT_TYPES,
} from './subscriptionPayments.ts';

// Stripe subscription ids are always `sub_...`; the audit messages embed exactly
// one. Mirrors the pattern parseStaleSkippedMessage already relies on.
export function parseSubIdFromMessage(message: string): string | null {
  const m = message.match(/sub_[A-Za-z0-9]+/);
  return m ? m[0] : null;
}

// stripe_subscription_sync messages read "... status=<stripe status> tier=...".
// The Stripe status is what distinguishes an involuntary payment-failure
// downgrade (past_due/unpaid) from a healthy sub, so a later deletion can be
// attributed to dunning vs. a voluntary cancel.
export function parseSyncStatus(message: string): string | null {
  const m = message.match(/\bstatus=([A-Za-z_]+)/);
  return m ? m[1] : null;
}

// The tier token exactly as the sync message carries it, for the ledger's bucket
// classification (which folds the legacy ids itself). parseSyncTierStrict maps
// unknown tokens to null, which would read as "no tier"; here an unrecognized
// token should simply not be a paid tier.
function parseSyncTierRaw(message: string): string | null {
  const m = message.match(/\btier=(\w+)/);
  return m ? m[1] : null;
}

// `billing_orphan_payment_recovered` messages open
// "Invoice <in_...> recovered as subscription <sub_...> on price ...", written
// identically by the webhook and scripts/recover-orphan-payment.mts.
//
// Anchored on that phrase rather than reusing parseSubIdFromMessage, which takes
// the first sub_ token it finds: these messages go on to name carried coupons and
// rejected params, and a format change that moved another id earlier in the
// string would otherwise silently mark the WRONG subscription as paid for.
function parseRecoveredSubId(message: string): string | null {
  const m = message.match(/\brecovered as subscription (sub_[A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

function parseRecoveredInvoiceId(message: string): string | null {
  const m = message.match(/\bInvoice (in_[A-Za-z0-9]+)\b/);
  return m ? m[1] : null;
}

// audit_events.created_at is written by SQLite's datetime() as "YYYY-MM-DD
// HH:MM:SS" with no zone marker, and it is UTC. Normalize to a real ISO instant
// so Date.parse doesn't read it as local time.
function toIsoInstant(createdAt: string): string {
  const trimmed = createdAt.trim();
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) return trimmed;
  return `${trimmed.replace(' ', 'T')}Z`;
}

// Rows proving a payment cleared on a SUBSCRIPTION, oldest-first, for the two
// views that must see money move: the Subscriber Ledger's Converting -> Full
// Subscriber step and the Conversion Conveyor's conversion confirmation. Which
// audit types count — and why the $0 trial-opening invoice does not — is
// core/subscriptionPayments.ts.
//
// Every paid invoice on a subscription is returned, renewals included. Both
// consumers already reduce to the first one per subscription themselves (the
// ledger ignores payments after a sub's first; the conveyor only asks whether
// the sub appears at all), so narrowing it here would just duplicate that.
export type SubscriptionPaymentRow = {
  subId: string;
  userId: string | null;
  email: string | null;
  createdAt: string;
};

export function readSubscriptionPayments(sinceDays: number): SubscriptionPaymentRow[] {
  const types = SUBSCRIPTION_PAYMENT_AUDIT_TYPES.map((type) => `'${type}'`).join(', ');
  const rows = getDb()
    .prepare(
      `SELECT created_at, user_id, email, type, message FROM audit_events
        WHERE type IN (${types})
          AND created_at > datetime('now', '-${sinceDays} days')
        ORDER BY created_at ASC`,
    )
    .all() as Array<{
      created_at: string;
      user_id: string | null;
      email: string | null;
      type: string;
      message: string;
    }>;
  const out: SubscriptionPaymentRow[] = [];
  for (const row of rows) {
    if (!isSubscriptionPaymentEvidence(row.type, row.message)) continue;
    const subId = parseSubIdFromMessage(row.message);
    if (!subId) continue;
    out.push({ subId, userId: row.user_id, email: row.email, createdAt: row.created_at });
  }
  return out;
}

/**
 * Reconstruct the headcount's history from the audit streams, newest-first and
 * untrimmed. `sinceDays` is how far back the scan reaches: a subscription's
 * history has to be read from before the window a caller shows, or its first
 * sync inside the window reads as a brand-new subscriber. Throws on a query
 * failure; callers decide how to degrade.
 */
export function readSubscriberLedgerRows(sinceDays: number, nowMs: number): LedgerRow[] {
  const db = getDb();
  // Scanned oldest-first so each subscription's prior state is known before
  // the transition that changes it.
  const syncRows = db
    .prepare(
      `SELECT created_at, user_id, email, message FROM audit_events
       WHERE type = 'stripe_subscription_sync'
         AND created_at > datetime('now', '-${sinceDays} days')
       ORDER BY created_at ASC`,
    )
    .all() as Array<{ created_at: string; user_id: string | null; email: string | null; message: string }>;
  const deletedRows = db
    .prepare(
      `SELECT created_at, user_id, email, message FROM audit_events
       WHERE type = 'stripe_subscription_deleted'
         AND created_at > datetime('now', '-${sinceDays} days')`,
    )
    .all() as Array<{ created_at: string; user_id: string | null; email: string | null; message: string }>;

  const syncs: LedgerSyncEvent[] = [];
  for (const row of syncRows) {
    const subId = parseSubIdFromMessage(row.message);
    if (!subId) continue;
    syncs.push({
      subId,
      userId: row.user_id,
      email: row.email,
      at: toIsoInstant(row.created_at),
      status: parseSyncStatus(row.message),
      tier: parseSyncTierRaw(row.message),
      cancelAtPeriodEnd: /cancelAtPeriodEnd=true/.test(row.message),
    });
  }
  const deletes: LedgerDeleteEvent[] = deletedRows.map((row) => ({
    subId: parseSubIdFromMessage(row.message),
    userId: row.user_id,
    email: row.email,
    at: toIsoInstant(row.created_at),
    reason: parseCancellationReasonFromMessage(row.message).feedback,
  }));

  // The Converting -> Full Subscriber step. Nothing about the SUBSCRIPTION
  // changes when its invoice is paid, so the sync stream above cannot see it;
  // this is the only record that money moved.
  const payments: LedgerPaymentEvent[] = readSubscriptionPayments(sinceDays).map((row) => ({
    subId: row.subId,
    userId: row.userId,
    email: row.email,
    at: toIsoInstant(row.createdAt),
  }));

  // Subscriptions an orphan recovery created to carry an already-paid period.
  // They never raise an invoice of their own before their first renewal, so
  // neither stream above can show that they are paid for — this audit row is
  // the only record, and without it a recovered member reads as a conversion
  // charge stuck in flight for the whole honored period.
  // Both audit types write "Invoice <in_…> recovered as subscription <sub_…>",
  // so one parser serves both; only what the period MEANS differs, which the
  // kind carries.
  const recoveredRows = db
    .prepare(
      `SELECT created_at, user_id, email, message, type FROM audit_events
       WHERE type IN ('billing_orphan_payment_recovered', 'billing_paid_period_reinstated')
         AND created_at > datetime('now', '-${sinceDays} days')
       ORDER BY created_at ASC`,
    )
    .all() as Array<{
      created_at: string;
      user_id: string | null;
      email: string | null;
      message: string;
      type: string;
    }>;
  const recoveries: LedgerRecoveryEvent[] = [];
  for (const row of recoveredRows) {
    const subId = parseRecoveredSubId(row.message);
    if (!subId) continue;
    recoveries.push({
      subId,
      userId: row.user_id,
      email: row.email,
      at: toIsoInstant(row.created_at),
      invoiceId: parseRecoveredInvoiceId(row.message),
      kind: row.type === 'billing_paid_period_reinstated' ? 'comped' : 'recovered',
    });
  }

  // Declined charges, as evidence for how a subscription ended: Stripe cancels
  // one in the same instant a non-card charge fails, with no past_due for the
  // sync stream to see. Every attempt is read; the builder only needs the
  // latest before an ending.
  const declineRows = db
    .prepare(
      `SELECT created_at, message FROM audit_events
       WHERE type = 'stripe_payment_failed'
         AND created_at > datetime('now', '-${sinceDays} days')`,
    )
    .all() as Array<{ created_at: string; message: string }>;
  const declines: LedgerDeclineEvent[] = [];
  for (const row of declineRows) {
    const subId = parseSubIdFromMessage(row.message);
    if (subId) declines.push({ subId, at: toIsoInstant(row.created_at) });
  }

  // Money-back refunds, so the ending each one caused says so. Every plan but
  // Basic monthly is sold under the guarantee, and a refund cancels on the spot.
  const refundRows = db
    .prepare(
      `SELECT created_at, message FROM audit_events
       WHERE type IN (${MONEY_BACK_REFUND_AUDIT_TYPES.map((type) => `'${type}'`).join(', ')})
         AND created_at > datetime('now', '-${sinceDays} days')`,
    )
    .all() as Array<{ created_at: string; message: string }>;
  const refunds: LedgerRefundEvent[] = [];
  for (const row of refundRows) {
    const subId = parseSubIdFromMessage(row.message);
    if (subId) refunds.push({ subId, at: toIsoInstant(row.created_at) });
  }

  return buildSubscriberLedger(syncs, deletes, payments, recoveries, nowMs, { declines, refunds });
}
