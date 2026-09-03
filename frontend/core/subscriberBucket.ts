// Which line of the admin "Total Subscribers" chart a single member is on.
//
// The counting itself is done in SQL (currentPayingCounts in core/monitoring.ts)
// because it's a GROUP BY over the whole users table; this is the same decision
// expressed for ONE row, so `make diagnose-user` can answer "why isn't this
// person in Trial Grace?" without anyone re-reading that SQL by hand. The two
// are kept in lockstep by tests/subscriberBucket.test.ts.
//
// Kept PURE (no imports) so it's unit-testable and usable from the standalone
// diagnostic scripts, which run outside Next's module resolution.

export type SubscriberBucketId =
  | 'fullSubscriber'
  | 'converting'
  | 'freeTrial'
  | 'trialGrace'
  | 'notCounted';

export type SubscriberBucketInput = {
  subscriptionStatus: string | null;
  // Tier as stored on the users row; legacy ids are folded here.
  tier: string | null;
  paymentGraceReason: string | null;
  cancelAtPeriodEnd?: boolean;
  // users.first_payment_at — when this member's first subscription invoice was
  // actually PAID, or null if no payment of theirs has ever cleared. This is
  // what separates Full Subscriber from Converting: Stripe flips a subscription
  // to `active` when the post-trial invoice is CREATED, about an hour before the
  // charge is attempted, so `active` on its own is evidence of an invoice, not
  // of money. Defaults to null (never paid) so a caller that hasn't been taught
  // about the column can't accidentally promote an unpaid member.
  firstPaymentAt?: string | null;
};

export type SubscriberBucketVerdict = {
  bucket: SubscriberBucketId;
  label: string;
  // Plain-language reason, written to be read by a human debugging one account.
  why: string;
};

const LABELS: Record<SubscriberBucketId, string> = {
  fullSubscriber: 'Full Subscriber',
  converting: 'Converting',
  freeTrial: 'Free Trial',
  trialGrace: 'Trial Grace',
  notCounted: 'NOT COUNTED',
};

export function normalizeBucketTier(tier: string | null): string | null {
  if (tier === 'starter') return 'basic';
  if (tier === 'elite') return 'pro';
  return tier;
}

