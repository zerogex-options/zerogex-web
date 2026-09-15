import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSubscriptionPaymentEvidence,
  SUBSCRIPTION_PAYMENT_AUDIT_TYPES,
} from '../core/subscriptionPayments.ts';
import { buildSubscriberLedger, type LedgerPaymentEvent } from '../core/subscriberBucket.ts';

// The rule deciding which audit rows prove a SUBSCRIPTION's own invoice was
// paid, plus the ledger behaviour that depends on it. Both halves matter and
// they fail in opposite directions: too strict and a paying member is parked on
// Converting forever, too loose and every trial is marked paid on day one and
// the Converting band disappears.

// The real message shapes, verbatim from the writers:
//   stripe_invoice_paid   — app/api/webhooks/stripe/route.ts, the invoice.paid case
//   stripe_first_payment  — app/api/webhooks/stripe/route.ts, maybeStampFirstPayment
const invoicePaid = (over: { id?: string; sub?: string; amount?: number; reason?: string } = {}) =>
  `Invoice ${over.id ?? 'in_1'} paid for sub ${over.sub ?? 'sub_1'}`
  + ` amount=${over.amount ?? 1900}`
  + ` billing_reason=${over.reason ?? 'subscription_cycle'}`
  + ' period_end=1792064603 price=price_pro';

const firstPayment = (sub = 'sub_1') =>
  `First payment cleared on sub ${sub} (invoice in_1, 1900 usd)`;

// ── The rule ───────────────────────────────────────────────────────────────

test('both audit types are consulted, and nothing else is', () => {
  assert.deepEqual([...SUBSCRIPTION_PAYMENT_AUDIT_TYPES], [
    'stripe_first_payment',
    'stripe_invoice_paid',
  ]);
  // A sync carries a sub id and the word "paid" is nowhere near it, but the
  // type gate is what must reject it — a widened query cannot smuggle one in.
  assert.equal(
    isSubscriptionPaymentEvidence('stripe_subscription_sync', 'Subscription sub_1 status=active tier=pro'),
    false,
  );
  assert.equal(isSubscriptionPaymentEvidence('stripe_payment_failed', invoicePaid()), false);
});

test('a stripe_first_payment row always counts', () => {
  // maybeStampFirstPayment applies the trial-opening exclusion before writing,
  // so these arrive pre-filtered.
  assert.equal(isSubscriptionPaymentEvidence('stripe_first_payment', firstPayment()), true);
});

test('a real conversion or renewal invoice counts', () => {
  assert.equal(isSubscriptionPaymentEvidence('stripe_invoice_paid', invoicePaid()), true);
  assert.equal(
    isSubscriptionPaymentEvidence('stripe_invoice_paid', invoicePaid({ reason: 'subscription_create' })),
    true,
    'a no-trial signup pays a real amount on its subscription_create invoice',
  );
});

test('the $0 trial-OPENING invoice never counts', () => {
  // Stripe raises and settles this the instant a trial starts. Letting it
  // through would mark every trial as paid on day one.
  assert.equal(
    isSubscriptionPaymentEvidence(
      'stripe_invoice_paid',
      invoicePaid({ amount: 0, reason: 'subscription_create' }),
    ),
    false,
  );
  // $0 for any OTHER reason is a real billing period bought with credit.
  assert.equal(
    isSubscriptionPaymentEvidence('stripe_invoice_paid', invoicePaid({ amount: 0, reason: 'subscription_cycle' })),
    true,
  );
});

test('an unparseable amount is kept, not dropped', () => {
  // Under-reporting a real payment parks a paying member on Converting, which
  // is the worse of the two failures — so the filter only excludes what it can
  // positively identify as the trial-opening invoice.
  assert.equal(
    isSubscriptionPaymentEvidence(
      'stripe_invoice_paid',
      'Invoice in_1 paid for sub sub_1 billing_reason=subscription_create price=price_pro',
    ),
    true,
  );
});

// ── The ledger, end to end ─────────────────────────────────────────────────

// What readSubscriptionPayments in core/monitoring.ts does to each audit row,
// reproduced here so these exercise the real shape rather than a tidied one.
function toPayments(
  rows: Array<{ type: string; message: string; at: string }>,
): LedgerPaymentEvent[] {
  return rows
    .filter((row) => isSubscriptionPaymentEvidence(row.type, row.message))
    .map((row) => ({
      subId: row.message.match(/sub_[A-Za-z0-9]+/)![0],
      userId: 'u1',
      email: 'a@example.com',
      at: row.at,
    }));
}

