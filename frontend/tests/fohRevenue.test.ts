import test from 'node:test';
import assert from 'node:assert/strict';
import {
  closingQuarterFor,
  donationCentsFor,
  formatQuarterRevenue,
  parseQuarterLabel,
  tallyQuarterRevenue,
} from '../core/fohRevenue.ts';

// The quarterly Folds of Honor donation is 3% of the quarter's gross
// subscription revenue. These pin what is counted, so the figure in the
// reminder email matches the pledge on /giving.

const Q3 = parseQuarterLabel('Q3 2026');
const at = (iso: string) => Date.parse(iso) / 1000;

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'in_x',
    status: 'paid',
    currency: 'usd',
    amount_paid: 4900,
    billing_reason: 'subscription_cycle',
    subscription: 'sub_1',
    tax: 0,
    created: at('2026-08-01T12:00:00Z'),
    status_transitions: { paid_at: at('2026-08-01T13:00:00Z') },
    charge: { id: 'ch_1', amount_refunded: 0 },
    ...overrides,
  };
}

test('quarter windows: label, inclusive last day, exclusive next start', () => {
  assert.equal(Q3.label, 'Q3 2026');
  assert.equal(Q3.startIso, '2026-07-01');
  assert.equal(Q3.endIso, '2026-09-30');
  assert.equal(Q3.startUnix, at('2026-07-01T00:00:00Z'));
  assert.equal(Q3.endUnixExclusive, at('2026-10-01T00:00:00Z'));
  assert.equal(parseQuarterLabel('Q4 2026').endIso, '2026-12-31');
  assert.throws(() => parseQuarterLabel('2026 Q3'));
});

test('closing quarter is the previous one, wrapping the year in January', () => {
  assert.equal(closingQuarterFor(new Date('2026-10-05T14:00:00Z')).label, 'Q3 2026');
  assert.equal(closingQuarterFor(new Date('2027-01-05T14:00:00Z')).label, 'Q4 2026');
  assert.equal(closingQuarterFor(new Date('2026-04-05T14:00:00Z')).label, 'Q1 2026');
});

test('counts by PAID instant, including the whole last day of the quarter', () => {
  const r = tallyQuarterRevenue(
    [
      invoice({ status_transitions: { paid_at: at('2026-07-01T00:00:00Z') } }),
      invoice({ status_transitions: { paid_at: at('2026-09-30T23:59:59Z') } }),
      // created in Q3, paid in Q4: not this quarter's money
      invoice({ created: at('2026-09-30T22:00:00Z'), status_transitions: { paid_at: at('2026-10-01T00:00:00Z') } }),
      // created in Q2, paid in Q3: this quarter's money
      invoice({ created: at('2026-06-20T00:00:00Z'), status_transitions: { paid_at: at('2026-07-15T00:00:00Z') } }),
      invoice({ status_transitions: { paid_at: at('2026-06-30T23:59:59Z') } }),
    ],
    Q3,
    3,
  );
  assert.equal(r.invoiceCount, 3);
  assert.equal(r.grossCents, 3 * 4900);
});

test('counts new, renewal and upgrade charges; skips unpaid, zero and non-subscription', () => {
  const r = tallyQuarterRevenue(
    [
      invoice({ billing_reason: 'subscription_create', amount_paid: 29900 }),
      invoice({ billing_reason: 'subscription_cycle', amount_paid: 4900 }),
      invoice({ billing_reason: 'subscription_update', amount_paid: 1234 }),
      invoice({ status: 'open' }),
      invoice({ amount_paid: 0 }),
      invoice({ billing_reason: 'manual', subscription: null, amount_paid: 10000, charge: null }),
    ],
    Q3,
    3,
  );
  assert.equal(r.grossCents, 29900 + 4900 + 1234);
  assert.equal(r.invoiceCount, 3);
  assert.deepEqual(r.excluded, { count: 1, cents: 10000 });
  assert.deepEqual(r.byReason.map((l) => l.reason), ['subscription_create', 'subscription_cycle', 'subscription_update']);
});

test('reads the subscription from the basil shape too', () => {
  const r = tallyQuarterRevenue(
    [
      invoice({
        billing_reason: 'manual',
        subscription: undefined,
        parent: { subscription_details: { subscription: 'sub_9' } },
      }),
    ],
    Q3,
    3,
  );
  assert.equal(r.invoiceCount, 1);
  assert.equal(r.excluded.count, 0);
});

test('tax and refunds are reported, not subtracted', () => {
  const r = tallyQuarterRevenue(
    [
      invoice({ amount_paid: 5292, tax: 392 }),
      invoice({ amount_paid: 4900, charge: { id: 'ch_2', amount_refunded: 4900 } }),
      invoice({ amount_paid: 4900, charge: 'ch_3' }), // not expanded: unknown
    ],
    Q3,
    3,
  );
  assert.equal(r.grossCents, 5292 + 4900 + 4900);
  assert.equal(r.taxCents, 392);
  assert.equal(r.refundedCents, 4900);
  assert.equal(r.refundUnknownCount, 1);
});

test('non-USD invoices are flagged, never added in', () => {
  const r = tallyQuarterRevenue([invoice(), invoice({ currency: 'eur' })], Q3, 3);
  assert.equal(r.grossCents, 4900);
  assert.deepEqual(r.nonUsd, { count: 1, currencies: ['eur'] });
});

test('donation rounds UP to the cent and is exact when it divides evenly', () => {
  assert.equal(donationCentsFor(10000, 3), 300);
  assert.equal(donationCentsFor(4900, 3), 147);
  assert.equal(donationCentsFor(4999, 3), 150); // 149.97 -> 150
  assert.equal(donationCentsFor(0, 3), 0);
  assert.equal(donationCentsFor(10000, 3.5), 350);
});

test('the printed breakdown leads with the gross and ends with the donation', () => {
  const r = tallyQuarterRevenue([invoice({ amount_paid: 149700 })], Q3, 3);
  const text = formatQuarterRevenue(r).join('\n');
  assert.match(text, /Gross subscription revenue: {2}\$1,497\.00 {2}\(1 paid invoice\)/);
  assert.match(text, /Donation \(3%, rounded up to the cent\): \$44\.91$/);
});
