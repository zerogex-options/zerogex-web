import test from 'node:test';
import assert from 'node:assert/strict';

import { partnerSignupStatus, type PartnerSignupInput } from '../core/partnerSignups.ts';

// The label `make partners SIGNUPS=1` puts on each member a creator brought in.
// "Paying" has to agree with the dashboard's Full Subscriber line, or a creator's
// numbers and the admin chart tell two different stories about the same people.

function member(overrides: Partial<PartnerSignupInput> = {}): PartnerSignupInput {
  return {
    deleted: false,
    tier: 'public',
    subscriptionStatus: null,
    paymentGraceReason: null,
    cancelAtPeriodEnd: false,
    subscriptionLapsed: false,
    stripeSubscriptionId: null,
    lastPaidSubscriptionId: null,
    lastPaidInvoiceAt: null,
    ...overrides,
  };
}

const PAID = {
  tier: 'pro',
  subscriptionStatus: 'active',
  stripeSubscriptionId: 'sub_1',
  lastPaidSubscriptionId: 'sub_1',
  lastPaidInvoiceAt: '2026-10-20T00:00:00.000Z',
};

test('paying now: Full Subscriber, counted as paying', () => {
  assert.deepEqual(partnerSignupStatus(member(PAID)), { label: 'Full Subscriber', paying: true });
});

test('paying but canceled at period end: still paying this period, and says so', () => {
  assert.deepEqual(partnerSignupStatus(member({ ...PAID, cancelAtPeriodEnd: true })), {
    label: 'Full Subscriber, canceling',
    paying: true,
  });
});

test('active with the first charge still in flight is not paying yet', () => {
  assert.deepEqual(
    partnerSignupStatus(member({ ...PAID, lastPaidSubscriptionId: null, lastPaidInvoiceAt: null })),
    { label: 'Converting', paying: false },
  );
});

test('a trial is not paying', () => {
  assert.deepEqual(
    partnerSignupStatus(
      member({ tier: 'basic', subscriptionStatus: 'trialing', stripeSubscriptionId: 'sub_1' }),
    ),
    { label: 'Free Trial', paying: false },
  );
});

test('signed up and never subscribed', () => {
  assert.deepEqual(partnerSignupStatus(member()), { label: 'No plan', paying: false });
});

test('subscribed and then left', () => {
  assert.deepEqual(partnerSignupStatus(member({ subscriptionLapsed: true })), {
    label: 'Canceled',
    paying: false,
  });
});

test('a paid tier with no subscription is free access, not a paying member', () => {
  assert.deepEqual(partnerSignupStatus(member({ tier: 'pro' })), {
    label: 'Free access',
    paying: false,
  });
});

test('a paused subscription is neither paying nor active', () => {
  assert.deepEqual(
    partnerSignupStatus(
      member({ tier: 'public', subscriptionStatus: 'active', stripeSubscriptionId: 'sub_1' }),
    ),
    { label: 'Paused', paying: false },
  );
});

test('a deleted account says so', () => {
  assert.deepEqual(partnerSignupStatus(member({ ...PAID, deleted: true })), {
    label: 'Deleted account',
    paying: false,
  });
});