const sync = (at: string, status: string) => ({
  subId: 'sub_1UDNQu4AOiqteMYYHThhMgaZ',
  userId: 'u1',
  email: 'lukaszrymarczyk79@example.test',
  at,
  status,
  tier: 'pro',
  cancelAtPeriodEnd: false,
});

test('a RETURNING payer leaves Converting when their invoice clears', () => {
  // lukaszrymarczyk79's real production sequence. This account already had
  // users.first_payment_at set from a PREVIOUS subscription, so the webhook's
  // once-per-account stamp short-circuited and no stripe_first_payment row was
  // ever written for this one. On that stream alone the ledger booked
  // "Conversion charge pending" at 11:44 and then went silent — the $19 that
  // cleared an hour later was invisible, and the fallback window would have
  // promoted him two days later under "never reported as failed".
  const rows = buildSubscriberLedger(
    [
      sync('2026-09-08T11:43:25.291Z', 'trialing'),
      sync('2026-09-08T11:43:37.238Z', 'trialing'),
      sync('2026-09-09T05:22:26.669Z', 'trialing'),
      sync('2026-09-15T11:44:02.437Z', 'active'),
    ],
    [],
    toPayments([
      {
        type: 'stripe_invoice_paid',
        at: '2026-09-15T12:44:36.348Z',
        message: invoicePaid({
          id: 'in_1UFumL4AOiqteMYYvOsN67A4',
          sub: 'sub_1UDNQu4AOiqteMYYHThhMgaZ',
        }),
      },
    ]),
    Date.parse('2026-09-15T14:44:00.000Z'),
  );

  assert.deepEqual(rows.map((r) => r.kind), ['converted', 'conversionPending', 'trialStarted']);
  const converted = rows[0];
  assert.equal(converted.at, '2026-09-15T12:44:36.348Z', 'booked when the money moved');
  assert.equal(converted.fullSubscriberDelta, 1);
  assert.equal(converted.convertingDelta, -1);
  assert.match(converted.detail, /first payment cleared/);
});

test('the trial-opening invoice does not collapse the Converting band', () => {
  // The same trial, with Stripe's $0 subscription_create invoice in the stream
  // and the conversion charge NOT yet paid. If that invoice were treated as the
  // subscription's first payment, the trial->paid step would classify straight
  // to Full Subscriber and Converting would never be entered at all.
  const rows = buildSubscriberLedger(
    [
      sync('2026-09-08T11:43:25.291Z', 'trialing'),
      sync('2026-09-15T11:44:02.437Z', 'active'),
    ],
    [],
    toPayments([
      {
        type: 'stripe_invoice_paid',
        at: '2026-09-08T11:43:24.000Z',
        message: invoicePaid({
          sub: 'sub_1UDNQu4AOiqteMYYHThhMgaZ',
          amount: 0,
          reason: 'subscription_create',
        }),
      },
    ]),
    Date.parse('2026-09-15T14:44:00.000Z'),
  );

  assert.deepEqual(rows.map((r) => r.kind), ['conversionPending', 'trialStarted']);
  assert.equal(rows[0].convertingDelta, 1);
  assert.equal(
    rows.reduce((m, r) => m + r.fullSubscriberDelta, 0),
    0,
    'the paying line must not move until the charge clears',
  );
});

test('a renewal after the first payment adds no second row', () => {
  // The stream now carries every paid invoice, not just the first, so the
  // builder's "a renewal, not the first payment" guard is load-bearing.
  const rows = buildSubscriberLedger(
    [
      sync('2026-09-08T11:43:25.291Z', 'trialing'),
      sync('2026-09-15T11:44:02.437Z', 'active'),
    ],
    [],
    toPayments([
      {
        type: 'stripe_invoice_paid',
        at: '2026-09-15T12:44:36.348Z',
        message: invoicePaid({ sub: 'sub_1UDNQu4AOiqteMYYHThhMgaZ' }),
      },
      {
        type: 'stripe_invoice_paid',
        at: '2026-10-15T12:44:36.348Z',
        message: invoicePaid({ id: 'in_next', sub: 'sub_1UDNQu4AOiqteMYYHThhMgaZ' }),
      },
    ]),
    Date.parse('2026-10-16T00:00:00.000Z'),
  );

  assert.equal(rows.filter((r) => r.kind === 'converted').length, 1);
  assert.equal(
    rows.reduce((m, r) => m + r.fullSubscriberDelta, 0),
    1,
    'one member, counted once',
  );
});
