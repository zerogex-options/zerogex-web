import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSubscriberLedger,
  classifySubscriberBucket,
  ledgerKindLabel,
  normalizeBucketTier,
  subscriptionPaidAt,
  summarizeLedger,
  type LedgerDeclineEvent,
  type LedgerPaymentEvent,
  type LedgerRecoveryEvent,
  type LedgerRow,
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
//             AND (last_paid_subscription_id IS NULL
//                  OR stripe_subscription_id IS NULL
//                  OR last_paid_subscription_id <> stripe_subscription_id
//                  OR last_paid_invoice_at IS NULL)             THEN 'converting'
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
  if (
    row.subscriptionStatus === 'active' &&
    (row.lastPaidSubscriptionId == null ||
      row.stripeSubscriptionId == null ||
      row.lastPaidSubscriptionId !== row.stripeSubscriptionId ||
      row.lastPaidInvoiceAt == null)
  ) {
    return 'converting';
  }
  return 'fullSubscriber';
}

// The three states of the per-subscription payment pointer, named rather than
// spelled as three opaque nulls at each call site. PAID_ON_A_PREVIOUS_SUB is the
// one that used to be indistinguishable from PAID_ON_THIS_SUB, because the old
// account-scoped column could not tell them apart.
const PAID_ON_THIS_SUB = {
  stripeSubscriptionId: 'sub_current',
  lastPaidSubscriptionId: 'sub_current',
  lastPaidInvoiceAt: '2026-08-28T00:45:00Z',
};
const NEVER_PAID = {
  stripeSubscriptionId: 'sub_current',
  lastPaidSubscriptionId: null,
  lastPaidInvoiceAt: null,
};
const PAID_ON_A_PREVIOUS_SUB = {
  stripeSubscriptionId: 'sub_current',
  lastPaidSubscriptionId: 'sub_previous',
  lastPaidInvoiceAt: '2026-08-03T03:42:56.466Z',
};

const STATUSES = ['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'paused', null];
const TIERS = ['pro', 'basic', 'public', 'starter', 'elite', 'admin', null];
const REASONS = ['trial', 'renewal', null];
const CURRENT_SUBS = ['sub_current', null];
const PAID_SUBS = ['sub_current', 'sub_previous', null];
const PAID_ATS = ['2026-08-01T00:00:00Z', null];

test('classifier agrees with the chart SQL across every state combination', () => {
  for (const subscriptionStatus of STATUSES) {
    for (const tier of TIERS) {
      for (const paymentGraceReason of REASONS) {
        for (const stripeSubscriptionId of CURRENT_SUBS) {
          for (const lastPaidSubscriptionId of PAID_SUBS) {
            for (const lastPaidInvoiceAt of PAID_ATS) {
              const row = {
                subscriptionStatus,
                tier,
                paymentGraceReason,
                stripeSubscriptionId,
                lastPaidSubscriptionId,
                lastPaidInvoiceAt,
              };
              assert.equal(
                classifySubscriberBucket(row).bucket,
                sqlOracle(row),
                `status=${subscriptionStatus} tier=${tier} reason=${paymentGraceReason} `
                  + `sub=${stripeSubscriptionId} paidSub=${lastPaidSubscriptionId} paidAt=${lastPaidInvoiceAt}`,
              );
            }
          }
        }
      }
    }
  }
});

// ── The pointer rule ───────────────────────────────────────────────────────

test('subscriptionPaidAt only answers for the CURRENT subscription', () => {
  assert.equal(subscriptionPaidAt(PAID_ON_THIS_SUB), '2026-08-28T00:45:00Z');
  assert.equal(subscriptionPaidAt(NEVER_PAID), null);
  assert.equal(subscriptionPaidAt(PAID_ON_A_PREVIOUS_SUB), null);
  // A half-written row (pointer set, date missing) must read as unpaid — the
  // only direction that cannot promote someone who has not been charged.
  assert.equal(
    subscriptionPaidAt({
      stripeSubscriptionId: 'sub_current',
      lastPaidSubscriptionId: 'sub_current',
      lastPaidInvoiceAt: null,
    }),
    null,
  );
  // No subscription on the row at all.
  assert.equal(
    subscriptionPaidAt({
      stripeSubscriptionId: null,
      lastPaidSubscriptionId: 'sub_previous',
      lastPaidInvoiceAt: '2026-08-03T00:00:00Z',
    }),
    null,
  );
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
    ...PAID_ON_THIS_SUB,
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
    ...NEVER_PAID,
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
    ...NEVER_PAID,
  });
  assert.equal(v.bucket, 'converting');
  assert.equal(v.label, 'Converting');
  assert.match(v.why, /no invoice has ever cleared/);
});