export function classifySubscriberBucket(input: SubscriberBucketInput): SubscriberBucketVerdict {
  const status = input.subscriptionStatus;
  const tier = normalizeBucketTier(input.tier);
  const tierIsPaid = tier === 'pro' || tier === 'basic';
  const verdict = (bucket: SubscriberBucketId, why: string): SubscriberBucketVerdict => ({
    bucket,
    label: LABELS[bucket],
    why,
  });

  // ACCESS GATE, first and for every line. The tier the webhook last synced is
  // the single source of truth for "does this member have access right now": it
  // holds pro/basic through active, trialing, and grace, and flips to `public`
  // exactly when access is revoked. Two live-status states are NOT subscribers
  // and are caught only here:
  //   • a PAUSED subscription — Stripe leaves the status `active` while
  //     pause_collection is set, but the webhook grants no tier, so the member
  //     is paying nothing and getting nothing;
  //   • a trial held at the PAYMENT-SETUP GATE — `trialing` whose SetupIntent
  //     hasn't succeeded, so access was deliberately withheld.
  // Gating on the tier here is also what keeps this reconciled with the
  // subscription-flow chart, which books adds and losses off exactly these
  // paid<->public transitions (core/subscriptionFlow.ts).
  if (!tierIsPaid) {
    return verdict(
      'notCounted',
      status === 'active'
        ? "status 'active' but the tier is 'public' — a paused subscription: billing and access are both on hold"
        : status === 'trialing'
          ? "trialing but the tier is 'public' — access withheld because the card's payment setup hasn't succeeded"
          : status === 'past_due'
            ? 'past_due AND the tier has already dropped to public — no grace window is protecting this member'
            : `no paid tier on file (tier '${input.tier ?? 'null'}')`,
    );
  }

  // Free Trial is decided by STATUS, exactly as the chart's SQL does — a
  // trialer who has already clicked Cancel keeps their access to the end of the
  // trial, so they stay on this line until the trial actually lapses.
  if (status === 'trialing') {
    return verdict(
      'freeTrial',
      input.cancelAtPeriodEnd
        ? 'trialing with a cancel already scheduled — still counted here until the trial ends'
        : 'trialing',
    );
  }

  // Trial Grace: the trial lapsed, the FIRST charge was declined, and a recovery
  // window is holding their paid tier.
  if (status === 'past_due' && input.paymentGraceReason === 'trial') {
    return verdict(
      'trialGrace',
      'past_due, the first charge after the trial was declined, still inside the recovery window',
    );
  }

  if (status === 'active') {
    // The trial→paid step, split by whether money has actually moved. Stripe
    // creates the post-trial invoice and flips the subscription to `active`
    // roughly an hour BEFORE it attempts the charge, so an `active` with no
    // recorded payment is a charge in flight, not a customer. Counting it as a
    // Full Subscriber is what used to make the line tick up and then back down
    // an hour later when the card declined.
    return input.firstPaymentAt
      ? verdict('fullSubscriber', `active, first payment cleared ${input.firstPaymentAt}`)
      : verdict(
          'converting',
          'active but no payment has ever cleared — the post-trial invoice exists and the charge is still in flight',
        );
  }

  // A renewal-failure grace window (or one opened before the reason column
  // existed) counts as a full subscriber: an established payer whose access has
  // not actually dropped. They reached a renewal, so they have paid by
  // definition — no firstPaymentAt gate here, which also keeps rows predating
  // the column on the line they have always been on.
  if (status === 'past_due') {
    return verdict(
      'fullSubscriber',
      `past_due inside a '${input.paymentGraceReason ?? 'unattributed'}' grace window — ` +
        'renewal grace counts as a full subscriber because access never dropped',
    );
  }

  return verdict('notCounted', `status '${status ?? 'null'}' is outside the chart entirely`);
}

// ── The ledger ─────────────────────────────────────────────────────────────
// Every change to the subscriber headcount, in order, with the member it
// happened to, why, and what it did to each line of the chart.
//
// The charts answer "how many"; this answers "who, and what just moved the
// number". Without it a Full Subscriber count ticking 105 -> 104 is a mystery
// that costs a `make diagnose-user` guess to solve, and a scheduled
// cancellation silently becomes a surprise a month later when it takes effect.
//
// Driven off the `stripe_subscription_sync` audit stream because that IS what
// moves the headcount: the webhook writes a row on every subscription state
// change carrying the status, the tier it granted, and the cancel flag — the
// exact inputs the buckets above are computed from. Walking that stream per
// subscription and emitting a row whenever the derived bucket (or the cancel
// flag) actually changes reproduces the headcount's history by construction,
// and skips the many no-op re-syncs Stripe sends in between.
//
// The `stripe_first_payment` stream is merged in alongside it, because the
// Converting -> Full Subscriber step is the one transition the sync stream
// cannot see: nothing about the subscription changes when its invoice is paid.
//
// It lives in this file rather than its own so there is exactly ONE bucket
// rule: the ledger classifies with classifySubscriberBucket above, so a change
// to the chart's buckets moves the ledger with it automatically.

// How long an `active` with no observed payment stays in Converting before the
// ledger accepts it as paid, in days. This is a FALLBACK for history the
// payment stream doesn't cover — subscriptions that converted before
// `stripe_first_payment` was being written, which are exactly the rows the
// users.first_payment_at backfill marks as paid. A real payment event promotes
// immediately and is always preferred. Mirrors CONVERSION_CONFIRM_DAYS in
// core/trialConveyor and the window in core/trialDunning, for the same reason.
const CONVERSION_CONFIRM_DAYS = 2;

const DAY_MS = 86_400_000;

