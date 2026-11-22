import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tierIncludesTradeworkzAlerts,
  tradeworkzSkipReason,
  type TradeworkzRecipient,
} from '../core/tradeworkzDelivery.ts';

// A follow outlives the plan that made it, and the backend fans every bot
// entry and exit out to all followers. So the email worker decides at send
// time who may still receive these Pro alerts. Until 2026-11 it checked only
// that the address was verified, so churned, free and deleted accounts kept
// getting every trade.

function member(over: Partial<TradeworkzRecipient> = {}): TradeworkzRecipient {
  return {
    id: 'user_1',
    email: 'member@example.com',
    email_verified_at: '2026-10-01T00:00:00.000Z',
    tier: 'pro',
    deleted_at: null,
    ...over,
  };
}

test('a verified Pro or admin member gets the alert', () => {
  assert.equal(tradeworkzSkipReason(member()), null);
  assert.equal(tradeworkzSkipReason(member({ tier: 'admin' })), null);
  assert.equal(tradeworkzSkipReason(member({ tier: 'elite' })), null, 'legacy elite folds into pro');
});

test('a member below Pro does not, whatever they followed earlier', () => {
  for (const tier of ['basic', 'public', 'starter', null, 'nonsense']) {
    assert.equal(
      tradeworkzSkipReason(member({ tier })),
      'plan does not include TradeWorkz alerts',
      String(tier),
    );
    assert.equal(tierIncludesTradeworkzAlerts(tier), false, String(tier));
  }
});

test('a deleted account never does, even on a Pro row', () => {
  assert.equal(tradeworkzSkipReason(member({ deleted_at: '2026-11-01T00:00:00.000Z' })), 'account deleted');
});

test('unknown and unverified recipients are skipped as before', () => {
  assert.equal(tradeworkzSkipReason(undefined), 'unknown recipient');
  assert.equal(tradeworkzSkipReason(member({ email_verified_at: null })), 'unverified recipient');
});