test('the same member becomes a Full Subscriber once a payment clears', () => {
  const v = classifySubscriberBucket({
    subscriptionStatus: 'active',
    tier: 'pro',
    paymentGraceReason: null,
    ...PAID_ON_THIS_SUB,
  });
  assert.equal(v.bucket, 'fullSubscriber');
});

test('a RETURNING member is Converting until THIS subscription is charged', () => {
  // lukaszrymarczyk79's production state at 11:44 on 2026-09-15: reactivated
  // onto a new subscription, an earlier one paid back in August, the post-trial
  // invoice raised but not yet charged. The account-scoped column said "has
  // paid" and put him on the Full Subscriber line an hour before his card was
  // touched — if it had then declined, the line would have ticked up and back
  // down, the exact sawtooth the Converting band exists to prevent.
  const v = classifySubscriberBucket({
    subscriptionStatus: 'active',
    tier: 'pro',
    paymentGraceReason: null,
    ...PAID_ON_A_PREVIOUS_SUB,
  });
  assert.equal(v.bucket, 'converting');
  // The verdict has to name the stale pointer: "never paid" would send whoever
  // is debugging this off after a brand-new member.
  assert.match(v.why, /sub_previous/);
  assert.match(v.why, /PREVIOUS|not the current/i);
});

test('and becomes a Full Subscriber when that subscription is charged', () => {
  // 12:44 the same day: the $19 cleared, so the pointer now names this sub.
  const v = classifySubscriberBucket({
    subscriptionStatus: 'active',
    tier: 'pro',
    paymentGraceReason: null,
    stripeSubscriptionId: 'sub_current',
    lastPaidSubscriptionId: 'sub_current',
    lastPaidInvoiceAt: '2026-09-15T12:44:36.348Z',
  });
  assert.equal(v.bucket, 'fullSubscriber');
  assert.match(v.why, /2026-09-15T12:44:36/);
});

test('a renewal-grace member counts as paying even with no stamp', () => {
  // Rows predating the columns have no pointer, and reaching a renewal is
  // itself proof they paid — so history is never re-attributed downward.
  const v = classifySubscriberBucket({
    subscriptionStatus: 'past_due',
    tier: 'pro',
    paymentGraceReason: 'renewal',
    ...NEVER_PAID,
  });
  assert.equal(v.bucket, 'fullSubscriber');
});

test('a trial-conversion failure inside the window reads Trial Grace', () => {
  const v = classifySubscriberBucket({
    subscriptionStatus: 'past_due',
    tier: 'pro',
    paymentGraceReason: 'trial',
    ...NEVER_PAID,
  });
  assert.equal(v.bucket, 'trialGrace');
  assert.equal(v.label, 'Trial Grace');
});

test('a returning member whose conversion charge fails still reads Trial Grace', () => {
  // Grace attribution comes from trial_end (decidePaymentGrace), not from any
  // payment column, so it was already correct for returning members. Pinned so
  // the per-subscription change cannot quietly move them to the paying line.
  const v = classifySubscriberBucket({
    subscriptionStatus: 'past_due',
    tier: 'pro',
    paymentGraceReason: 'trial',
    ...PAID_ON_A_PREVIOUS_SUB,
  });
  assert.equal(v.bucket, 'trialGrace');
});

test('the same failure MISLABELED renewal hides in Full Subscriber', () => {
  // This is the bug the trial_end fix corrects, stated as a fact about the
  // chart: a member who has never paid a cent reads as a full subscriber.
  const v = classifySubscriberBucket({
    subscriptionStatus: 'past_due',
    tier: 'pro',
    paymentGraceReason: 'renewal',
    ...NEVER_PAID,
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
      ...NEVER_PAID,
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
    ...NEVER_PAID,
  });
  assert.equal(v.bucket, 'freeTrial');
  assert.match(v.why, /cancel already scheduled/);
});

