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

export type SubscriberBucketId = 'fullSubscriber' | 'freeTrial' | 'trialGrace' | 'notCounted';

export type SubscriberBucketInput = {
  subscriptionStatus: string | null;
  // Tier as stored on the users row; legacy ids are folded here.
  tier: string | null;
  paymentGraceReason: string | null;
  cancelAtPeriodEnd?: boolean;
};

export type SubscriberBucketVerdict = {
  bucket: SubscriberBucketId;
  label: string;
  // Plain-language reason, written to be read by a human debugging one account.
  why: string;
};

const LABELS: Record<SubscriberBucketId, string> = {
  fullSubscriber: 'Full Subscriber',
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

  // Free Trial is decided by STATUS alone, exactly as the chart's SQL does — a
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
  // window is holding their paid tier. Requires the tier to still be granted —
  // once it drops to public the member has left the chart entirely.
  if (status === 'past_due' && input.paymentGraceReason === 'trial' && tierIsPaid) {
    return verdict(
      'trialGrace',
      'past_due, the first charge after the trial was declined, still inside the recovery window',
    );
  }

  if (status === 'active') {
    return verdict('fullSubscriber', 'active');
  }

  // A renewal-failure grace window (or one opened before the reason column
  // existed) counts as a full subscriber: an established payer whose access has
  // not actually dropped.
  if (status === 'past_due' && tierIsPaid) {
    return verdict(
      'fullSubscriber',
      `past_due inside a '${input.paymentGraceReason ?? 'unattributed'}' grace window — ` +
        'renewal grace counts as a full subscriber because access never dropped',
    );
  }

  // Everything else is off the chart. The past_due case is the one worth
  // spelling out: it is what a Full Subscriber count falling by one looks like.
  return verdict(
    'notCounted',
    status === 'past_due'
      ? 'past_due AND the tier has already dropped to public — no grace window is protecting this member'
      : `status '${status ?? 'null'}' is outside the chart entirely`,
  );
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
// It lives in this file rather than its own so there is exactly ONE bucket
// rule: the ledger classifies with classifySubscriberBucket above, so a change
// to the chart's buckets moves the ledger with it automatically.

// Days an `active` sync must survive before the member counts as an ESTABLISHED
// payer rather than a trial still at its first charge. Mirrors
// CONVERSION_CONFIRM_DAYS in core/trialConveyor and the window in
// core/trialDunning, and for the same reason: Stripe flips a subscription to
// `active` when the post-trial invoice is created, about an hour before the
// charge is attempted, so a fresh `active` is not yet evidence of payment.
const ESTABLISHED_AFTER_DAYS = 2;

const DAY_MS = 86_400_000;

export type LedgerEventKind =
  | 'trialStarted'
  | 'converted'
  | 'trialChargeDeclined'
  | 'renewalFailed'
  | 'recovered'
  | 'cancelScheduled'
  | 'cancelReverted'
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
  converted: 'Converted to paying',
  trialChargeDeclined: 'First charge declined',
  renewalFailed: 'Renewal payment failed',
  recovered: 'Payment recovered',
  cancelScheduled: 'Cancellation scheduled',
  cancelReverted: 'Cancellation reversed',
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
): Pick<LedgerRow, 'fullSubscriberDelta' | 'freeTrialDelta' | 'trialGraceDelta'> {
  const score = (b: SubscriberBucketId | null) => ({
    full: b === 'fullSubscriber' ? 1 : 0,
    trial: b === 'freeTrial' ? 1 : 0,
    grace: b === 'trialGrace' ? 1 : 0,
  });
  const a = score(from);
  const b = score(to);
  return {
    fullSubscriberDelta: b.full - a.full,
    freeTrialDelta: b.trial - a.trial,
    trialGraceDelta: b.grace - a.grace,
  };
}

type SubState = {
  bucket: SubscriberBucketId | null;
  cancelAtPeriodEnd: boolean;
  // An established payer is currently in dunning (past_due with access kept).
  dunning: boolean;
  sawTrial: boolean;
  // Timestamp (ms) of the first `active` sync, used to tell a trial still at its
  // first charge from an established payer whose renewal failed.
  firstActiveMs: number | null;
  ended: boolean;
};

