import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRIAL_PRO_UPGRADE_OPEN_HOURS,
  isTrialProUpgradeOpen,
  proSwitchPath,
  trialProUpgradeOpensAtMs,
} from '../core/trialProUpgrade.ts';

// The two-day Pro upgrade opens when the trial-end reminder can go out (48h
// before the trial ends, give or take 3h), so a member who clicks the email the
// moment it lands is always inside the window.

const HOUR = 3_600_000;
const NOW = Date.parse('2026-11-02T15:00:00Z');
const basicMonthly = { tier: 'basic', cadence: 'monthly' } as const;

function open(over: Partial<Parameters<typeof isTrialProUpgradeOpen>[0]> = {}): boolean {
  return isTrialProUpgradeOpen({
    status: 'trialing',
    current: basicMonthly,
    trialEndMs: NOW + 30 * HOUR,
    nowMs: NOW,
    ...over,
  });
}

test('the window opens 51 hours before the trial ends, the earliest the reminder sends', () => {
  assert.equal(TRIAL_PRO_UPGRADE_OPEN_HOURS, 51);
  const trialEndMs = NOW + 100 * HOUR;
  assert.equal(trialProUpgradeOpensAtMs(trialEndMs), trialEndMs - 51 * HOUR);
  assert.equal(open({ trialEndMs: NOW + 51 * HOUR }), true);
  assert.equal(open({ trialEndMs: NOW + 51 * HOUR + 1 }), false);
});

test('open until the trial ends, then closed', () => {
  assert.equal(open({ trialEndMs: NOW + 1 }), true);
  assert.equal(open({ trialEndMs: NOW }), false);
  assert.equal(open({ trialEndMs: NOW - HOUR }), false);
});

test('only a Basic monthly subscription that is still trialing', () => {
  assert.equal(open({ status: 'active' }), false);
  assert.equal(open({ status: 'past_due' }), false);
  assert.equal(open({ status: null }), false);
  assert.equal(open({ current: { tier: 'pro', cadence: 'monthly' } }), false);
  assert.equal(open({ current: { tier: 'basic', cadence: 'annual' } }), false);
  assert.equal(open({ current: null }), false);
  assert.equal(open({ trialEndMs: null }), false);
  assert.equal(open({ trialEndMs: Number.NaN }), false);
});

test('a switch link lands on Pro monthly with the switch open and its source named', () => {
  const url = new URL(proSwitchPath('trial_reminder'), 'https://zerogex.io');
  assert.equal(url.pathname, '/pricing');
  assert.equal(url.searchParams.get('plan'), 'pro');
  assert.equal(url.searchParams.get('cadence'), 'monthly');
  assert.equal(url.searchParams.get('switch'), 'pro');
  assert.equal(url.searchParams.get('from'), 'trial_reminder');
});