test('an unattributed legacy grace window still reads Full Subscriber', () => {
  const v = classifySubscriberBucket({
    subscriptionStatus: 'past_due',
    tier: 'basic',
    paymentGraceReason: null,
    ...NEVER_PAID,
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
      ...NEVER_PAID,
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

function recovery(over: Partial<LedgerRecoveryEvent> & { at: string }): LedgerRecoveryEvent {
  return {
    subId: 'sub_1',
    userId: 'u1',
    email: 'a@example.com',
    invoiceId: 'in_old',
    kind: 'recovered',
    ...over,
  };
}

// ── Orphan recovery ────────────────────────────────────────────────────────
// A recovery subscription is created with NO invoice of its own — billing is
// anchored at the end of the period the recovered invoice already paid for — so
// nothing can clear on it until its first renewal. On the sync stream alone it
// is indistinguishable from a conversion charge in flight.

test('a recovery subscription is paid for from its first sync', () => {
  const rows = buildSubscriberLedger(
    [sync({ at: '2026-09-17T16:58:06.558Z', status: 'active' })],
    [],
    [],
    [recovery({ at: '2026-09-17T16:58:06.226Z' })],
    Date.parse('2026-09-18T12:00:00Z'),
  );
  assert.deepEqual(rows.map((r) => r.kind), ['orphanRecovered']);
  assert.equal(rows[0].fullSubscriberDelta, 1);
  // Never the Converting band: no charge is in flight, the period is bought.
  assert.equal(rows[0].convertingDelta, 0);
  assert.match(rows[0].detail, /in_old/);
  assert.match(rows[0].detail, /not a new charge/);
});

test('a recovery never reaches the fallback confirmation window', () => {
  // Left to the sync stream this booked conversionPending, then two days later a
  // synthetic "the conversion charge was never reported as failed" promotion —
  // a wrong explanation for a payment that had already cleared weeks earlier.
  const rows = buildSubscriberLedger(
    [sync({ at: '2026-09-17T16:58:06.558Z', status: 'active' })],
    [],
    [],
    [recovery({ at: '2026-09-17T16:58:06.226Z' })],
    Date.parse('2026-09-30T12:00:00Z'), // well past CONVERSION_CONFIRM_DAYS
  );
  assert.deepEqual(rows.map((r) => r.kind), ['orphanRecovered']);
  assert.equal(summarizeLedger(rows).converting, 0);
  assert.equal(summarizeLedger(rows).fullSubscriber, 1);
});

test('the recovery verdict does not depend on which row landed first', () => {
  // The audit row and the subscription sync are written within the same second,
  // in whichever order the webhook delivers, so the result must not turn on it.
  for (const recoveryAt of ['2026-09-17T16:58:05.000Z', '2026-09-17T16:58:09.000Z']) {
    const rows = buildSubscriberLedger(
      [sync({ at: '2026-09-17T16:58:06.558Z', status: 'active' })],
      [],
      [],
      [recovery({ at: recoveryAt })],
      Date.parse('2026-09-30T12:00:00Z'),
    );
    assert.deepEqual(rows.map((r) => r.kind), ['orphanRecovered'], `recovery at ${recoveryAt}`);
  }
});

test('a COMPED period says so rather than reading as a new sale', () => {
  // The refunded case: the period is reinstated as goodwill, so no money is held
  // against it at all. It still belongs on the paying line — nothing is in
  // flight — but calling it a "new paying subscriber" would be the same class of
  // lie the Converting band exists to prevent.
  const rows = buildSubscriberLedger(
    [sync({ at: '2026-09-18T04:00:00Z', status: 'active' })],
    [],
    [],
    [recovery({ at: '2026-09-18T03:59:00Z', kind: 'comped', invoiceId: 'in_refunded' })],
    Date.parse('2026-09-30T12:00:00Z'),
  );
  assert.deepEqual(rows.map((r) => r.kind), ['orphanRecovered']);
  assert.equal(rows[0].fullSubscriberDelta, 1);
  assert.equal(rows[0].convertingDelta, 0);
  assert.match(rows[0].detail, /reinstated as a comp/);
  assert.match(rows[0].detail, /refunded/);
  assert.match(rows[0].detail, /in_refunded/);
});

test('a recovery with no invoice id still reads as a restored period', () => {
  const rows = buildSubscriberLedger(
    [sync({ at: '2026-09-17T16:58:06.558Z', status: 'active' })],
    [],
    [],
    [recovery({ at: '2026-09-17T16:58:06.226Z', invoiceId: null })],
    Date.parse('2026-09-18T12:00:00Z'),
  );
  assert.deepEqual(rows.map((r) => r.kind), ['orphanRecovered']);
  assert.match(rows[0].detail, /already paid for/);
});

test('cancelling a recovered subscription is a PAID cancellation', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-09-17T16:58:06.558Z', status: 'active' }),
      sync({ at: '2026-09-20T10:00:00Z', status: 'active', cancelAtPeriodEnd: true }),
    ],
    [],
    [],
    [recovery({ at: '2026-09-17T16:58:06.226Z' })],
    Date.parse('2026-09-21T12:00:00Z'),
  );
  // Not cancelScheduledTrial: they hold a period they actually paid for.
  assert.ok(rows.some((r) => r.kind === 'cancelScheduledPaid'));
});

test('a renewal on a recovered subscription moves nothing', () => {
  // The first real money on that subscription arrives at its renewal. The
  // member is already counted, so it must not book a second conversion.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-09-17T16:58:06.558Z', status: 'active' }),
      sync({ at: '2026-10-03T12:20:23Z', status: 'active' }),
    ],
    [],
    [payment({ at: '2026-10-03T12:21:00Z' })],
    [recovery({ at: '2026-09-17T16:58:06.226Z' })],
    Date.parse('2026-10-04T12:00:00Z'),
  );
  assert.deepEqual(rows.map((r) => r.kind), ['orphanRecovered']);
  assert.equal(summarizeLedger(rows).fullSubscriber, 1);
});