export type LedgerEventKind =
  | 'trialStarted'
  | 'conversionPending'
  | 'converted'
  | 'trialChargeDeclined'
  | 'renewalFailed'
  | 'recovered'
  | 'cancelScheduled'
  | 'cancelReverted'
  | 'paused'
  | 'resumed'
  | 'accessEnded';

export type LedgerRow = {
  at: string;
  email: string | null;
  userId: string | null;
  kind: LedgerEventKind;
  // What this did to each line of the Total Subscribers chart. Summing the
  // deltas over a window reproduces that line's movement across it, which is
  // what makes "why did Full Subscribers drop" answerable by reading one row.
  fullSubscriberDelta: number;
  convertingDelta: number;
  freeTrialDelta: number;
  trialGraceDelta: number;
  // Plain-language explanation, written for someone scanning the ledger.
  detail: string;
};

export type LedgerSyncEvent = {
  subId: string;
  userId: string | null;
  email: string | null;
  at: string;
  status: string | null;
  // Tier the webhook granted on this sync ('pro' | 'basic' | 'public').
  tier: string | null;
  cancelAtPeriodEnd: boolean;
};

// A subscription invoice that actually got PAID. Only the first one per
// subscription matters here (it's what promotes Converting -> Full Subscriber);
// later renewals are no-ops.
export type LedgerPaymentEvent = {
  subId: string;
  userId: string | null;
  email: string | null;
  at: string;
};

export type LedgerDeleteEvent = {
  subId: string | null;
  userId: string | null;
  email: string | null;
  at: string;
  // Cancellation-survey reason carried on the terminal row, when Stripe sent one.
  reason?: string | null;
};

const KIND_LABELS: Record<LedgerEventKind, string> = {
  trialStarted: 'Trial started',
  conversionPending: 'Conversion charge pending',
  converted: 'Converted to paying',
  trialChargeDeclined: 'First charge declined',
  renewalFailed: 'Renewal payment failed',
  recovered: 'Payment recovered',
  cancelScheduled: 'Cancellation scheduled',
  cancelReverted: 'Cancellation reversed',
  paused: 'Subscription paused',
  resumed: 'Subscription resumed',
  accessEnded: 'Access ended',
};

export function ledgerKindLabel(kind: LedgerEventKind): string {
  return KIND_LABELS[kind];
}

// Headcount deltas implied by moving between two chart buckets. `notCounted`
// covers both "not on the chart yet" and "left the chart", so a member's first
// appearance and their departure are both expressed here.
function bucketDeltas(
  from: SubscriberBucketId | null,
  to: SubscriberBucketId,
): Pick<LedgerRow, 'fullSubscriberDelta' | 'convertingDelta' | 'freeTrialDelta' | 'trialGraceDelta'> {
  const score = (b: SubscriberBucketId | null) => ({
    full: b === 'fullSubscriber' ? 1 : 0,
    converting: b === 'converting' ? 1 : 0,
    trial: b === 'freeTrial' ? 1 : 0,
    grace: b === 'trialGrace' ? 1 : 0,
  });
  const a = score(from);
  const b = score(to);
  return {
    fullSubscriberDelta: b.full - a.full,
    convertingDelta: b.converting - a.converting,
    freeTrialDelta: b.trial - a.trial,
    trialGraceDelta: b.grace - a.grace,
  };
}

type SubState = {
  bucket: SubscriberBucketId | null;
  // Last identity seen on this subscription, so a row the walk synthesizes
  // (a conversion settled by the fallback window) still names the member.
  email: string | null;
  userId: string | null;
  cancelAtPeriodEnd: boolean;
  // An established payer is currently in dunning (past_due with access kept).
  dunning: boolean;
  sawTrial: boolean;
  // Timestamp (ms) of the first `active` sync, used to tell a trial still at its
  // first charge from an established payer whose renewal failed.
  firstActiveMs: number | null;
  // Set once a payment of theirs has cleared (a real event, or the fallback
  // window below elapsing). Feeds classifySubscriberBucket's firstPaymentAt.
  paidAt: string | null;
  // Currently dropped out of the chart by a pause rather than a lapse, so the
  // return trip can be reported as a resume instead of a new subscription.
  paused: boolean;
  ended: boolean;
};

