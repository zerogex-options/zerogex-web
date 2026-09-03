import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSubscriberLedger,
  classifySubscriberBucket,
  normalizeBucketTier,
  summarizeLedger,
  type LedgerPaymentEvent,
  type LedgerSyncEvent,
  type SubscriberBucketInput,
} from '../core/subscriberBucket.ts';

// This classifier must agree, row for row, with the GROUP BY in
// currentPayingCounts (core/monitoring.ts) that draws the Total Subscribers
// chart. That SQL is reproduced here as the oracle, so the two can't drift:
// if someone edits the chart's buckets without editing this, these fail.
//
//   WHERE tier IN ('pro','basic','elite','starter')
//     AND subscription_status IN ('active','trialing','past_due')
//   CASE WHEN subscription_status = 'trialing'                  THEN 'trialing'
//        WHEN subscription_status = 'past_due'
//             AND payment_grace_reason = 'trial'                THEN 'graceTrial'
//        WHEN subscription_status = 'active'
//             AND first_payment_at IS NULL                      THEN 'converting'
//        ELSE                                                        'active'
function sqlOracle(row: SubscriberBucketInput): string {
  const tier = normalizeBucketTier(row.tier);
  const inWhere =
    (tier === 'pro' || tier === 'basic') &&
    (row.subscriptionStatus === 'active' ||
      row.subscriptionStatus === 'trialing' ||
      row.subscriptionStatus === 'past_due');
  if (!inWhere) return 'notCounted';
  if (row.subscriptionStatus === 'trialing') return 'freeTrial';
  if (row.subscriptionStatus === 'past_due' && row.paymentGraceReason === 'trial') return 'trialGrace';
  if (row.subscriptionStatus === 'active' && !row.firstPaymentAt) return 'converting';
  return 'fullSubscriber';
}