test('an UNrecovered subscription is unaffected by the recovery stream', () => {
  // A recovery naming a different subscription must not leak across.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-27T12:20:23Z', status: 'trialing' }),
      sync({ at: '2026-09-03T12:20:53Z', status: 'active' }),
    ],
    [],
    [],
    [recovery({ subId: 'sub_someone_else', at: '2026-09-03T12:20:00Z' })],
    Date.parse('2026-09-03T13:00:00Z'),
  );
  assert.deepEqual(rows.map((r) => r.kind), ['conversionPending', 'trialStarted']);
});

test("prestonking0214's full production timeline reads correctly end to end", () => {
  // Trial -> converted -> refunded -> canceled immediately -> and a fortnight
  // later an orphan recovery re-homed that (refunded) invoice onto a new
  // subscription. The recovery itself should never have happened, but the
  // ledger's job is to SAY what happened rather than leave the account sitting
  // on Converting with no row explaining it.
  const OLD = 'sub_1U92I74AOiqteMYYOjBQATQc';
  const NEW = 'sub_1UGidN4AOiqteMYYVFYeHOJ6';
  const rows = buildSubscriberLedger(
    [
      sync({ subId: OLD, at: '2026-08-27T12:20:27.790Z', status: 'trialing' }),
      sync({ subId: OLD, at: '2026-09-03T12:20:53.608Z', status: 'active' }),
      sync({ subId: OLD, at: '2026-09-03T14:09:05.102Z', status: 'active', cancelAtPeriodEnd: true }),
      sync({ subId: NEW, at: '2026-09-17T16:58:06.558Z', status: 'active' }),
    ],
    [{ subId: OLD, userId: 'u1', email: 'a@example.com', at: '2026-09-03T15:31:34.376Z' }],
    [payment({ subId: OLD, at: '2026-09-03T13:22:05.045Z' })],
    [recovery({ subId: NEW, at: '2026-09-17T16:58:06.226Z', invoiceId: 'in_1UBZdN4AOiqteMYYUOVhxBth' })],
    Date.parse('2026-09-30T12:00:00Z'),
  );
  assert.deepEqual(rows.map((r) => r.kind), [
    'orphanRecovered',
    'accessEnded',
    'cancelScheduledPaid',
    'converted',
    'conversionPending',
    'trialStarted',
  ]);
  // The two real conversions net out across the window, and the Converting band
  // opens and closes rather than being left holding this member.
  const net = summarizeLedger(rows);
  assert.equal(net.converting, 0);
  assert.equal(net.freeTrial, 0);
  // Paid once (the real conversion), lost once (the cancel), restored once.
  assert.equal(net.fullSubscriber, 1);
});

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
  assert.deepEqual(kinds, ['accessEnded', 'cancelScheduledPaid', 'converted', 'conversionPending']);
  // The warning itself moves nothing — they keep access until the period ends.
  const scheduled = rows.find((r) => r.kind === 'cancelScheduledPaid')!;
  assert.equal(scheduled.fullSubscriberDelta, 0);
  // The departure a month later is the row that moves the count.
  assert.equal(rows[0].fullSubscriberDelta, -1);
  assert.match(rows[0].detail, /Scheduled cancellation took effect/);
});

// A cancel clicked mid-trial and a cancel clicked on a paid subscription are
// the same Stripe flag and cost completely different things: one forfeits a
// conversion that was never charged, the other is revenue already in hand
// walking out. The ledger has to name which one it is.

test('a cancel clicked during the free trial is labeled as a trial cancellation', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-07-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-07-03T00:00:00Z', status: 'trialing', cancelAtPeriodEnd: true }),
    ],
    [],
  );
  const scheduled = rows.find((r) => r.kind.startsWith('cancelScheduled'))!;
  assert.equal(scheduled.kind, 'cancelScheduledTrial');
  assert.equal(ledgerKindLabel(scheduled.kind), 'Cancellation scheduled: trial');
  assert.match(scheduled.detail, /without ever being charged/);
  // Still no count movement — they keep access to the end of the trial.
  assert.equal(scheduled.freeTrialDelta, 0);
});

test('a cancel clicked while the conversion charge is in flight is still a trial cancellation', () => {
  // The trial ended and Stripe raised the invoice, but no payment has cleared —
  // there is no paid subscription to cancel yet.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-07-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-07-08T00:00:00Z', status: 'active' }),
      sync({ at: '2026-07-08T00:30:00Z', status: 'active', cancelAtPeriodEnd: true }),
    ],
    [],
    [],
    [],
    Date.parse('2026-07-08T01:00:00Z'),
  );
  assert.equal(rows.find((r) => r.kind.startsWith('cancelScheduled'))!.kind, 'cancelScheduledTrial');
});

