import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProInterestEmail } from '../core/mailer.ts';
import { PRO_FEATURES, proWallCopy, proWallTerms } from '../core/proWall.ts';
import {
  describeProInterestTerms,
  parseExcludedEmails,
  proInterestSkipReason,
  type ProInterestCandidate,
} from '../core/proInterest.ts';

// The Pro interest email (make pro-interest-email) goes to Basic members who
// tried to open a Pro page. It is marketing sent by hand, so who it skips
// matters as much as what it says.

function candidate(over: Partial<ProInterestCandidate> = {}): ProInterestCandidate {
  return {
    email: 'trader@example.com',
    tier: 'basic',
    stripeSubscriptionId: 'sub_1',
    subscriptionStatus: 'trialing',
    cancelAtPeriodEnd: false,
    paused: false,
    marketingUnsubscribed: false,
    sentAt: null,
    ...over,
  };
}

const none = new Set<string>();

test('a Basic trialer or paying Basic member is sent the email', () => {
  assert.equal(proInterestSkipReason(candidate(), none), null);
  assert.equal(proInterestSkipReason(candidate({ subscriptionStatus: 'active' }), none), null);
});

test('everyone it must not reach is left out, with the reason the dry run prints', () => {
  assert.equal(proInterestSkipReason(candidate({ marketingUnsubscribed: true }), none), 'opted_out');
  assert.equal(proInterestSkipReason(candidate({ subscriptionStatus: 'past_due' }), none), 'past_due');
  assert.equal(proInterestSkipReason(candidate({ subscriptionStatus: 'unpaid' }), none), 'past_due');
  assert.equal(proInterestSkipReason(candidate({ cancelAtPeriodEnd: true }), none), 'canceling');
  assert.equal(proInterestSkipReason(candidate({ paused: true }), none), 'paused');
  assert.equal(proInterestSkipReason(candidate({ tier: 'pro' }), none), 'not_basic');
  assert.equal(proInterestSkipReason(candidate({ stripeSubscriptionId: null }), none), 'no_plan');
  assert.equal(proInterestSkipReason(candidate({ subscriptionStatus: 'canceled' }), none), 'no_plan');
  // Once per member, ever.
  assert.equal(proInterestSkipReason(candidate({ sentAt: '2026-10-30T15:00:00Z' }), none), 'already_sent');
});

test('EXCLUDE= matches addresses whatever their case or spacing', () => {
  const excluded = parseExcludedEmails(' Trader@Example.com , other@example.com,');
  assert.deepEqual([...excluded], ['trader@example.com', 'other@example.com']);
  assert.equal(proInterestSkipReason(candidate(), excluded), 'excluded');
  assert.equal(parseExcludedEmails(undefined).size, 0);
});

const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-30T15:00:00Z');
const basicMonthly = { tier: 'basic', cadence: 'monthly' } as const;

function email(status: string, hoursLeft: number) {
  const terms = proWallTerms({
    status,
    current: basicMonthly,
    periodEndIso: new Date(NOW + hoursLeft * HOUR).toISOString(),
    guaranteeUsed: false,
    nowMs: NOW,
  });
  const copy = proWallCopy(terms);
  return {
    terms,
    ...buildProInterestEmail({
      priceLine: copy.priceLine,
      termsLine: copy.termsLine,
      annualLine: copy.annual?.line ?? null,
      features: PRO_FEATURES,
      switchUrl: 'https://zerogex.io/login?next=%2Fpricing%3Fswitch%3Dpro',
      annualUrl: 'https://zerogex.io/login?next=%2Fpricing%3Fcadence%3Dannual',
      unsubUrl: 'https://zerogex.io/unsubscribe?u=u1&t=sig',
    }),
  };
}

test("the email carries the locked screen's terms for where the member is", () => {
  const lastDays = email('trialing', 30);
  assert.match(lastDays.text, /Switch now and the rest of it stays free/);
  assert.match(describeProInterestTerms(lastDays.terms), /last two days/);

  const early = email('trialing', 120);
  assert.match(early.text, /starts Pro at \$59 today, covered by the 7-day money-back guarantee/);
  assert.match(early.text, /Pro annual is \$299, about \$24\.92 a month/);

  const paid = email('active', 400);
  assert.match(paid.text, /Stripe shows you the exact amount before anything changes/);
  assert.doesNotMatch(paid.text, /guarantee/);
});

test('it reads as a founder note, lists what Pro adds, links the switch, and can be unsubscribed from', () => {
  const { subject, text, html } = email('trialing', 30);
  assert.equal(subject, 'About the Pro pages you tried to open');
  assert.match(text, /^Hi,\n\nMichael here, the founder of ZeroGEX\./);
  for (const feature of PRO_FEATURES) assert.ok(text.includes(feature), feature);
  assert.ok(text.includes('Switch to Pro: https://zerogex.io/login?next=%2Fpricing%3Fswitch%3Dpro'));
  assert.ok(text.includes('Unsubscribe: https://zerogex.io/unsubscribe?u=u1&t=sig'));
  assert.ok(html.includes('href="https://zerogex.io/unsubscribe?u=u1&amp;t=sig"'));
  // Full price: no discount to wait for.
  assert.doesNotMatch(text, /% off|discount|coupon/i);
});