const STATUSES = ['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'paused', null];
const TIERS = ['pro', 'basic', 'public', 'starter', 'elite', 'admin', null];
const REASONS = ['trial', 'renewal', null];
const PAID = ['2026-08-01T00:00:00Z', null];

test('classifier agrees with the chart SQL across every state combination', () => {
  for (const subscriptionStatus of STATUSES) {
    for (const tier of TIERS) {
      for (const paymentGraceReason of REASONS) {
        for (const firstPaymentAt of PAID) {
          const row = { subscriptionStatus, tier, paymentGraceReason, firstPaymentAt };
          assert.equal(
            classifySubscriberBucket(row).bucket,
            sqlOracle(row),
            `status=${subscriptionStatus} tier=${tier} reason=${paymentGraceReason} paid=${firstPaymentAt}`,
          );
        }
      }
    }
  }
});

// ── The access gate ────────────────────────────────────────────────────────
// Every line requires a paid tier, because two states keep a live
// subscription_status while access is withheld. Both used to be counted as
// subscribers by the headcount while the flow chart had already booked them out.

test('a PAUSED subscription is not a Full Subscriber', () => {
  // Stripe leaves a paused sub `active`; the webhook grants no tier. They pay
  // nothing and get nothing, so they are not on the chart at all.
  const v = classifySubscriberBucket({
    subscriptionStatus: 'active',
    tier: 'public',
    paymentGraceReason: null,
    firstPaymentAt: '2026-01-01T00:00:00Z',
  });
  assert.equal(v.bucket, 'notCounted');
  assert.match(v.why, /paused/);
});

test('a trial held at the payment-setup gate is not a Free Trial', () => {
  // `trialing` with tier public: the SetupIntent never succeeded, so access was
  // deliberately withheld. Counting them inflated the trial band with people who
  // never got in.
  const v = classifySubscriberBucket({
    subscriptionStatus: 'trialing',
    tier: 'public',
    paymentGraceReason: null,
  });
  assert.equal(v.bucket, 'notCounted');
  assert.match(v.why, /payment setup/);
});

// ── The Converting band ────────────────────────────────────────────────────
// The whole point of the split: `active` means Stripe raised the invoice, not
// that anyone paid.

test('active with no payment on file is Converting, not a Full Subscriber', () => {
  const v = classifySubscriberBucket({
    subscriptionStatus: 'active',
    tier: 'pro',
    paymentGraceReason: null,
    firstPaymentAt: null,
  });
  assert.equal(v.bucket, 'converting');
  assert.equal(v.label, 'Converting');
  assert.match(v.why, /no payment has ever cleared/);
});

test('the same member becomes a Full Subscriber once a payment clears', () => {
  const v = classifySubscriberBucket({
    subscriptionStatus: 'active',
    tier: 'pro',
    paymentGraceReason: null,
    firstPaymentAt: '2026-08-28T00:45:00Z',
  });
  assert.equal(v.bucket, 'fullSubscriber');
});

test('a renewal-grace member counts as paying even with no stamp', () => {
  // Rows predating the column have no first_payment_at, and reaching a renewal
  // is itself proof they paid — so history is never re-attributed downward.
  const v = classifySubscriberBucket({
    subscriptionStatus: 'past_due',
    tier: 'pro',
    paymentGraceReason: 'renewal',
    firstPaymentAt: null,
  });
  assert.equal(v.bucket, 'fullSubscriber');
});

test('a trial-conversion failure inside the window reads Trial Grace', () => {
  const v = classifySubscriberBucket({
    subscriptionStatus: 'past_due',
    tier: 'pro',
    paymentGraceReason: 'trial',
  });
  assert.equal(v.bucket, 'trialGrace');
  assert.equal(v.label, 'Trial Grace');
});

test('the same failure MISLABELED renewal hides in Full Subscriber', () => {
  // This is the bug the trial_end fix corrects, stated as a fact about the
  // chart: a member who has never paid a cent reads as a full subscriber.
  const v = classifySubscriberBucket({
    subscriptionStatus: 'past_due',
    tier: 'pro',
    paymentGraceReason: 'renewal',
  });
  assert.equal(v.bucket, 'fullSubscriber');
});

test('once the tier drops to public the member leaves the chart entirely', () => {
  // Not Trial Grace, not Full Subscriber — nowhere. This is what a Full
  // Subscriber count falling by one actually looks like.
  for (const paymentGraceReason of ['trial', 'renewal', null]) {
    const v = classifySubscriberBucket({
      subscriptionStatus: 'past_due',
      tier: 'public',
      paymentGraceReason,
    });
    assert.equal(v.bucket, 'notCounted', `reason=${paymentGraceReason}`);
    assert.match(v.why, /dropped to public/);
  }
});

test('a trialer who has clicked Cancel still counts as Free Trial', () => {
  const v = classifySubscriberBucket({
    subscriptionStatus: 'trialing',
    tier: 'pro',
    paymentGraceReason: null,
    cancelAtPeriodEnd: true,
  });
  assert.equal(v.bucket, 'freeTrial');
  assert.match(v.why, /cancel already scheduled/);
});

test('an unattributed legacy grace window still reads Full Subscriber', () => {
  const v = classifySubscriberBucket({
    subscriptionStatus: 'past_due',
    tier: 'basic',
    paymentGraceReason: null,
  });
  assert.equal(v.bucket, 'fullSubscriber');
  assert.match(v.why, /unattributed/);
});

test('legacy tier ids fold like currentTierCounts', () => {
  assert.equal(normalizeBucketTier('starter'), 'basic');
  assert.equal(normalizeBucketTier('elite'), 'pro');
  assert.equal(normalizeBucketTier('pro'), 'pro');
  assert.equal(normalizeBucketTier(null), null);
  // ...and a legacy tier keeps its grace row on the chart.
  assert.equal(
    classifySubscriberBucket({
      subscriptionStatus: 'past_due',
      tier: 'elite',
      paymentGraceReason: 'trial',
    }).bucket,
    'trialGrace',
  );
});

// ── The ledger ─────────────────────────────────────────────────────────────
// Its contract: the per-row deltas must ACCOUNT for the headcount. If Full
// Subscribers moved by -1 over a window, exactly one row in that window must
// carry fullSubscriberDelta -1, naming the member and saying why. That is the
// whole point — no unexplained movement.

function sync(over: Partial<LedgerSyncEvent> & { at: string }): LedgerSyncEvent {
  return {
    subId: 'sub_1',
    userId: 'u1',
    email: 'a@example.com',
    status: 'active',
    tier: 'pro',
    cancelAtPeriodEnd: false,
    ...over,
  };
}

function payment(over: Partial<LedgerPaymentEvent> & { at: string }): LedgerPaymentEvent {
  return { subId: 'sub_1', userId: 'u1', email: 'a@example.com', ...over };
}

test('a trial that converts then fails never touches Full Subscribers', () => {
  // jordanjosh7718's real production sequence, verbatim. This USED to book +1
  // Full Subscriber at 23:45 and -1 an hour later — the 106 -> 105 blip. The
  // member never paid a cent, so the paying line must not move at all; the whole
  // episode lives and dies on the Converting band.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-20T23:44:44Z', status: 'trialing' }),
      sync({ at: '2026-08-27T23:45:20Z', status: 'active' }),
    ],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-08-28T00:45:51Z' }],
  );
  assert.deepEqual(rows.map((r) => r.kind), ['accessEnded', 'conversionPending', 'trialStarted']);
  assert.equal(rows[1].convertingDelta, 1);
  assert.equal(rows[0].convertingDelta, -1);
  assert.equal(
    rows.reduce((m, r) => m + r.fullSubscriberDelta, 0),
    0,
    'the paying line must never have moved',
  );
  assert.match(rows[0].detail, /first charge failed/);
  assert.deepEqual(summarizeLedger(rows), {
    fullSubscriber: 0,
    converting: 0,
    freeTrial: 0,
    trialGrace: 0,
  });
});