test('a cancel after the first payment cleared is a paid-subscription cancellation', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-07-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-07-08T00:00:00Z', status: 'active' }),
      sync({ at: '2026-07-20T00:00:00Z', status: 'active', cancelAtPeriodEnd: true }),
    ],
    [],
    [payment({ at: '2026-07-08T01:00:00Z' })],
  );
  const scheduled = rows.find((r) => r.kind.startsWith('cancelScheduled'))!;
  assert.equal(scheduled.kind, 'cancelScheduledPaid');
  assert.equal(ledgerKindLabel(scheduled.kind), 'Cancellation scheduled: paid subscription');
  assert.match(scheduled.detail, /paid period ends/);
});

test('an established payer whose trial predates the scan is not mislabeled as a trial', () => {
  // The scan opens on a routine renewal sync, which looks exactly like a trial's
  // first `active`. Never having seen a `trialing` sync is what tells them apart.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-07-01T00:00:00Z', status: 'active' }),
      sync({ at: '2026-07-01T06:00:00Z', status: 'active', cancelAtPeriodEnd: true }),
    ],
    [],
    [],
    [],
    Date.parse('2026-07-01T12:00:00Z'),
  );
  assert.equal(rows.find((r) => r.kind.startsWith('cancelScheduled'))!.kind, 'cancelScheduledPaid');
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

// ── Payment failures ───────────────────────────────────────────────────────
// The Forward-Looking Growth Rate counts the rows flagged `paymentFailure` as
// its failures, so this flag IS that number. Its contract: exactly one flagged
// row each time a declined charge hits a subscription on the chart, however that
// failure then plays out, and none for a decline that moved no subscriber.

function decline(over: Partial<LedgerDeclineEvent> & { at: string }): LedgerDeclineEvent {
  return { subId: 'sub_1', ...over };
}

const failures = (rows: LedgerRow[]) => rows.filter((r) => r.paymentFailure);

test('a declined trial charge is ONE payment failure, however it ends', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-09-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-09-08T00:00:00Z', status: 'active' }),
      sync({ at: '2026-09-08T01:00:00Z', status: 'past_due' }),
      // The grace window runs out and access drops...
      sync({ at: '2026-09-11T01:00:00Z', status: 'past_due', tier: 'public' }),
    ],
    // ...then Stripe gives up and cancels.
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-09-20T01:00:00Z' }],
    [],
    [],
    Date.parse('2026-09-21T00:00:00Z'),
    { declines: [decline({ at: '2026-09-08T01:00:00Z' }), decline({ at: '2026-09-11T01:00:00Z' })] },
  );
  assert.deepEqual(failures(rows).map((r) => r.kind), ['trialChargeDeclined']);
  const ended = rows.find((r) => r.kind === 'accessEnded')!;
  assert.equal(ended.paymentFailure, false, 'the grace window running out is the same failure');
  assert.match(ended.detail, /not paid in time/);
});

test('a trial charge refused and canceled in the same instant is a payment failure', () => {
  // The production timeline in docs/outreach/2026-09-23-trial-conversion-
  // declined-mckaiden.md. Cash App Pay is not a card, so Stripe did not retry:
  // the subscription went active -> deleted 14 ms after the decline and never
  // passed through past_due. The growth-rate card counted it as a failure while
  // the ledger showed only an "Access ended" row.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-09-16T15:39:49Z', status: 'trialing' }),
      sync({ at: '2026-09-23T15:40:13.618Z', status: 'active' }),
    ],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-09-23T16:40:34.450Z' }],
    [],
    [],
    Date.parse('2026-09-23T18:00:00Z'),
    { declines: [decline({ at: '2026-09-23T16:40:34.436Z' })] },
  );
  assert.deepEqual(rows.map((r) => r.kind), ['accessEnded', 'conversionPending', 'trialStarted']);
  assert.equal(rows[0].paymentFailure, true);
  assert.equal(rows[0].convertingDelta, -1);
  assert.equal(rows[0].fullSubscriberDelta, 0, 'they never paid, so the paying line never moved');
  assert.match(rows[0].detail, /first charge failed/);
  assert.equal(failures(rows).length, 1);
});

test('the same ending counts when no decline was captured for it', () => {
  // The webhook can log Stripe's cancel before the decline that caused it, or
  // miss the decline entirely. Ending a conversion whose charge was pending
  // still says the charge failed.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-20T23:44:44Z', status: 'trialing' }),
      sync({ at: '2026-08-27T23:45:20Z', status: 'active' }),
    ],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-08-28T00:45:51Z' }],
  );
  assert.equal(rows[0].kind, 'accessEnded');
  assert.equal(rows[0].paymentFailure, true);
});

