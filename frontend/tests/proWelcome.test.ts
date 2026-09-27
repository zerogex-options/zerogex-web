import test from 'node:test';
import assert from 'node:assert/strict';
import { isWelcomeEligible } from '../core/proWelcome.ts';
import type { WelcomeUser } from '../core/proWelcome.ts';
import { isNewMember, NEW_MEMBER_WINDOW_DAYS } from '../core/newMember.ts';

// The one-time first-run welcome greets a freshly-subscribed member on their
// first landing in the app. The gate is the contract for who sees it, so lock
// the matrix down.

const NOW = Date.parse('2026-09-27T15:00:00.000Z');
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

const pro: WelcomeUser = {
  tier: 'pro',
  hasActiveSubscription: true,
  proWelcomeSeenAt: null,
};

const basic: WelcomeUser = {
  tier: 'basic',
  hasActiveSubscription: true,
  basicWelcomeSeenAt: null,
  memberSince: daysAgo(1),
};

test('isWelcomeEligible: a new Pro subscriber who has not seen it qualifies', () => {
  assert.equal(isWelcomeEligible(pro, NOW), true);
});

test('isWelcomeEligible: Pro keeps its launch-era gate (no new-member window)', () => {
  // pro_welcome_seen_at was backfilled for the paid base when it shipped, so a
  // NULL stamp already means "subscribed after launch" and needs no age check.
  // That also greets a long-time Basic member on the day they upgrade.
  assert.equal(isWelcomeEligible({ ...pro, memberSince: daysAgo(200) }, NOW), true);
  assert.equal(isWelcomeEligible({ ...pro, memberSince: null }, NOW), true);
});

test('isWelcomeEligible: a new Basic member who has not seen it qualifies', () => {
  assert.equal(isWelcomeEligible(basic, NOW), true);
  assert.equal(isWelcomeEligible({ ...basic, memberSince: daysAgo(13) }, NOW), true);
});

test('isWelcomeEligible: an established Basic member never sees it', () => {
  // basic_welcome_seen_at is not backfilled; the new-member window is what
  // keeps the welcome off members who have been paying for months.
  assert.equal(isWelcomeEligible({ ...basic, memberSince: daysAgo(NEW_MEMBER_WINDOW_DAYS) }, NOW), false);
  assert.equal(isWelcomeEligible({ ...basic, memberSince: daysAgo(90) }, NOW), false);
  assert.equal(isWelcomeEligible({ ...basic, memberSince: null }, NOW), false);
});

test('isWelcomeEligible: each tier reads its own seen-stamp', () => {
  assert.equal(isWelcomeEligible({ ...basic, basicWelcomeSeenAt: daysAgo(0) }, NOW), false);
  assert.equal(isWelcomeEligible({ ...pro, proWelcomeSeenAt: '2026-07-20T00:00:00.000Z' }, NOW), false);
  // A Basic member who saw the Basic welcome and then upgrades still gets the
  // Pro one (it announces the Pro-only API keys).
  assert.equal(isWelcomeEligible({ ...pro, basicWelcomeSeenAt: daysAgo(3) }, NOW), true);
  // The Pro stamp does not silence a Basic welcome (downgrade into a new plan).
  assert.equal(isWelcomeEligible({ ...basic, proWelcomeSeenAt: daysAgo(3) }, NOW), true);
});

test('isWelcomeEligible: public and admin never qualify', () => {
  assert.equal(isWelcomeEligible({ ...basic, tier: 'public' }, NOW), false);
  // Admin is granted, never subscribed, so it must not fire even with the
  // (unexpected) active flag set.
  assert.equal(isWelcomeEligible({ ...pro, tier: 'admin' }, NOW), false);
});

test('isWelcomeEligible: requires a live Stripe subscription', () => {
  // Grandfathered members (paid tier, no Stripe sub) are excluded.
  assert.equal(isWelcomeEligible({ ...pro, hasActiveSubscription: false }, NOW), false);
  assert.equal(isWelcomeEligible({ ...basic, hasActiveSubscription: false }, NOW), false);
  assert.equal(isWelcomeEligible({ tier: 'pro', proWelcomeSeenAt: null }, NOW), false);
});

test('isWelcomeEligible: null/undefined user is safe', () => {
  assert.equal(isWelcomeEligible(null, NOW), false);
  assert.equal(isWelcomeEligible(undefined, NOW), false);
});

test('isNewMember: the first two weeks after the first subscription', () => {
  assert.equal(isNewMember(daysAgo(0), NOW), true);
  assert.equal(isNewMember(daysAgo(13.9), NOW), true);
  assert.equal(isNewMember(daysAgo(14), NOW), false);
  assert.equal(isNewMember(daysAgo(40), NOW), false);
});

test('isNewMember: a missing or unreadable stamp is not new', () => {
  assert.equal(isNewMember(null, NOW), false);
  assert.equal(isNewMember(undefined, NOW), false);
  assert.equal(isNewMember('', NOW), false);
  assert.equal(isNewMember('not a date', NOW), false);
});

test('isNewMember: a stamp slightly ahead of the browser clock still counts', () => {
  assert.equal(isNewMember(new Date(NOW + 60_000).toISOString(), NOW), true);
});