test('a trial that converts and PAYS moves the paying line, once', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-20T23:44:44Z', status: 'trialing' }),
      sync({ at: '2026-08-27T23:45:20Z', status: 'active' }),
    ],
    [],
    [payment({ at: '2026-08-28T00:45:51Z' })],
  );
  assert.deepEqual(rows.map((r) => r.kind), ['converted', 'conversionPending', 'trialStarted']);
  assert.equal(rows[0].fullSubscriberDelta, 1);
  assert.equal(rows[0].convertingDelta, -1);
  assert.match(rows[0].detail, /first payment cleared/);
  const net = summarizeLedger(rows);
  assert.equal(net.fullSubscriber, 1);
  assert.equal(net.converting, 0);
  assert.equal(net.freeTrial, 0);
});

test('a payment confirms the conversion for good — a later churn is not a revoke', () => {
  // Once money has moved, a deletion a full cycle later is ordinary churn: the
  // paying line goes up on the payment and back down on the departure.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-08-08T00:00:00Z', status: 'active' }),
    ],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-09-08T00:00:00Z' }],
    [payment({ at: '2026-08-08T01:00:00Z' })],
  );
  const net = summarizeLedger(rows);
  assert.equal(net.fullSubscriber, 0, '+1 on payment, -1 on the departure');
  assert.equal(rows.find((r) => r.kind === 'converted')!.fullSubscriberDelta, 1);
  assert.equal(rows[0].kind, 'accessEnded');
  assert.equal(rows[0].fullSubscriberDelta, -1);
});

test('history with no payment stream still settles, after the fallback window', () => {
  // Subscriptions that converted before stripe_first_payment existed have no
  // payment event. They must not sit on Converting forever — that would put the
  // ledger permanently at odds with the backfilled headcount.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-08-08T00:00:00Z', status: 'active' }),
    ],
    [],
    [],
    Date.parse('2026-08-20T00:00:00Z'),
  );
  const settled = rows.find((r) => r.kind === 'converted');
  assert.ok(settled, 'the conversion must settle once the window elapses');
  assert.equal(settled!.fullSubscriberDelta, 1);
  assert.equal(settled!.convertingDelta, -1);
  assert.equal(settled!.email, 'a@example.com', 'a synthesized row still names the member');
  assert.equal(summarizeLedger(rows).converting, 0);
});

test('the fallback never settles a conversion the clock has not reached', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-08-08T00:00:00Z', status: 'active' }),
    ],
    [],
    [],
    Date.parse('2026-08-08T06:00:00Z'),
  );
  assert.equal(rows.filter((r) => r.kind === 'converted').length, 0);
  assert.equal(summarizeLedger(rows).converting, 1);
});

test('a retention pause reads as a pause, not a lapse', () => {
  // Stripe keeps a paused subscription `active` while the webhook grants no
  // tier. Reporting that as "access ended" would file a bounded break as churn.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-06-01T00:00:00Z', status: 'active' }),
      sync({ at: '2026-08-01T00:00:00Z', status: 'active', tier: 'public' }),
      sync({ at: '2026-09-01T00:00:00Z', status: 'active', tier: 'pro' }),
    ],
    [],
    [payment({ at: '2026-06-01T01:00:00Z' })],
  );
  const kinds = rows.map((r) => r.kind);
  assert.ok(kinds.includes('paused'), 'the pause must be visible as a pause');
  assert.ok(kinds.includes('resumed'), 'and the return as a resume, not a new subscriber');
  const paused = rows.find((r) => r.kind === 'paused')!;
  assert.equal(paused.fullSubscriberDelta, -1, 'they really do leave the headcount');
  assert.match(paused.detail, /not churn/);
  const resumed = rows.find((r) => r.kind === 'resumed')!;
  assert.equal(resumed.fullSubscriberDelta, 1);
  assert.equal(
    paused.fullSubscriberDelta + resumed.fullSubscriberDelta,
    0,
    'the pause and resume cancel out — the break costs the headcount nothing net',
  );
});

