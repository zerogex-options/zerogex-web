import test from 'node:test';
import assert from 'node:assert/strict';
import { cancelDecisionRows } from '../core/cancelDecisions.ts';

// The growth-rate card and the Growth tab count cancellations off these rows.
// Every plan but Basic monthly is now paid up front under a 7-day money-back
// guarantee, and a refund cancels on the spot: no Cancel click is ever written
// for it. The contract: one decision per member leaving, whichever way they go.

const click = (sub: string) => ({ type: 'stripe_cancellation_requested', message: `Cancellation requested for sub ${sub}` });
const ack = (sub: string) => ({ type: 'cancellation_ack_email_sent', message: `Sent cancellation ack email for sub ${sub}` });
const refund = (sub: string, type = 'money_back_refund_issued') => ({
  type,
  message: `Money-back refund (self_serve) on sub ${sub}: refunded $59.00 [re_123], subscription canceled`,
});

test('a refund with no Cancel click before it is a decision to leave', () => {
  assert.deepEqual(cancelDecisionRows([refund('sub_a')]), [refund('sub_a')]);
});

test('Cancel clicks all pass through; callers dedupe the request and ack pair', () => {
  assert.equal(cancelDecisionRows([click('sub_a'), ack('sub_a')]).length, 2);
});

test('a refund after a Cancel click on the same subscription is the same decision', () => {
  const rows = [click('sub_a'), ack('sub_a'), refund('sub_a')];
  assert.deepEqual(cancelDecisionRows(rows), [click('sub_a'), ack('sub_a')]);
});

test('a refund re-run that finishes an incomplete one counts once', () => {
  const rows = [refund('sub_a', 'money_back_refund_incomplete'), refund('sub_a')];
  assert.deepEqual(cancelDecisionRows(rows), [refund('sub_a', 'money_back_refund_incomplete')]);
});

test('another subscription’s click does not swallow a refund', () => {
  assert.equal(cancelDecisionRows([click('sub_a'), refund('sub_b')]).length, 2);
});

test('rows of any other type are ignored, so a whole query can be passed in', () => {
  const sync = { type: 'stripe_subscription_sync', message: 'Subscription sub_a status=active tier=pro cancelAtPeriodEnd=false' };
  assert.deepEqual(cancelDecisionRows([sync, refund('sub_a')]), [refund('sub_a')]);
});
