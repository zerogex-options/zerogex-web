// Pure, testable accumulation of per-day paid-subscription FLOW — adds,
// reactivations, payment-failure downgrades, and cancellations — from the audit
// event stream. Extracted from core/monitoring.ts so the reconciliation logic
// can be unit-tested without a database (mirrors core/paymentGrace.ts). No
// `server-only`, DB, or fs imports, so it's safe to import from a test.
//
// THE RECONCILIATION CONTRACT: on any given day, the sum of that day's flow bars
// must equal the change in the Total Subscribers headcount (currentPayingCounts
// in core/monitoring.ts). A "subscriber" is anyone that headcount counts: a paid
// tier on file, not yet terminally downgraded — which INCLUDES a member in the
// payment-recovery grace window (subscription `past_due` but tier still
// pro/basic). So a failed payment must NOT be booked as a loss while the member
// is still in grace; it books only when access actually drops (tier -> public)
// or the subscription is deleted.
//
// The source of truth for "is this sub currently a subscriber" is the tier the
// webhook last synced: it keeps a paid tier through active, trialing, AND grace,
// and flips to `public` exactly when access is revoked. Driving the flow off
// tier public<->paid transitions therefore reconciles with the headcount by
// construction — and is backward-compatible with pre-grace history, where the
// webhook already wrote tier=public the instant a sub went past_due.

export type PaidTier = 'basic' | 'pro';
export type SyncTier = PaidTier | 'public';

// Parse the `tier=<x>` token a `stripe_subscription_sync` audit message carries.
// Returns the paid tier, an explicit `public` (a downgrade), or null when the
// token is absent/unrecognized (treated as "unknown" — never a transition).
// Legacy aliases starter->basic, elite->pro mirror currentTierCounts().
export function parseSyncTierStrict(message: string): SyncTier | null {
  const m = message.match(/\btier=(\w+)/);
  if (!m) return null;
  const t = m[1];
  if (t === 'pro' || t === 'elite') return 'pro';
  if (t === 'basic' || t === 'starter') return 'basic';
  if (t === 'public') return 'public';
  return null;
}

export type FlowSyncEvent = {
  subId: string;
  // Stripe subscription status on this sync (active/trialing/past_due/…).
  status: string | null;
  // Tier the webhook set on this sync, parsed by parseSyncTierStrict.
  tier: SyncTier | null;
  // ET day-bucket key for this event, or null if outside the window/unparseable.
  day: string | null;
};

export type FlowDeleteEvent = {
  subId: string | null;
  day: string | null;
};

export type FlowDelta = {
  proAdd: number;
  basicAdd: number;
  proReactivate: number;
  basicReactivate: number;
  proPaymentFail: number;
  basicPaymentFail: number;
  proCancel: number;
  basicCancel: number;
};

export function emptyFlowDelta(): FlowDelta {
  return {
    proAdd: 0,
    basicAdd: 0,
    proReactivate: 0,
    basicReactivate: 0,
    proPaymentFail: 0,
    basicPaymentFail: 0,
    proCancel: 0,
    basicCancel: 0,
  };
}

// Statuses meaning the subscription is failing payment. A deletion whose last
// synced status was one of these is a terminal payment failure (retries
// exhausted), not a voluntary cancel.
const DUNNING_STATUSES = new Set(['past_due', 'unpaid']);

// Accumulate the per-day flow. `syncEvents` MUST be ascending by created_at.
// Adds/reactivations are positive; payment-failure downgrades and cancellations
// are negative (so they stack below the x-axis and the day's bars sum to the
// headcount delta). Returns only days that had activity.
export function accumulateSubscriptionFlow(
  syncEvents: FlowSyncEvent[],
  deleteEvents: FlowDeleteEvent[],
): Map<string, FlowDelta> {
  const out = new Map<string, FlowDelta>();
  const book = (day: string | null, key: keyof FlowDelta, amount: number) => {
    if (!day) return;
    const d = out.get(day) ?? emptyFlowDelta();
    d[key] += amount;
    out.set(day, d);
  };

  const subscribed = new Map<string, boolean>(); // currently counted (paid tier on file)
  const everSubscribed = new Set<string>(); // ever counted — distinguishes add vs reactivation
  const lastPaidTier = new Map<string, PaidTier>(); // tier to attribute a later drop to
  const lastStatus = new Map<string, string>(); // classify a deletion (dunning vs clean)

  for (const ev of syncEvents) {
    const { subId, status, tier, day } = ev;
    if (!subId) continue;
    const wasSub = subscribed.get(subId) ?? false;

    // Counted state from the synced tier: a paid tier => subscribed; an explicit
    // `public` => downgraded; an unknown/absent tier leaves the state unchanged
    // (never fabricates a transition off a malformed message).
    let isSub = wasSub;
    if (tier === 'pro' || tier === 'basic') isSub = true;
    else if (tier === 'public') isSub = false;

    if (!wasSub && isSub) {
      const t: PaidTier = tier === 'pro' || tier === 'basic' ? tier : lastPaidTier.get(subId) ?? 'basic';
      if (everSubscribed.has(subId)) {
        // Came back after a prior drop: a recovery, not a fresh conversion.
        book(day, t === 'pro' ? 'proReactivate' : 'basicReactivate', 1);
      } else {
        book(day, t === 'pro' ? 'proAdd' : 'basicAdd', 1);
      }
    } else if (wasSub && !isSub) {
      // Lost a subscriber via a sync. The webhook only sets tier=public from a
      // non-active status (dunning), so a paid->public sync is a payment-failure
      // downgrade — booked the day access actually drops (grace expiry), NOT the
      // day the sub first entered past_due.
      const t: PaidTier = lastPaidTier.get(subId) ?? 'basic';
      book(day, t === 'pro' ? 'proPaymentFail' : 'basicPaymentFail', -1);
    }

    subscribed.set(subId, isSub);
    if (isSub) everSubscribed.add(subId);
    if (tier === 'pro' || tier === 'basic') lastPaidTier.set(subId, tier);
    if (status) lastStatus.set(subId, status);
  }

  for (const del of deleteEvents) {
    const { subId, day } = del;
    if (!subId) {
      // Unrecoverable sub id (rare — deleted messages embed one): book a cancel
      // so a real loss is never silently dropped. Matches the prior fallback.
      book(day, 'basicCancel', -1);
      continue;
    }
    // Already dropped out of the subscriber count (e.g. grace expired via a sync
    // above and was booked as a payment-failure downgrade)? Then this deletion is
    // Stripe's delayed cleanup, not a second loss — skip it (no double count).
    if (!(subscribed.get(subId) ?? false)) continue;
    const t: PaidTier = lastPaidTier.get(subId) ?? 'basic';
    // Deleted while still a subscriber: a dunning last status means retries were
    // exhausted (terminal payment failure); anything else is a voluntary cancel.
    if (DUNNING_STATUSES.has(lastStatus.get(subId) ?? '')) {
      book(day, t === 'pro' ? 'proPaymentFail' : 'basicPaymentFail', -1);
    } else {
      book(day, t === 'pro' ? 'proCancel' : 'basicCancel', -1);
    }
    subscribed.set(subId, false);
  }

  return out;
}

