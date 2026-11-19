import test from 'node:test';
import assert from 'node:assert/strict';
import { createBusyDb, DAY, NOW_MS } from './support/busyDb.ts';

// make reinstate-paid-period re-creates "the plan they paid for" from the
// newest paid, non-zero invoice. Until the next renewal, a member who upgraded
// has that invoice as the upgrade itself, whose first line is the credit for the
// plan they LEFT. Reading the first line reinstated a Pro member on Basic.
// A real dry run of the script against this test's copy of the schema, with
// Stripe answered by tests/support/stub-http.mts.

const { fixture, member, run } = await createBusyDb('reinstate-upgrade');
const S = (ms: number) => Math.floor((NOW_MS + ms) / 1000);

test('after a Basic-to-Pro upgrade it reinstates Pro, the plan the invoice charged for', (t) => {
  const f = fixture(t);
  member(f, 'naif@example.test', {
    tier: 'public',
    stripe_customer_id: 'cus_n',
    stripe_subscription_id: 'sub_old',
    subscription_status: 'canceled',
  });
  const routes = {
    'GET api.stripe.com/v1/subscriptions': {
      object: 'list', has_more: false,
      data: [{ id: 'sub_old', object: 'subscription', status: 'canceled', customer: 'cus_n', metadata: {},
               items: { data: [{ price: { id: 'price_pro_monthly' } }] } }],
    },
    'GET api.stripe.com/v1/invoices': {
      object: 'list', has_more: false,
      data: [{
        id: 'in_up', object: 'invoice', customer: 'cus_n', subscription: 'sub_old', status: 'paid',
        amount_paid: 1606, currency: 'usd', billing_reason: 'subscription_update',
        status_transitions: { paid_at: S(-25 * DAY) },
        lines: { data: [
          { amount: -2000, price: { id: 'price_basic_monthly' }, period: { start: S(-25 * DAY), end: S(-1 * DAY) } },
          { amount: 3606, price: { id: 'price_pro_monthly' }, period: { start: S(-25 * DAY), end: S(-1 * DAY) } },
        ] },
      }],
    },
  };
  const until = new Date(NOW_MS + 30 * DAY).toISOString();
  const r = run(f, 'reinstate-paid-period.mts', ['--email', 'naif@example.test', '--until', until], {
    routes,
    env: {
      STRIPE_SECRET_KEY: 'sk_test_x',
      STRIPE_PRICE_BASIC_MONTHLY: 'price_basic_monthly',
      STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly',
    },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Plan to reinstate:\s+pro \/ monthly\s+\(price price_pro_monthly\)/);
  assert.match(r.stdout, /plan-change invoice/);
  assert.match(r.stdout, /\[dry-run\]/);
});
