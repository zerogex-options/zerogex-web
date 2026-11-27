import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A courtesy refund (a full refund marked "Requested by customer", given in the
// Stripe Dashboard outside the money-back guarantee) is the customer's one
// refund. These lock down which refunds count, the ledger they land in, and
// that the guarantee's one-refund limit now sees them (core/courtesyRefunds.ts).

const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-courtesy-')), 'auth.db');
process.env.AUTH_DB_PATH = dbPath;
// core/stripe.ts builds its price table at module load.
process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';

const { getDb } = await import('../core/db.ts');
const {
  decideCourtesyRefund,
  courtesyRefundRecord,
  recordCourtesyRefund,
  isCourtesyRefundRecorded,
  hasPriorCourtesyRefund,
  recordCourtesyRefundForCharge,
} = await import('../core/courtesyRefunds.ts');
const { hasPriorMoneyBackRefund } = await import('../core/moneyBackServer.ts');
type CourtesyRefundLike = import('../core/courtesyRefunds.ts').CourtesyRefundLike;

const db = getDb();
const T0 = Math.floor(Date.UTC(2026, 10, 26, 21, 50) / 1000);

function charge(over: Record<string, unknown> = {}) {
  return {
    id: 'ch_1',
    amount: 5900,
    amount_refunded: 5900,
    currency: 'usd',
    customer: 'cus_1',
    payment_method_details: { card: { fingerprint: 'fp_1' } },
    billing_details: { email: null },
    ...over,
  };
}

function refund(over: Partial<CourtesyRefundLike> = {}): CourtesyRefundLike {
  return {
    id: 're_1',
    amount: 5900,
    created: T0,
    reason: 'requested_by_customer',
    status: 'succeeded',
    charge: 'ch_1',
    metadata: {},
    ...over,
  };
}

const INVOICE = { kind: 'invoice' as const, invoiceId: 'in_1' };

// --- What counts ---------------------------------------------------------------

test('a full refund marked "Requested by customer", outside the guarantee, counts', () => {
  const decision = decideCourtesyRefund({ charge: charge(), refunds: [refund()], invoice: INVOICE });
  assert.deepEqual(decision, {
    counts: true,
    refundIds: ['re_1'],
    refundedAtMs: T0 * 1000,
    cardFingerprint: 'fp_1',
    customerId: 'cus_1',
    invoiceId: 'in_1',
  });
});

test('a partial refund is a goodwill credit, not the one refund', () => {
  const decision = decideCourtesyRefund({
    charge: charge({ amount_refunded: 1000 }),
    refunds: [refund({ amount: 1000 })],
    invoice: INVOICE,
  });
  assert.deepEqual(decision, { counts: false, why: 'partial' });
});

test('a refund for our own mistake (Duplicate, or Other with no reason) never costs the customer the guarantee', () => {
  for (const reason of ['duplicate', 'fraudulent', null]) {
    assert.deepEqual(
      decideCourtesyRefund({ charge: charge(), refunds: [refund({ reason })], invoice: INVOICE }),
      { counts: false, why: 'not_customer_requested' },
      `reason ${reason}`,
    );
  }
});

test("the money-back flow's own refunds are left to its ledger", () => {
  assert.deepEqual(
    decideCourtesyRefund({
      charge: charge(),
      refunds: [refund({ metadata: { money_back: '1', subscription_id: 'sub_1' } })],
      invoice: INVOICE,
    }),
    { counts: false, why: 'money_back' },
  );
});

test('a refund that failed or was canceled moved no money', () => {
  for (const status of ['failed', 'canceled']) {
    assert.deepEqual(
      decideCourtesyRefund({ charge: charge(), refunds: [refund({ status })], invoice: INVOICE }),
      { counts: false, why: 'no_refund' },
    );
  }
  // A pending refund is money on its way back: it counts.
  assert.equal(
    decideCourtesyRefund({ charge: charge(), refunds: [refund({ status: 'pending' })], invoice: INVOICE }).counts,
    true,
  );
});

test('only subscription payments: a known one-off charge is out, an unresolved invoice still counts', () => {
  assert.deepEqual(
    decideCourtesyRefund({ charge: charge(), refunds: [refund()], invoice: { kind: 'none' } }),
    { counts: false, why: 'one_off_charge' },
  );
  const unresolved = decideCourtesyRefund({
    charge: charge(),
    refunds: [refund()],
    invoice: { kind: 'unknown', reason: 'charge lookup failed' },
  });
  assert.equal(unresolved.counts, true);
  assert.equal(unresolved.counts && unresolved.invoiceId, null);
});

test("refunds on another charge are ignored, and several on this one are all named", () => {
  const decision = decideCourtesyRefund({
    charge: charge({ amount_refunded: 5900 }),
    refunds: [
      refund({ id: 're_b', amount: 2900, created: T0 + 60 }),
      refund({ id: 're_a', amount: 3000 }),
      refund({ id: 're_other', charge: 'ch_2' }),
    ],
    invoice: INVOICE,
  });
  assert.equal(decision.counts, true);
  assert.deepEqual(decision.counts && decision.refundIds, ['re_a', 're_b']);
  assert.equal(decision.counts && decision.refundedAtMs, (T0 + 60) * 1000, 'dated by the latest refund');
});

// --- The ledger, and the guarantee reading it -------------------------------------

function recordFor(over: { chargeId: string; email: string; userId: string | null; fingerprint?: string | null }) {
  const decision = decideCourtesyRefund({
    charge: charge({ id: over.chargeId, payment_method_details: { card: { fingerprint: over.fingerprint ?? null } } }),
    refunds: [refund({ charge: over.chargeId })],
    invoice: INVOICE,
  });
  assert.ok(decision.counts);
  return courtesyRefundRecord(
    charge({ id: over.chargeId }),
    decision,
    over.userId ? { id: over.userId, email: over.email } : null,
    'webhook',
  );
}

test('recording is idempotent, and a later refund on the same charge updates the row', () => {
  const record = recordFor({ chargeId: 'ch_ledger', email: 'ledger@example.com', userId: 'user_ledger' });
  assert.equal(isCourtesyRefundRecorded('ch_ledger'), false);
  assert.equal(recordCourtesyRefund(record, '2026-11-27T00:00:00.000Z'), 'recorded');
  assert.equal(recordCourtesyRefund(record, '2026-11-27T00:00:01.000Z'), 'unchanged', 'a webhook redelivery');
  assert.equal(
    recordCourtesyRefund({ ...record, refundIds: ['re_1', 're_2'] }, '2026-11-27T00:00:02.000Z'),
    'updated',
  );
  assert.equal(isCourtesyRefundRecorded('ch_ledger'), true);
  const row = db.prepare('SELECT refund_ids, email_canonical, source FROM courtesy_refunds WHERE charge_id = ?').get('ch_ledger') as {
    refund_ids: string;
    email_canonical: string;
    source: string;
  };
  assert.deepEqual({ ...row }, { refund_ids: 're_1,re_2', email_canonical: 'ledger@example.com', source: 'webhook' });
});

test('a courtesy refund is found by account, by canonical email, or by card', () => {
  recordCourtesyRefund(
    recordFor({ chargeId: 'ch_jesse', email: 'Jesse.Sanchez+zgx@gmail.com', userId: 'user_jesse', fingerprint: 'fp_jesse' }),
    '2026-11-27T00:00:00.000Z',
  );
  assert.equal(hasPriorCourtesyRefund({ userId: 'user_jesse', email: 'other@example.com', cardFingerprint: null }), true);
  assert.equal(
    hasPriorCourtesyRefund({ userId: 'user_new', email: 'jessesanchez@googlemail.com', cardFingerprint: null }),
    true,
    'a new account on the same Gmail address',
  );
  assert.equal(hasPriorCourtesyRefund({ userId: 'user_new', email: 'new@example.com', cardFingerprint: 'fp_jesse' }), true);
  assert.equal(hasPriorCourtesyRefund({ userId: 'user_new', email: 'new@example.com', cardFingerprint: null }), false);
});

test('the gap this closes: a courtesy refund alone now uses up the money-back guarantee', () => {
  recordCourtesyRefund(
    recordFor({ chargeId: 'ch_nolan', email: 'nolan@example.com', userId: 'user_nolan' }),
    '2026-11-27T00:00:00.000Z',
  );
  // No money_back_refunds row anywhere for this customer.
  assert.equal(
    hasPriorMoneyBackRefund({ userId: 'user_nolan', email: 'nolan@example.com', cardFingerprint: null, subscriptionId: 'sub_new' }),
    true,
  );
  assert.equal(
    hasPriorMoneyBackRefund({ userId: 'user_stranger', email: 'stranger@example.com', cardFingerprint: null, subscriptionId: '' }),
    false,
  );
});

test('the webhook path: reads the charge refunds, records a courtesy refund, leaves anything else alone', async () => {
  const lister = (refunds: CourtesyRefundLike[]) => ({
    refunds: { list: async () => ({ data: refunds }) },
  });
  const nowIso = '2026-11-27T00:00:00.000Z';
  const user = { id: 'user_hook', email: 'hook@example.com' };

  const recorded = await recordCourtesyRefundForCharge(lister([refund({ charge: 'ch_hook' })]), charge({ id: 'ch_hook' }), {
    invoice: INVOICE,
    user,
    nowIso,
  });
  assert.equal(recorded.state, 'recorded');
  assert.equal(hasPriorCourtesyRefund({ userId: 'user_hook', email: 'hook@example.com', cardFingerprint: null }), true);

  const duplicate = await recordCourtesyRefundForCharge(
    lister([refund({ charge: 'ch_dup', reason: 'duplicate' })]),
    charge({ id: 'ch_dup' }),
    { invoice: INVOICE, user: { id: 'user_dup', email: 'dup@example.com' }, nowIso },
  );
  assert.deepEqual(duplicate, { state: 'not_courtesy', why: 'not_customer_requested' });
  assert.equal(isCourtesyRefundRecorded('ch_dup'), false);
});

// --- Wiring --------------------------------------------------------------------------

test('wiring: the refund webhook records courtesy refunds, and the guarantee checks them', () => {
  const route = fs.readFileSync(new URL('../app/api/webhooks/stripe/route.ts', import.meta.url), 'utf8');
  const refunded = route.slice(route.indexOf("case 'charge.refunded'"), route.indexOf("case 'charge.dispute.created'"));
  assert.ok(refunded.includes('recordCourtesyRefundForCharge(getStripe(), charge'), 'charge.refunded records it');
  assert.ok(
    refunded.indexOf("type: 'refund_issued'") < refunded.indexOf('recordCourtesyRefundForCharge'),
    'after the refund itself is logged, so a failure here never loses that row',
  );
  assert.ok(refunded.includes("type: 'courtesy_refund_record_failed'"), 'a failure is recorded, not thrown');

  const server = fs.readFileSync(new URL('../core/moneyBackServer.ts', import.meta.url), 'utf8');
  const limit = server.slice(server.indexOf('export function hasPriorMoneyBackRefund'), server.indexOf('function cardFromCharge'));
  assert.ok(limit.includes('hasPriorCourtesyRefund('), 'the one-refund limit reads the courtesy ledger');
});