// Whether a past_due on this sub is the trial's FIRST charge failing rather than
// an established renewal. True when the sub had a trial and has not yet held
// `active` for longer than the confirmation window — the order-independent test,
// since Stripe's trial-end `active` sync lands before the charge is attempted.
function isTrialPhase(s: SubState, nowMs: number): boolean {
  if (!s.sawTrial) return false;
  if (s.firstActiveMs == null) return true;
  return nowMs - s.firstActiveMs <= CONVERSION_CONFIRM_DAYS * DAY_MS;
}

/**
 * Build the ledger from the audit streams. All three are merged into one
 * chronological walk, so none of them needs to arrive pre-sorted; the returned
 * rows are newest-first, ready to render. `nowMs` closes out the fallback
 * confirmation window for any conversion still pending at the end of the scan.
 */
export function buildSubscriberLedger(
  syncs: LedgerSyncEvent[],
  deletes: LedgerDeleteEvent[],
  payments: LedgerPaymentEvent[] = [],
  nowMs: number = Date.now(),
): LedgerRow[] {
  const rows: LedgerRow[] = [];
  const subs = new Map<string, SubState>();

  const stateFor = (subId: string): SubState => {
    let s = subs.get(subId);
    if (!s) {
      s = {
        bucket: null,
        email: null,
        userId: null,
        cancelAtPeriodEnd: false,
        dunning: false,
        sawTrial: false,
        firstActiveMs: null,
        paidAt: null,
        paused: false,
        ended: false,
      };
      subs.set(subId, s);
    }
    return s;
  };

  const push = (
    ev: { at: string; email: string | null; userId: string | null },
    s: SubState,
    kind: LedgerEventKind,
    to: SubscriberBucketId,
    detail: string,
  ) => {
    rows.push({
      at: ev.at,
      email: ev.email,
      userId: ev.userId,
      kind,
      ...bucketDeltas(s.bucket, to),
      detail,
    });
    s.bucket = to;
  };

  // Promote a subscription whose `active` has outlived the fallback window
  // without a payment event. Runs lazily against each event's own clock (and
  // once more at the end), so a conversion the payment stream never covered
  // still lands on the day it effectively became real rather than never.
  const settleDue = (atMs: number) => {
    for (const [subId, s] of subs) {
      if (s.bucket !== 'converting' || s.paidAt || s.ended) continue;
      if (s.firstActiveMs == null) continue;
      const dueMs = s.firstActiveMs + CONVERSION_CONFIRM_DAYS * DAY_MS;
      if (dueMs > atMs) continue;
      const at = new Date(dueMs).toISOString();
      s.paidAt = at;
      push(
        { at, email: s.email, userId: s.userId },
        s,
        'converted',
        'fullSubscriber',
        'The conversion charge was never reported as failed — counted as paid',
      );
      void subId;
    }
  };

  // ONE ordered timeline across all three streams. Every stream has to be walked
  // in real time together, because the fallback window above fires between
  // events: a trial whose charge fails an hour after `active` is deleted long
  // before its two days are up, and settling that conversion first would report
  // a member who never paid as having converted, then immediately churned.
  // Ties resolve sync -> payment -> delete, the order the states depend on.
  type Step = {
    at: number;
    rank: number;
    sync?: LedgerSyncEvent;
    payment?: LedgerPaymentEvent;
    del?: LedgerDeleteEvent;
  };
  const steps: Step[] = [];
  for (const ev of syncs) {
    if (!ev.subId) continue;
    const at = Date.parse(ev.at);
    if (Number.isFinite(at)) steps.push({ at, rank: 0, sync: ev });
  }
  for (const ev of payments) {
    if (!ev.subId) continue;
    const at = Date.parse(ev.at);
    if (Number.isFinite(at)) steps.push({ at, rank: 1, payment: ev });
  }
  for (const ev of deletes) {
    if (!ev.subId) continue;
    const at = Date.parse(ev.at);
    if (Number.isFinite(at)) steps.push({ at, rank: 2, del: ev });
  }
  steps.sort((a, b) => a.at - b.at || a.rank - b.rank);

  for (const step of steps) {
    settleDue(step.at);

    if (step.payment) {
      const ev = step.payment;
      const s = stateFor(ev.subId);
      if (ev.email) s.email = ev.email;
      if (ev.userId) s.userId = ev.userId;
      if (s.paidAt) continue; // a renewal, not the first payment
      s.paidAt = ev.at;
      if (s.bucket === 'converting') {
        push(ev, s, 'converted', 'fullSubscriber', 'The first payment cleared — now a paying subscriber');
      }
      continue;
    }

    // Terminal removals. Stripe deletes a subscription outright (with no
    // past_due at all) when a post-trial charge fails on a payment method it
    // won't retry, so this is a real departure path, not just the end of a
    // scheduled cancel.
    if (step.del) {
      const ev = step.del;
      const s = subs.get(ev.subId!);
      if (!s || s.ended) continue;
      s.ended = true;
      if (s.bucket === 'notCounted' || s.bucket === null) continue; // already off the chart
      const scheduled = s.cancelAtPeriodEnd;
      rows.push({
        at: ev.at,
        email: ev.email,
        userId: ev.userId,
        kind: 'accessEnded',
        ...bucketDeltas(s.bucket, 'notCounted'),
        detail: scheduled
          ? `Scheduled cancellation took effect — access ended${ev.reason ? ` (${ev.reason})` : ''}`
          : isTrialPhase(s, step.at)
            ? 'Trial ended, the first charge failed and Stripe canceled the subscription'
            : `Subscription ended${ev.reason ? ` (${ev.reason})` : ''}`,
      });
      s.bucket = 'notCounted';
      continue;
    }

    const ev = step.sync!;
    const atMs = step.at;
    const s = stateFor(ev.subId);
    if (ev.email) s.email = ev.email;
    if (ev.userId) s.userId = ev.userId;

    if (ev.status === 'trialing') s.sawTrial = true;
    const trialPhase = isTrialPhase(s, atMs);
    if (ev.status === 'active' && s.firstActiveMs == null) s.firstActiveMs = atMs;

    // A past_due whose window was opened by a trial conversion belongs on the
    // Trial Grace line; an established payer's belongs with the full
    // subscribers. Derived rather than read from the row because the ledger
    // only has what the sync message carries.
    const derivedGraceReason =
      ev.status === 'past_due' ? (trialPhase ? 'trial' : 'renewal') : null;
    const next = classifySubscriberBucket({
      subscriptionStatus: ev.status,
      tier: ev.tier,
      paymentGraceReason: derivedGraceReason,
      cancelAtPeriodEnd: ev.cancelAtPeriodEnd,
      firstPaymentAt: s.paidAt,
    }).bucket;

    if (next !== s.bucket) {
      // First sighting of a subscription that isn't on the chart (a trial held
      // at the payment-setup gate, say) is not an event — it never arrived.
      if (s.bucket === null && next === 'notCounted') {
        s.bucket = next;
      } else if (next === 'freeTrial') {
        push(ev, s, 'trialStarted', next, 'Free trial began — card on file, no charge yet');
      } else if (next === 'converting') {
        push(
          ev,
          s,
          'conversionPending',
          next,
          'Trial ended and Stripe raised the first invoice — the charge has not been attempted yet',
        );
      } else if (next === 'trialGrace') {
        push(
          ev,
          s,
          'trialChargeDeclined',
          next,
          'The first charge after the trial was declined — Stripe is retrying, access retained for now',
        );
      } else if (next === 'fullSubscriber') {
        if (s.bucket === 'trialGrace') {
          push(ev, s, 'recovered', next, 'The retry went through — now a paying subscriber');
        } else if (s.paused) {
          s.paused = false;
          push(ev, s, 'resumed', next, 'Pause ended — billing restarted and access restored');
        } else if (s.bucket === 'notCounted') {
          push(ev, s, 'converted', next, 'Resubscribed — paying again');
        } else {
          push(ev, s, 'converted', next, 'New paying subscriber');
        }
      } else if (ev.status === 'active') {
        // Live subscription, no tier granted: Stripe keeps a paused sub
        // `active`, so this is the retention pause, not a departure.
        s.paused = true;
        push(ev, s, 'paused', next, 'Subscription paused — billing and access on hold; this is not churn');
      } else {
        push(
          ev,
          s,
          'accessEnded',
          next,
          s.bucket === 'freeTrial'
            ? trialPhase
              ? 'Trial ended without a successful charge — access removed'
              : 'Trial ended — access removed'
            : 'Subscription lapsed — access removed',
        );
      }
    }

    // Dunning on an ESTABLISHED payer moves no counts (access is retained
    // through the recovery window) so it produces no bucket change — but it is
    // exactly the kind of thing that must not stay invisible until it becomes a
    // departure, so it gets its own row, and so does the recovery.
    if (ev.status === 'past_due' && next === 'fullSubscriber' && !s.dunning) {
      s.dunning = true;
      rows.push({
        at: ev.at,
        email: ev.email,
        userId: ev.userId,
        kind: 'renewalFailed',
        fullSubscriberDelta: 0,
        convertingDelta: 0,
        freeTrialDelta: 0,
        trialGraceDelta: 0,
        detail: 'A renewal charge was declined — access retained while Stripe retries',
      });
    } else if (ev.status === 'active' && s.dunning) {
      s.dunning = false;
      rows.push({
        at: ev.at,
        email: ev.email,
        userId: ev.userId,
        kind: 'recovered',
        fullSubscriberDelta: 0,
        convertingDelta: 0,
        freeTrialDelta: 0,
        trialGraceDelta: 0,
        detail: 'The declined renewal was paid — no longer at risk',
      });
    }

    // The cancel flag moves no counts (they keep access to period end) but it is
    // the single best early warning there is, so it always gets a row.
    if (ev.cancelAtPeriodEnd !== s.cancelAtPeriodEnd && !s.ended) {
      s.cancelAtPeriodEnd = ev.cancelAtPeriodEnd;
      rows.push({
        at: ev.at,
        email: ev.email,
        userId: ev.userId,
        kind: ev.cancelAtPeriodEnd ? 'cancelScheduled' : 'cancelReverted',
        fullSubscriberDelta: 0,
        convertingDelta: 0,
        freeTrialDelta: 0,
        trialGraceDelta: 0,
        detail: ev.cancelAtPeriodEnd
          ? 'Clicked Cancel — keeps access until the period ends, then drops off'
          : 'Cancellation reversed — staying on',
      });
    }
  }

  // Close out any conversion still inside its fallback window against the wall
  // clock, so a real one isn't withheld from the ledger just because no later
  // event happened to arrive.
  settleDue(nowMs);

  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// Net movement of each chart line across the rows, so a header can state "Full
// Subscribers moved -2 over this window" and the rows below account for it.
export function summarizeLedger(rows: LedgerRow[]): {
  fullSubscriber: number;
  converting: number;
  freeTrial: number;
  trialGrace: number;
} {
  return rows.reduce(
    (acc, r) => ({
      fullSubscriber: acc.fullSubscriber + r.fullSubscriberDelta,
      converting: acc.converting + r.convertingDelta,
      freeTrial: acc.freeTrial + r.freeTrialDelta,
      trialGrace: acc.trialGrace + r.trialGraceDelta,
    }),
    { fullSubscriber: 0, converting: 0, freeTrial: 0, trialGrace: 0 },
  );
}
