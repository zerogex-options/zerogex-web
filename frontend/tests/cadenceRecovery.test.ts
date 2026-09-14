import test from 'node:test';
import assert from 'node:assert/strict';
import type { CohortAuditInput } from '../core/cohortRetention.ts';
import { resolveCadence } from '../core/cohortRetentionServer.ts';

// Cancelling a subscription nulls `stripe_price_id`, so for every churned
// customer the obvious source of billing cadence is gone. A filter that reads
// only that column silently deletes them, and the monthly renewal rate is then
// computed over survivors. These are the fallbacks that keep them in.

const unix = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const invoice = (paidAt: string, periodStart: string, periodEnd: string, price = 'unknown'): CohortAuditInput => ({
  userId: 'u',
  type: 'stripe_invoice_paid',
  createdAt: paidAt,
  message: `Invoice in_1 paid for sub sub_1 amount=1900 billing_reason=subscription_cycle`
    + ` period_start=${unix(periodStart)} period_end=${unix(periodEnd)} price=${price}`,
});
const checkout = (at: string, cadence: string): CohortAuditInput =>
  ({ userId: 'u', type: 'billing_checkout_started', createdAt: at, message: `tier=pro cadence=${cadence} founding=0 session=cs_1` });

test('an unmapped price id falls through instead of being guessed at', () => {
  // Only a price the SKU table actually knows takes the current_price path. The
  // table is built from env, so a retired or founding price is simply absent —
  // and inventing a cadence for it would be worse than admitting we don't know.
  assert.deepEqual(resolveCadence('price_not_in_the_table', []), { cadence: null, source: 'unknown' });
});

test('a year-long billing period is an annual subscription, whatever the price is called', () => {
  // The production case: a founding annual price that maps to no SKU, whose
  // customer was being reported as monthly from a stale checkout row.
  const result = resolveCadence(null, [
    checkout('2026-06-04T00:00:00Z', 'monthly'),
    invoice('2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z', '2027-09-11T00:00:00Z'),
  ]);
  assert.deepEqual(result, { cadence: 'annual', source: 'invoice_period' });
});

test('a month-long billing period is monthly', () => {
  const result = resolveCadence(null, [
    invoice('2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z'),
  ]);
  assert.deepEqual(result, { cadence: 'monthly', source: 'invoice_period' });
});

test('the checkout audit is the last resort, not the first', () => {
  // A customer who opened four checkout sessions and bought on the third leaves
  // a trail whose final entry is not what they bought — which is exactly why
  // this source ranks below the invoice.
  const result = resolveCadence(null, [checkout('2026-06-01T00:00:00Z', 'annual')]);
  assert.deepEqual(result, { cadence: 'annual', source: 'checkout_audit' });
});

test('an account with no evidence at all is unknown, never assumed monthly', () => {
  assert.deepEqual(resolveCadence(null, []), { cadence: null, source: 'unknown' });
});

test('a zero-length or inverted period is ignored rather than trusted', () => {
  const result = resolveCadence(null, [
    invoice('2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    checkout('2026-06-01T00:00:00Z', 'monthly'),
  ]);
  assert.equal(result.source, 'checkout_audit');
});
