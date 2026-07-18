import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCampaignCode,
  isCampaignCode,
  getCampaignCouponId,
} from '../core/campaigns.ts';

// Configure a campaign (TARGET) with both cadences, and one that's annual-only
// (LAUNCH), before importing anything cadence-dependent. campaigns.ts reads
// process.env live, so setting these here is sufficient.
process.env.STRIPE_CAMPAIGN_TARGET_MONTHLY = 'coupon_target_monthly';
process.env.STRIPE_CAMPAIGN_TARGET_ANNUAL = 'coupon_target_annual';
process.env.STRIPE_CAMPAIGN_LAUNCH_ANNUAL = 'coupon_launch_annual';
delete process.env.STRIPE_CAMPAIGN_LAUNCH_MONTHLY;

test('normalizeCampaignCode recognizes configured codes case-insensitively', () => {
  assert.equal(normalizeCampaignCode('TARGET'), 'TARGET');
  assert.equal(normalizeCampaignCode('target'), 'TARGET');
  assert.equal(normalizeCampaignCode('  Target  '), 'TARGET');
  assert.equal(normalizeCampaignCode('LAUNCH'), 'LAUNCH'); // annual-only still counts
});

test('normalizeCampaignCode rejects unknown / malformed codes', () => {
  assert.equal(normalizeCampaignCode('NOTACODE'), null); // no env configured
  assert.equal(normalizeCampaignCode(''), null);
  assert.equal(normalizeCampaignCode(null), null);
  assert.equal(normalizeCampaignCode(undefined), null);
  assert.equal(normalizeCampaignCode('TAR-GET'), null); // non-alphanumeric
  assert.equal(normalizeCampaignCode('8CHARREF'), null); // shape ok but unconfigured
});

test('isCampaignCode is true only for configured codes', () => {
  assert.equal(isCampaignCode('TARGET'), true);
  assert.equal(isCampaignCode('launch'), true);
  assert.equal(isCampaignCode('SPYLEVELS'), false);
});

test('getCampaignCouponId resolves per cadence', () => {
  assert.equal(getCampaignCouponId('TARGET', 'monthly'), 'coupon_target_monthly');
  assert.equal(getCampaignCouponId('TARGET', 'annual'), 'coupon_target_annual');
  assert.equal(getCampaignCouponId('target', 'annual'), 'coupon_target_annual');
});

test('getCampaignCouponId returns null for an unconfigured cadence', () => {
  // LAUNCH is annual-only: monthly buyers get no campaign coupon (the checkout
  // route then falls back to any active promo, never the referral path).
  assert.equal(getCampaignCouponId('LAUNCH', 'monthly'), null);
  assert.equal(getCampaignCouponId('LAUNCH', 'annual'), 'coupon_launch_annual');
});

test('getCampaignCouponId returns null for unknown codes', () => {
  assert.equal(getCampaignCouponId('NOPE', 'monthly'), null);
  assert.equal(getCampaignCouponId(null, 'annual'), null);
});