// Whether a past_due on this sub is the trial's FIRST charge failing rather than
// an established renewal. True when the sub had a trial and has not yet held
// `active` for longer than the confirmation window — the order-independent test,
// since Stripe's trial-end `active` sync lands before the charge is attempted.
function isTrialPhase(s: SubState, nowMs: number): boolean {
  if (!s.sawTrial) return false;
  if (s.firstActiveMs == null) return true;
  return nowMs - s.firstActiveMs <= ESTABLISHED_AFTER_DAYS * DAY_MS;
}

/**
 * Build the ledger from the audit streams. `syncs` must be ordered oldest-first;
 * the returned rows are newest-first, ready to render.
 */
export function buildSubscriberLedger(
  syncs: LedgerSyncEvent[],
  deletes: LedgerDeleteEvent[],
): LedgerRow[] {
  const rows: LedgerRow[] = [];
  const subs = new Map<string, SubState>();

  const stateFor = (subId: string): SubState => {
    let s = subs.get(subId);
    if (!s) {
      s = { bucket: null, cancelAtPeriodEnd: false, dunning: false, sawTrial: false, firstActiveMs: null, ended: false };
      subs.set(subId, s);
    }
    return s;
  };

  for (const ev of syncs) {
    if (!ev.subId) continue;
    const atMs = Date.parse(ev.at);
    if (!Number.isFinite(atMs)) continue;
    const s = stateFor(ev.subId);

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
    }).bucket;

    const emit = (kind: LedgerEventKind, detail: string, to: SubscriberBucketId) => {
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

    if (next !== s.bucket) {
      if (next === 'freeTrial') {
        emit('trialStarted', 'Free trial began — card on file, no charge yet', next);
      } else if (next === 'trialGrace') {
        emit(
          'trialChargeDeclined',
          'The first charge after the trial was declined — Stripe is retrying, access retained for now',
          next,
        );
      } else if (next === 'fullSubscriber') {
        if (s.bucket === 'trialGrace') {
          emit('recovered', 'The retry went through — now a paying subscriber', next);
        } else if (s.bucket === 'freeTrial') {
          emit('converted', 'Trial ended and the subscription went active', next);
        } else if (s.bucket === 'notCounted') {
          emit('converted', 'Resubscribed — paying again', next);
        } else {
          emit('converted', 'New paying subscriber', next);
        }
      } else {
        emit(
          'accessEnded',
          s.bucket === 'freeTrial'
            ? trialPhase
              ? 'Trial ended without a successful charge — access removed'
              : 'Trial ended — access removed'
            : 'Subscription lapsed — access removed',
          next,
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
        freeTrialDelta: 0,
        trialGraceDelta: 0,
        detail: ev.cancelAtPeriodEnd
          ? 'Clicked Cancel — keeps access until the period ends, then drops off'
          : 'Cancellation reversed — staying on',
      });
    }
  }

  // Terminal removals. Stripe deletes a subscription outright (with no past_due
  // at all) when a post-trial charge fails on a payment method it won't retry,
  // so this is a real departure path, not just the end of a scheduled cancel.
  for (const ev of deletes) {
    if (!ev.subId) continue;
    const s = subs.get(ev.subId);
    if (!s || s.ended) continue;
    const atMs = Date.parse(ev.at);
    if (!Number.isFinite(atMs)) continue;
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
        : isTrialPhase(s, atMs)
          ? 'Trial ended, the first charge failed and Stripe canceled the subscription'
          : `Subscription ended${ev.reason ? ` (${ev.reason})` : ''}`,
    });
    s.bucket = 'notCounted';
  }

  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// Net movement of each chart line across the rows, so a header can state "Full
// Subscribers moved -2 over this window" and the rows below account for it.
export function summarizeLedger(rows: LedgerRow[]): {
  fullSubscriber: number;
  freeTrial: number;
  trialGrace: number;
} {
  return rows.reduce(
    (acc, r) => ({
      fullSubscriber: acc.fullSubscriber + r.fullSubscriberDelta,
      freeTrial: acc.freeTrial + r.freeTrialDelta,
      trialGrace: acc.trialGrace + r.trialGraceDelta,
    }),
    { fullSubscriber: 0, freeTrial: 0, trialGrace: 0 },
  );
}