test('a renewal in dunning is one failure; failing again after recovering is another', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-06-01T00:00:00Z', status: 'active' }),
      sync({ at: '2026-07-01T00:00:00Z', status: 'past_due' }),
      sync({ at: '2026-07-02T00:00:00Z', status: 'past_due' }), // a retry fails too
      sync({ at: '2026-07-03T00:00:00Z', status: 'active' }), // recovered
      sync({ at: '2026-08-01T00:00:00Z', status: 'past_due' }), // next month
    ],
    [],
    [payment({ at: '2026-06-01T00:10:00Z' }), payment({ at: '2026-07-03T00:00:00Z' })],
    [],
    Date.parse('2026-08-02T00:00:00Z'),
    {
      declines: [
        decline({ at: '2026-07-01T00:00:00Z' }),
        decline({ at: '2026-07-02T00:00:00Z' }),
        decline({ at: '2026-08-01T00:00:00Z' }),
      ],
    },
  );
  assert.deepEqual(
    failures(rows).map((r) => [r.kind, r.at]),
    [
      ['renewalFailed', '2026-08-01T00:00:00Z'],
      ['renewalFailed', '2026-07-01T00:00:00Z'],
    ],
  );
  assert.equal(rows.find((r) => r.kind === 'recovered')!.paymentFailure, false);
});

test('a renewal Stripe cancels on the first decline is a payment failure', () => {
  // A paying member on a method Stripe does not retry: the same instant cancel
  // as the trial above, on an established subscription.
  const rows = buildSubscriberLedger(
    [sync({ at: '2026-08-01T00:00:00Z', status: 'active' })],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-09-01T00:00:00.050Z' }],
    [payment({ at: '2026-08-01T00:05:00Z' })],
    [],
    Date.parse('2026-09-02T00:00:00Z'),
    { declines: [decline({ at: '2026-09-01T00:00:00Z' })] },
  );
  assert.equal(rows[0].kind, 'accessEnded');
  assert.equal(rows[0].paymentFailure, true);
  assert.equal(rows[0].fullSubscriberDelta, -1);
  assert.match(rows[0].detail, /charge was declined/);
});

test('a paid subscription that drops straight to public on a decline is a payment failure', () => {
  // No grace window held the tier, so the decline is also the departure.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-01T00:00:00Z', status: 'active' }),
      sync({ at: '2026-09-01T00:00:00Z', status: 'past_due', tier: 'public' }),
    ],
    [],
    [payment({ at: '2026-08-01T00:05:00Z' })],
    [],
    Date.parse('2026-09-02T00:00:00Z'),
  );
  assert.equal(rows[0].kind, 'accessEnded');
  assert.equal(rows[0].paymentFailure, true);
  assert.equal(failures(rows).length, 1);
});

test('a scheduled cancellation taking effect is never a payment failure', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-01T00:00:00Z', status: 'active' }),
      sync({ at: '2026-08-10T00:00:00Z', status: 'active', cancelAtPeriodEnd: true }),
    ],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-09-01T00:00:00Z' }],
    [payment({ at: '2026-08-01T00:05:00Z' })],
    [],
    Date.parse('2026-09-02T00:00:00Z'),
    // Even with a declined charge on record (a refused plan change, say).
    { declines: [decline({ at: '2026-08-15T00:00:00Z' })] },
  );
  assert.equal(failures(rows).length, 0);
  assert.match(rows[0].detail, /Scheduled cancellation took effect/);
});

test('declines that moved no subscriber are not payment failures', () => {
  // A trial member's refused switches to paid: the trial carries on, then
  // converts and pays like any other.
  const refusedSwitch = buildSubscriberLedger(
    [
      sync({ at: '2026-09-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-09-08T00:00:00Z', status: 'active' }),
    ],
    [],
    [payment({ at: '2026-09-08T01:00:00Z' })],
    [],
    Date.parse('2026-09-09T00:00:00Z'),
    {
      declines: [
        decline({ at: '2026-09-03T10:00:00Z' }),
        decline({ at: '2026-09-03T10:01:00Z' }),
        decline({ at: '2026-09-03T10:02:00Z' }),
      ],
    },
  );
  assert.equal(failures(refusedSwitch).length, 0);

  // A card refused at checkout on a subscription that never made the chart.
  const refusedCheckout = buildSubscriberLedger(
    [
      sync({ at: '2026-09-22T12:00:00Z', status: 'incomplete', tier: 'public' }),
      sync({ at: '2026-09-23T12:00:00Z', status: 'incomplete_expired', tier: 'public' }),
    ],
    [],
    [],
    [],
    Date.parse('2026-09-24T00:00:00Z'),
    { declines: [decline({ at: '2026-09-22T12:00:00Z' })] },
  );
  assert.equal(refusedCheckout.length, 0);

  // Another try at a bill that already failed, days later — from the pay link
  // in the dunning email, say. Stripe does not advance the attempt count for a
  // member's own retry, so this used to count as a second "attempt 1" failure.
  const retriedBill = buildSubscriberLedger(
    [
      sync({ at: '2026-09-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-09-08T00:00:00Z', status: 'active' }),
      sync({ at: '2026-09-08T01:00:00Z', status: 'past_due' }),
    ],
    [],
    [],
    [],
    Date.parse('2026-09-11T00:00:00Z'),
    { declines: [decline({ at: '2026-09-08T01:00:00Z' }), decline({ at: '2026-09-10T15:00:00Z' })] },
  );
  assert.deepEqual(failures(retriedBill).map((r) => r.kind), ['trialChargeDeclined']);
});