// --- Weekday breakdown of the per-day subscription flow --------------------
// The admin "Subscription Flow" chart plots one column per calendar day. Folding
// that per-day series onto the seven weekdays surfaces a weekly rhythm the daily
// columns bury — e.g. a Monday signup peak that fades across the week. Kept here,
// pure and DB-free, so it's unit-tested next to the accumulator that feeds it and
// can be imported by the client chart (this module has no `server-only` import).

// The nine per-day flow counts — exactly the numeric fields of a SignupFlowPoint
// (core/monitoring.ts) minus its `day`. Adds and reactivations are positive;
// cancellations and payment-failure downgrades arrive pre-negated.
export type FlowCounts = {
  proAdd: number;
  basicAdd: number;
  proReactivate: number;
  basicReactivate: number;
  proCancel: number;
  basicCancel: number;
  proPaymentFail: number;
  basicPaymentFail: number;
  registrations: number;
};

const FLOW_COUNT_KEYS: readonly (keyof FlowCounts)[] = [
  'proAdd',
  'basicAdd',
  'proReactivate',
  'basicReactivate',
  'proCancel',
  'basicCancel',
  'proPaymentFail',
  'basicPaymentFail',
  'registrations',
];

// Weekday labels in the Mon→Sun order the breakdown reads.
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// Monday-first weekday index (0=Mon … 6=Sun) for a 'YYYY-MM-DD' day key, or null
// when the key isn't a real date. Flow day keys are ET calendar dates
// (etBucketKeys in core/monitoringBuckets.ts), so the weekday is derived from the
// date parts through UTC — never the host timezone, which could otherwise shift a
// bare date across a day boundary and onto the wrong weekday. An impossible date
// (e.g. 2026-02-31, which would roll forward into March) is rejected rather than
// silently bucketed.
export function weekdayFromDayKey(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return (dt.getUTCDay() + 6) % 7; // JS 0=Sun…6=Sat → 0=Mon…6=Sun
}

export type FlowWeekdayBucket = FlowCounts & {
  weekday: number; // 0=Mon … 6=Sun
  label: string; // 'Mon' … 'Sun'
  days: number; // how many of that weekday the input holds — the averaging denominator
};

function emptyFlowCounts(): FlowCounts {
  return {
    proAdd: 0,
    basicAdd: 0,
    proReactivate: 0,
    basicReactivate: 0,
    proCancel: 0,
    basicCancel: 0,
    proPaymentFail: 0,
    basicPaymentFail: 0,
    registrations: 0,
  };
}

// Fold a per-day flow series onto the seven weekdays. Returns exactly 7 buckets
// in Mon→Sun order; each sums that weekday's flow counts and tracks `days`, the
// number of that weekday present in the input, so callers can render either raw
// totals or a fair per-day average. Averaging matters because a window doesn't
// hold each weekday an equal number of times — a 2-year span has ~104 of each,
// and a trimmed one can carry an extra Monday or two — so dividing by `days`
// removes that head-start bias before weekdays are compared. Rows whose key
// doesn't parse to a real date are skipped (never bucketed onto a guessed day).
export function accumulateFlowByWeekday(
  points: ReadonlyArray<{ day: string } & FlowCounts>,
): FlowWeekdayBucket[] {
  const buckets: FlowWeekdayBucket[] = WEEKDAY_LABELS.map((label, i) => ({
    ...emptyFlowCounts(),
    weekday: i,
    label,
    days: 0,
  }));
  for (const p of points) {
    const wd = weekdayFromDayKey(p.day);
    if (wd === null) continue;
    const b = buckets[wd];
    b.days += 1;
    for (const k of FLOW_COUNT_KEYS) b[k] += p[k];
  }
  return buckets;
}
