// Which audit rows record a member deciding to leave. The Forward-Looking Growth
// Rate card (core/monitoring.ts) and the Growth tab's daily `cancels` column
// (core/dailyMetrics.ts) count cancellations off these rows, so the rule lives
// once, here. Kept pure (no imports) so both can load it, including the bare-Node
// backfill script behind dailyMetrics.

// A Cancel click: the request row and the acknowledgment email row, both written
// when cancel_at_period_end flips on. One click emits both, so callers dedupe
// per member per day.
export const CANCEL_CLICK_AUDIT_TYPES = ['stripe_cancellation_requested', 'cancellation_ack_email_sent'] as const;

// A money-back refund. It cancels the subscription on the spot rather than at
// period end, so it never writes a Cancel-click row, and without these it would
// not count as a cancellation at all: a refunded signup would stay a +1 on the
// growth-rate card for good. `incomplete` is a refund that went through with a
// later step failing; the re-run that finishes it writes `issued` for the same
// subscription.
export const MONEY_BACK_REFUND_AUDIT_TYPES = ['money_back_refund_issued', 'money_back_refund_incomplete'] as const;

export const CANCEL_DECISION_AUDIT_TYPES: readonly string[] = [
  ...CANCEL_CLICK_AUDIT_TYPES,
  ...MONEY_BACK_REFUND_AUDIT_TYPES,
];

const CLICK_TYPES = new Set<string>(CANCEL_CLICK_AUDIT_TYPES);
const REFUND_TYPES = new Set<string>(MONEY_BACK_REFUND_AUDIT_TYPES);

function subscriptionIdOf(message: string): string | null {
  const m = message.match(/sub_[A-Za-z0-9]+/);
  return m ? m[0] : null;
}

/**
 * The rows that are a decision to leave, from audit rows sorted oldest-first:
 * every Cancel click, and the first money-back refund on a subscription that had
 * no Cancel click before it. A member who clicked Cancel and then asked for
 * their money back decided once, on the day they clicked. Rows of any other type
 * are ignored, so a caller can pass its whole query.
 */
export function cancelDecisionRows<T extends { type: string; message: string }>(rows: readonly T[]): T[] {
  const decided = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (!CLICK_TYPES.has(row.type) && !REFUND_TYPES.has(row.type)) continue;
    const subId = subscriptionIdOf(row.message);
    if (REFUND_TYPES.has(row.type) && subId && decided.has(subId)) continue;
    if (subId) decided.add(subId);
    out.push(row);
  }
  return out;
}