test('a Trial Grace member re-synced after the trial clock runs out is still Trial Grace', () => {
  // Updating the card on day three re-syncs a subscription that is still
  // past_due on its first charge. Reading that as a renewal booked a bogus
  // recovery and then a second failure for the same unpaid charge.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-09-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-09-08T00:00:00Z', status: 'active' }),
      sync({ at: '2026-09-08T01:00:00Z', status: 'past_due' }),
      sync({ at: '2026-09-10T12:00:00Z', status: 'past_due' }),
    ],
    [],
    [],
    [],
    Date.parse('2026-09-11T00:00:00Z'),
  );
  assert.deepEqual(rows.map((r) => r.kind), ['trialChargeDeclined', 'conversionPending', 'trialStarted']);
  assert.equal(failures(rows).length, 1);
  assert.equal(summarizeLedger(rows).trialGrace, 1);
});

test('a cleared payment means an earlier decline no longer explains an ending', () => {
  const rows = buildSubscriberLedger(
    [sync({ at: '2026-07-01T00:00:00Z', status: 'active' })],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-08-05T00:00:00Z' }],
    [payment({ at: '2026-07-01T00:05:00Z' }), payment({ at: '2026-08-01T00:00:00Z' })],
    [],
    Date.parse('2026-08-06T00:00:00Z'),
    { declines: [decline({ at: '2026-07-20T00:00:00Z' })] },
  );
  assert.equal(rows[0].kind, 'accessEnded');
  assert.equal(rows[0].paymentFailure, false);
  assert.match(rows[0].detail, /^Subscription ended/);
});

// ── How a subscription starts paying ──────────────────────────────────────
// Only a trial that runs its course leaves a real gap between turning `active`
// and being charged (about an hour). Paying up front at checkout, or switching
// off a trial onto a paid plan, is charged at once, and the first invoice's
// billing_reason says which.

test('a signup paid up front is one arrival, not a pending charge', () => {
  const rows = buildSubscriberLedger(
    [sync({ at: '2026-09-23T15:00:00Z', status: 'active' })],
    [],
    [payment({ at: '2026-09-23T15:00:02Z', billingReason: 'subscription_create' })],
    [],
    Date.parse('2026-09-23T16:00:00Z'),
  );
  assert.deepEqual(rows.map((r) => r.kind), ['converted']);
  assert.equal(rows[0].detail, 'Paid up front at checkout — a new paying subscriber');
  assert.equal(rows[0].fullSubscriberDelta, 1);
  assert.equal(rows[0].convertingDelta, 0, 'nothing was ever pending');
});

test('a paid-up-front signup still being charged reads as a paid plan, not a trial', () => {
  // The seconds before the payment is on record.
  const rows = buildSubscriberLedger(
    [sync({ at: '2026-09-23T15:00:00Z', status: 'active' })],
    [],
    [],
    [],
    Date.parse('2026-09-23T15:00:01Z'),
  );
  assert.equal(rows[0].kind, 'conversionPending');
  assert.equal(rows[0].detail, 'Signed up on a paid plan — the first charge has not cleared yet');
});

test('a trial member switching to a paid plan is charged at once, and says so', () => {
  const trial = sync({ at: '2026-09-20T12:00:00Z', status: 'trialing', tier: 'basic' });
  const switched = sync({ at: '2026-09-22T10:00:00Z', status: 'active', tier: 'pro' });
  const paid = payment({ at: '2026-09-22T10:00:03Z', billingReason: 'subscription_update' });
  // Whichever of the two webhooks lands first.
  for (const [label, syncs, pays] of [
    ['status first', [trial, switched], [paid]],
    ['payment first', [trial, { ...switched, at: '2026-09-22T10:00:05Z' }], [paid]],
  ] as const) {
    const rows = buildSubscriberLedger([...syncs], [], [...pays], [], Date.parse('2026-09-23T00:00:00Z'));
    assert.deepEqual(rows.map((r) => r.kind), ['converted', 'trialStarted'], label);
    assert.equal(rows[0].detail, 'Ended the free trial early by switching to a paid plan, and paid at once', label);
    assert.equal(rows[0].freeTrialDelta, -1, label);
    assert.equal(rows[0].fullSubscriberDelta, 1, label);
  }
});