test('a trial withheld at the setup gate never enters the ledger', () => {
  // tier=public on a `trialing` sub: they were never counted, so their first
  // sighting is not an event and their departure is not a loss.
  const rows = buildSubscriberLedger(
    [sync({ at: '2026-08-01T00:00:00Z', status: 'trialing', tier: 'public' })],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-08-08T00:00:00Z' }],
  );
  assert.deepEqual(rows, []);
});

test('a scheduled cancellation warns first, then accounts for the drop', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-07-01T00:00:00Z', status: 'active' }),
      sync({ at: '2026-08-01T00:00:00Z', status: 'active', cancelAtPeriodEnd: true }),
    ],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-09-01T00:00:00Z' }],
  );
  const kinds = rows.map((r) => r.kind);
  // The conversion is now two steps — charge raised, then confirmed — before the
  // cancellation warning and the departure it eventually causes.
  assert.deepEqual(kinds, ['accessEnded', 'cancelScheduled', 'converted', 'conversionPending']);
  // The warning itself moves nothing — they keep access until the period ends.
  const scheduled = rows.find((r) => r.kind === 'cancelScheduled')!;
  assert.equal(scheduled.fullSubscriberDelta, 0);
  // The departure a month later is the row that moves the count.
  assert.equal(rows[0].fullSubscriberDelta, -1);
  assert.match(rows[0].detail, /Scheduled cancellation took effect/);
});

test('a reversed cancellation is recorded and moves nothing', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-07-01T00:00:00Z' }),
      sync({ at: '2026-07-02T00:00:00Z', cancelAtPeriodEnd: true }),
      sync({ at: '2026-07-03T00:00:00Z', cancelAtPeriodEnd: false }),
    ],
    [],
  );
  const reverted = rows.find((r) => r.kind === 'cancelReverted');
  assert.ok(reverted, 'the save should be visible in the ledger');
  assert.equal(reverted!.fullSubscriberDelta, 0);
  assert.equal(summarizeLedger(rows).fullSubscriber, 1); // just the original conversion
});

test('a trial charge declined lands on the Trial Grace line, not Full Subscribers', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-08-08T00:00:00Z', status: 'past_due', tier: 'pro' }),
    ],
    [],
  );
  const declined = rows.find((r) => r.kind === 'trialChargeDeclined')!;
  assert.equal(declined.trialGraceDelta, 1);
  assert.equal(declined.freeTrialDelta, -1);
  assert.equal(declined.fullSubscriberDelta, 0);
});

test('an established payer failing a renewal is reported but moves nothing', () => {
  // Access is retained through the recovery window, so the count must not move —
  // but the operator still needs to see it coming.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-06-01T00:00:00Z', status: 'active' }),
      sync({ at: '2026-08-01T00:00:00Z', status: 'past_due', tier: 'pro' }),
    ],
    [],
  );
  const failed = rows.find((r) => r.kind === 'renewalFailed');
  assert.ok(failed, 'a renewal failure must be visible');
  assert.equal(failed!.fullSubscriberDelta, 0);
  assert.equal(failed!.trialGraceDelta, 0, 'an established payer is not trial grace');
});

test('repeated no-op syncs do not spam the ledger', () => {
  // Stripe re-syncs a healthy subscription constantly. Only the two real steps
  // should appear — the charge being raised, and its confirmation — no matter
  // how many identical syncs arrive in between.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-01T00:00:00Z', status: 'active' }),
      sync({ at: '2026-08-02T00:00:00Z', status: 'active' }),
      sync({ at: '2026-08-03T00:00:00Z', status: 'active' }),
      sync({ at: '2026-08-04T00:00:00Z', status: 'active' }),
      sync({ at: '2026-08-05T00:00:00Z', status: 'active' }),
    ],
    [],
    [payment({ at: '2026-08-01T01:00:00Z' })],
  );
  assert.deepEqual(rows.map((r) => r.kind), ['converted', 'conversionPending']);
});

test('rows come back newest-first', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-08-08T00:00:00Z', status: 'active' }),
    ],
    [],
  );
  assert.ok(Date.parse(rows[0].at) > Date.parse(rows[1].at));
});

test('a deletion for a member already off the chart books nothing', () => {
  // Otherwise a lapsed member would be double-counted out of the headcount.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-08-08T00:00:00Z', status: 'canceled', tier: 'public' }),
    ],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-08-09T00:00:00Z' }],
  );
  assert.equal(rows.filter((r) => r.kind === 'accessEnded').length, 1);
  assert.equal(summarizeLedger(rows).freeTrial, 0);
});

test('malformed timestamps are skipped rather than throwing', () => {
  const rows = buildSubscriberLedger(
    [sync({ at: 'not-a-date', status: 'trialing' }), sync({ at: '2026-08-01T00:00:00Z', status: 'trialing' })],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: 'nope' }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'trialStarted');
});
