// Which cancellations and payment failures the Forward-Looking Growth Rate
// (core/monitoring.ts) still counts as a lost subscriber. Kept free of the
// database so the rule is tested on its own; monitoring hands it the rows.
//
// A loss is counted when it happens, not when access ends, and it stops
// counting once the member undoes it:
//   • a cancellation (a Cancel click, or a money-back refund) is undone when
//     the subscription's scheduled cancel is cleared while it is still live:
//     "Keep my plan", the /save link, a win-back, a pause chosen instead, a
//     plan switch, or un-canceling in the Stripe portal;
//   • a payment failure (a Subscriber Ledger row flagged `paymentFailure`) is
//     undone when the declined bill is paid and the member is paying again.
//
// A subscription has at most one loss counted at a time. A member whose charge
// was declined and who then clicked Cancel is leaving once, not twice, so the
// later of the two waits behind the first and is only counted if the first is
// undone while it still stands.

import { cancelDecisionRows } from './cancelDecisions.ts';
import type { LedgerRow } from './subscriberBucket.ts';

export type LossKind = 'cancel' | 'failure';

export type LossEvent = {
  kind: LossKind;
  // true when this event undoes the kind rather than starting it.
  undo: boolean;
  // The Stripe subscription it happened to. Events are paired by this key; one
  // with no subscription id stands alone.
  subId: string | null;
  // The member, for an event with no subscription id to pair it by.
  who: string;
  atMs: number;
};

export type Loss = {
  kind: LossKind;
  atMs: number;
  // When the member undid it, or null while it still stands.
  undoneAtMs: number | null;
};

type Open = { atMs: number } | null;

export function settleLosses(events: readonly LossEvent[]): Loss[] {
  // Oldest first. On a tie the start goes ahead of the undo, so a cancel and
  // its reversal stamped in the same second still pair up.
  const sorted = events
    .filter((ev) => Number.isFinite(ev.atMs))
    .slice()
    .sort((a, b) => a.atMs - b.atMs || Number(a.undo) - Number(b.undo));

  const subs = new Map<string, { open: Record<LossKind, Open>; counted: Loss | null }>();
  const losses: Loss[] = [];

  for (const ev of sorted) {
    const key = ev.subId ?? `who:${ev.who}`;
    let sub = subs.get(key);
    if (!sub) {
      sub = { open: { cancel: null, failure: null }, counted: null };
      subs.set(key, sub);
    }
    const other: LossKind = ev.kind === 'cancel' ? 'failure' : 'cancel';

    if (!ev.undo) {
      // A second row for a decision already standing (the Cancel click and its
      // acknowledgment email, a refund after a click) is the same decision.
      if (sub.open[ev.kind]) continue;
      sub.open[ev.kind] = { atMs: ev.atMs };
      if (!sub.counted) {
        sub.counted = { kind: ev.kind, atMs: ev.atMs, undoneAtMs: null };
        losses.push(sub.counted);
      }
      continue;
    }

    if (!sub.open[ev.kind]) continue;
    sub.open[ev.kind] = null;
    if (sub.counted?.kind !== ev.kind) continue;
    sub.counted.undoneAtMs = ev.atMs;
    sub.counted = null;
    // The one waiting behind it still stands, so it counts now, on its own
    // moment.
    const waiting = sub.open[other];
    if (waiting) {
      sub.counted = { kind: other, atMs: waiting.atMs, undoneAtMs: null };
      losses.push(sub.counted);
    }
  }

  return losses;
}

// The ledger's side: each row flagged `paymentFailure` starts a failure, and
// the subscription paying again undoes it. That is a `recovered` row for a
// renewal in dunning. For a declined trial charge it is whichever row puts the
// member on Full Subscribers: `recovered` when the payment lands before the
// subscription turns active, `converted` when it lands just after, which is how
// Stripe's successful retry usually arrives.
export function failureEvents(
  rows: readonly Pick<LedgerRow, 'at' | 'kind' | 'paymentFailure' | 'subId' | 'userId' | 'fullSubscriberDelta'>[],
): LossEvent[] {
  const out: LossEvent[] = [];
  for (const row of rows) {
    const undo = row.kind === 'recovered' || row.fullSubscriberDelta > 0;
    if (!row.paymentFailure && !undo) continue;
    out.push({ kind: 'failure', undo, subId: row.subId, who: row.userId ?? row.subId, atMs: Date.parse(row.at) });
  }
  return out;
}

export type CancelAuditRow = { type: string; user_id: string | null; created_at: string; message: string };

// The audit types cancelEvents reads beyond the cancel decisions themselves.
export const CANCEL_REVERSAL_AUDIT_TYPES = [
  'stripe_subscription_sync',
  'billing_winback_discount_honored',
  'billing_cancel_reverted_in_app',
] as const;

function subIdOf(message: string): string | null {
  const m = message.match(/sub_[A-Za-z0-9]+/);
  return m ? m[0] : null;
}

// The audit side, from rows sorted oldest-first: every decision to leave
// (core/cancelDecisions.ts) starts a cancellation, and a cancel cleared while
// the subscription is still live undoes it. The subscription sync is what sees
// every way a cancel gets cleared, the Stripe portal included. The in-app
// "Keep my plan" and win-back rows say the same at the moment it happens, in
// case the webhook's sync is late or lost.
export function cancelEvents(rows: readonly CancelAuditRow[]): LossEvent[] {
  const decisions = new Set(cancelDecisionRows(rows));
  const scheduled = new Set<string>();
  const out: LossEvent[] = [];
  for (const row of rows) {
    const atMs = new Date(row.created_at).getTime();
    const subId = subIdOf(row.message);
    if (row.type === 'stripe_subscription_sync') {
      if (!subId) continue;
      const nowScheduled = /\bcancelAtPeriodEnd=true\b/.test(row.message);
      const status = row.message.match(/\bstatus=([A-Za-z_]+)/)?.[1] ?? null;
      const live = status != null && status !== 'canceled' && status !== 'incomplete_expired';
      if (scheduled.has(subId) && !nowScheduled && live) {
        out.push({ kind: 'cancel', undo: true, subId, who: row.user_id ?? subId, atMs });
      }
      if (nowScheduled) scheduled.add(subId);
      else scheduled.delete(subId);
    } else if (row.type === 'billing_winback_discount_honored' || row.type === 'billing_cancel_reverted_in_app') {
      // A win-back run with --keep-cancellation only pre-loads a coupon and
      // leaves the cancel standing; its message says "cleared
      // cancel_at_period_end" exactly when it took one back.
      const undid = row.type === 'billing_cancel_reverted_in_app' || /cleared cancel_at_period_end/.test(row.message);
      if (undid && subId) out.push({ kind: 'cancel', undo: true, subId, who: row.user_id ?? subId, atMs });
    } else if (decisions.has(row)) {
      out.push({ kind: 'cancel', undo: false, subId, who: row.user_id ?? row.message, atMs });
    }
  }
  return out;
}