test('a switch whose charge is slow to clear is still called a switch', () => {
  // Say the bank asked for confirmation: pending for a while, but not a trial
  // that ran its course.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-09-20T12:00:00Z', status: 'trialing', tier: 'basic' }),
      sync({ at: '2026-09-22T10:00:00Z', status: 'active', tier: 'pro' }),
    ],
    [],
    [payment({ at: '2026-09-22T10:30:00Z', billingReason: 'subscription_update' })],
    [],
    Date.parse('2026-09-23T00:00:00Z'),
  );
  assert.deepEqual(rows.map((r) => r.kind), ['converted', 'conversionPending', 'trialStarted']);
  assert.equal(rows[1].detail, 'Switched from the free trial to a paid plan — the charge has not cleared yet');
});

test('a trial that runs its course is the one that waits for its charge, and names its plan', () => {
  // Including a Pro trial started before Pro stopped offering one.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-09-16T12:00:00Z', status: 'trialing', tier: 'pro' }),
      sync({ at: '2026-09-23T12:00:00Z', status: 'active', tier: 'pro' }),
    ],
    [],
    [payment({ at: '2026-09-23T13:00:00Z', billingReason: 'subscription_cycle' })],
    [],
    Date.parse('2026-09-24T00:00:00Z'),
  );
  assert.deepEqual(rows.map((r) => r.kind), ['converted', 'conversionPending', 'trialStarted']);
  assert.equal(
    rows[1].detail,
    'The Pro free trial ended and Stripe raised the first invoice — the charge has not been attempted yet',
  );
  assert.equal(rows[0].detail, 'The first payment cleared — now a paying subscriber');
});

test('a paid-up-front signup that first syncs as incomplete is new, not a return', () => {
  // Checkout creates the subscription `incomplete` (not counted) until the
  // charge clears; the payment can be on record before the `active` sync.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-09-23T15:00:00Z', status: 'incomplete', tier: 'public' }),
      sync({ at: '2026-09-23T15:00:05Z', status: 'active' }),
    ],
    [],
    [payment({ at: '2026-09-23T15:00:03Z', billingReason: 'subscription_create' })],
    [],
    Date.parse('2026-09-23T16:00:00Z'),
  );
  assert.deepEqual(rows.map((r) => r.kind), ['converted']);
  assert.equal(rows[0].detail, 'Paid up front at checkout — a new paying subscriber');
  assert.equal(rows[0].fullSubscriberDelta, 1);
});

test('a member who really lapsed and came back still reads as a return', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-01T00:00:00Z', status: 'active' }),
      sync({ at: '2026-09-01T00:00:00Z', status: 'canceled', tier: 'public' }),
      sync({ at: '2026-09-10T00:00:00Z', status: 'active' }),
    ],
    [],
    [payment({ at: '2026-08-01T00:05:00Z' })],
    [],
    Date.parse('2026-09-11T00:00:00Z'),
  );
  assert.equal(rows[0].kind, 'converted');
  assert.equal(rows[0].detail, 'Resubscribed — paying again');
});

test('a money-back refund reads as a refund, and never as a payment failure', () => {
  // The refund's own row can land after the deletion it caused, so it is read
  // as a fact about the subscription rather than as a step on the timeline.
  const rows = buildSubscriberLedger(
    [sync({ at: '2026-09-20T12:00:00Z', status: 'active' })],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-09-24T10:00:00Z', reason: 'too_expensive' }],
    [payment({ at: '2026-09-20T12:00:02Z' })],
    [],
    Date.parse('2026-09-24T12:00:00Z'),
    {
      refunds: [{ subId: 'sub_1', at: '2026-09-24T10:00:01Z' }],
      // A declined charge on record does not turn a refund into a failure.
      declines: [decline({ at: '2026-09-22T00:00:00Z' })],
    },
  );
  assert.equal(rows[0].kind, 'accessEnded');
  assert.equal(rows[0].detail, 'Refunded under the money-back guarantee — access ended (too_expensive)');
  assert.equal(rows[0].fullSubscriberDelta, -1);
  assert.equal(rows[0].paymentFailure, false);
});

test('an in-app switch off the trial reads as a switch whatever Stripe calls its invoice', () => {
  // The app records the switch itself ("Trial ended for paid switch …"), so the
  // row does not depend on the invoice's billing_reason.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-09-20T12:00:00Z', status: 'trialing', tier: 'basic' }),
      sync({ at: '2026-09-22T10:00:00Z', status: 'active', tier: 'pro' }),
    ],
    [],
    [payment({ at: '2026-09-22T10:00:03Z', billingReason: 'subscription_cycle' })],
    [],
    Date.parse('2026-09-23T00:00:00Z'),
    { trialSwitches: [{ subId: 'sub_1', at: '2026-09-22T10:00:04Z' }] },
  );
  assert.deepEqual(rows.map((r) => r.kind), ['converted', 'trialStarted']);
  assert.equal(rows[0].detail, 'Ended the free trial early by switching to a paid plan, and paid at once');
});
