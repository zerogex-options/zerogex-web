import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';

// Reading and writing a subscription's discount set (core/subscriptionDiscounts.ts)
// — the two traps behind "the promo was silently dropped" and "the 100%-off
// monthly coupon rode onto a quarterly invoice".

import {
  attachedCouponIds,
  describeDiscountsParam,
  discountsParam,
  readAttachedDiscounts,
} from '../core/subscriptionDiscounts.ts';

// A real stripe-node client whose transport records the form body it would send.
function recordingClient() {
  const bodies: string[] = [];
  const fakeFetch = (async (_url: unknown, init?: { body?: unknown }) => {
    bodies.push(String(init?.body ?? ''));
    return new Response(JSON.stringify({ id: 'sub_1', object: 'subscription' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  const stripe = new Stripe('sk_test_recording', {
    apiVersion: '2025-02-24.acacia',
    httpClient: Stripe.createFetchHttpClient(fakeFetch),
    maxNetworkRetries: 0,
  });
  return { stripe, bodies };
}

test('stripe-node drops an EMPTY ARRAY from the request, so only "" clears the set', async () => {
  const { stripe, bodies } = recordingClient();
  await stripe.subscriptions.update('sub_1', { discounts: [] as unknown as '' , proration_behavior: 'none' });
  await stripe.subscriptions.update('sub_1', { discounts: '', proration_behavior: 'none' });
  assert.equal(decodeURIComponent(bodies[0]).includes('discounts'), false, 'an empty array never reaches Stripe');
  assert.match(bodies[1], /(^|&)discounts=(&|$)/);
});

test('what discountsParam produces is what reaches Stripe', async () => {
  const { stripe, bodies } = recordingClient();
  const attached = [{ discountId: 'di_promo', couponId: 'PROMO' }];
  await stripe.subscriptions.update('sub_1', { discounts: discountsParam([], attached) });
  await stripe.subscriptions.update('sub_1', { discounts: discountsParam(['PROMO', 'REF'], attached) });
  assert.equal(bodies[0], 'discounts=');
  assert.equal(
    decodeURIComponent(bodies[1]),
    'discounts[0][discount]=di_promo&discounts[1][coupon]=REF',
  );
});

test('an empty wanted set is "", never []', () => {
  assert.equal(discountsParam([], []), '');
  assert.equal(discountsParam([], [{ discountId: 'di_1', couponId: 'A' }]), '');
});

test('a coupon already attached is kept by its discount id; a new one is added by coupon', () => {
  const attached = [
    { discountId: 'di_a', couponId: 'A' },
    { discountId: 'di_b', couponId: 'B' },
  ];
  assert.deepEqual(discountsParam(['B', 'C', 'B'], attached), [{ discount: 'di_b' }, { coupon: 'C' }]);
  assert.equal(describeDiscountsParam(discountsParam(['B', 'C'], attached), attached), 'B (kept), C');
  assert.equal(describeDiscountsParam('', attached), 'none');
});

test('bare discount ids (event payloads, plain retrieves) are unknown, not "no discounts"', () => {
  assert.equal(readAttachedDiscounts({ discounts: ['di_1'] } as never), null);
  assert.equal(
    readAttachedDiscounts({ discounts: [{ id: 'di_1', coupon: { id: 'A' } }, 'di_2'] } as never),
    null,
  );
  assert.deepEqual(readAttachedDiscounts({ discounts: [] } as never), []);
  assert.deepEqual(readAttachedDiscounts({} as never), []);
});

test('expanded discounts are read as (discount, coupon) pairs', () => {
  const attached = readAttachedDiscounts({
    discounts: [
      { id: 'di_1', coupon: { id: 'PROMO' } },
      { id: 'di_2', coupon: 'REF' },
    ],
  } as never);
  assert.deepEqual(attached, [
    { discountId: 'di_1', couponId: 'PROMO' },
    { discountId: 'di_2', couponId: 'REF' },
  ]);
  assert.deepEqual(attachedCouponIds(attached ?? []), ['PROMO', 'REF']);
});
