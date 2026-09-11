import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATRIOT_PLEDGE_START_ISO,
  PATRIOT_PLEDGE_END_ISO,
  PATRIOT_PLEDGE_DISCOUNT_PCT,
  LIST_PRICE_CENTS,
  isPatriotPledgeOpen,
  qualifiesForPledge,
  discountedPriceCents,
  pledgedDonationCents,
  donationFromCollectedCents,
  tallyPledge,
  formatUsdCents,
} from '../core/patriotPledge.ts';

const START = Date.parse(PATRIOT_PLEDGE_START_ISO);
const END = Date.parse(PATRIOT_PLEDGE_END_ISO);

test('window opens at ET midnight on the 25th anniversary and closes Monday night', () => {
  // 2026-09-11T04:00Z is 00:00 EDT on September 11 — the anniversary itself.
  assert.equal(new Date(START).toISOString(), '2026-09-11T04:00:00.000Z');
  // Closes at the last millisecond of Monday September 14 ET.
  assert.equal(new Date(END).toISOString(), '2026-09-15T03:59:59.999Z');
  assert.ok(END > START);
});

test('isPatriotPledgeOpen is inclusive of both endpoints', () => {
  assert.equal(isPatriotPledgeOpen(START), true);
  assert.equal(isPatriotPledgeOpen(END), true);
  assert.equal(isPatriotPledgeOpen(START - 1), false);
  assert.equal(isPatriotPledgeOpen(END + 1), false);
});

test('isPatriotPledgeOpen rejects times outside the window', () => {
  // 11:59 PM ET on September 10 — one minute early.
  assert.equal(isPatriotPledgeOpen(Date.parse('2026-09-11T03:59:00Z')), false);
  // Midday Friday September 11, squarely inside.
  assert.equal(isPatriotPledgeOpen(Date.parse('2026-09-11T16:00:00Z')), true);
  // Sunday, and the closing Monday, still count.
  assert.equal(isPatriotPledgeOpen(Date.parse('2026-09-13T16:00:00Z')), true);
  assert.equal(isPatriotPledgeOpen(Date.parse('2026-09-14T23:00:00Z')), true);
  // Tuesday morning ET — shut.
  assert.equal(isPatriotPledgeOpen(Date.parse('2026-09-15T13:00:00Z')), false);
});

test('qualifiesForPledge keys on subscription start, so trials still count', () => {
  // Signs up Friday the 11th. The 7-day trial means the first invoice is not
  // collected until the 18th, long after the window shuts — the sub must still
  // qualify, because we advertised it to them on the 11th.
  const signedUp = Date.parse('2026-09-11T15:00:00Z');
  assert.equal(qualifiesForPledge(signedUp), true);
  // Someone who signs up that Wednesday does not.
  assert.equal(qualifiesForPledge(Date.parse('2026-09-16T15:00:00Z')), false);
});

test('25% comes off every list price exactly', () => {
  assert.equal(PATRIOT_PLEDGE_DISCOUNT_PCT, 25);
  assert.equal(discountedPriceCents('basic', 'monthly'), 2_925); // $39.00 -> $29.25
  assert.equal(discountedPriceCents('pro', 'monthly'), 4_425); // $59.00 -> $44.25
  assert.equal(discountedPriceCents('basic', 'annual'), 14_925); // $199.00 -> $149.25
  assert.equal(discountedPriceCents('pro', 'annual'), 22_425); // $299.00 -> $224.25
});

test('discount is computed off list, never off an already-discounted figure', () => {
  for (const tier of ['basic', 'pro'] as const) {
    for (const cadence of ['monthly', 'annual'] as const) {
      const list = LIST_PRICE_CENTS[tier][cadence];
      assert.equal(discountedPriceCents(tier, cadence), Math.round(list * 0.75));
    }
  }
});

test('monthly donates the entire first collected month', () => {
  // 100% of what we collect, not 100% of list: we never charged list.
  assert.equal(pledgedDonationCents('basic', 'monthly'), discountedPriceCents('basic', 'monthly'));
  assert.equal(pledgedDonationCents('pro', 'monthly'), discountedPriceCents('pro', 'monthly'));
  assert.equal(pledgedDonationCents('pro', 'monthly'), 4_425); // $44.25
});

test('annual donates one twelfth — the equivalent of that same first month', () => {
  // $149.25 / 12 = $12.4375 -> $12.44
  assert.equal(pledgedDonationCents('basic', 'annual'), 1_244);
  // $224.25 / 12 = $18.6875 -> $18.69
  assert.equal(pledgedDonationCents('pro', 'annual'), 1_869);
});

test('the annual equivalent is never dressed up as a bigger number', () => {
  // Guards the honesty of the public claim: an annual subscriber's donation
  // must land near one month of their own rate, not near the annual payment.
  for (const tier of ['basic', 'pro'] as const) {
    const annual = pledgedDonationCents(tier, 'annual');
    const monthlyEquivalent = discountedPriceCents(tier, 'annual') / 12;
    assert.ok(Math.abs(annual - monthlyEquivalent) <= 1);
    assert.ok(annual < discountedPriceCents(tier, 'annual'));
  }
});

test('donationFromCollectedCents handles the amounts Stripe actually reports', () => {
  // A monthly invoice where the coupon did attach.
  assert.equal(donationFromCollectedCents(4_425, 'monthly'), 4_425);
  // A prorated or partially-credited invoice — donate what we took, no more.
  assert.equal(donationFromCollectedCents(1_312, 'monthly'), 1_312);
  // Annual still splits twelve ways.
  assert.equal(donationFromCollectedCents(22_425, 'annual'), 1_869);
  // A comped or fully-discounted row owes nothing rather than throwing.
  assert.equal(donationFromCollectedCents(0, 'monthly'), 0);
  assert.equal(donationFromCollectedCents(-500, 'monthly'), 0);
  assert.equal(donationFromCollectedCents(Number.NaN, 'annual'), 0);
});

test('tallyPledge sums rounded lines so the published ledger reconciles', () => {
  const tally = tallyPledge([
    { invoiceId: 'in_1', cadence: 'monthly', collectedCents: 4_425 },
    { invoiceId: 'in_2', cadence: 'monthly', collectedCents: 2_925 },
    { invoiceId: 'in_3', cadence: 'annual', collectedCents: 22_425 },
    { invoiceId: 'in_4', cadence: 'annual', collectedCents: 14_925 },
  ]);

  assert.equal(tally.invoiceCount, 4);
  assert.equal(tally.collectedCents, 4_425 + 2_925 + 22_425 + 14_925);
  // 4425 + 2925 + 1869 + 1244
  assert.equal(tally.donationCents, 10_463);
  // The line items are what the receipt page prints; they must add to the total.
  const lineSum = tally.lines.reduce((acc, l) => acc + l.donationCents, 0);
  assert.equal(lineSum, tally.donationCents);
  assert.equal(tally.lines[2].donationCents, 1_869);
});

test('tallyPledge on an empty window owes nothing', () => {
  const tally = tallyPledge([]);
  assert.equal(tally.invoiceCount, 0);
  assert.equal(tally.donationCents, 0);
  assert.equal(tally.collectedCents, 0);
  assert.deepEqual(tally.lines, []);
});

test('formatUsdCents renders cents for the receipt', () => {
  assert.equal(formatUsdCents(10_463), '$104.63');
  assert.equal(formatUsdCents(1_869), '$18.69');
  assert.equal(formatUsdCents(0), '$0.00');
});
