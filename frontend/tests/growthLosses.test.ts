import test from 'node:test';
import assert from 'node:assert/strict';
import { cancelEvents, failureEvents, settleLosses, type LossEvent } from '../core/growthLosses.ts';
import { buildSubscriberLedger, type LedgerSyncEvent } from '../core/subscriberBucket.ts';

// The Forward-Looking Growth Rate subtracts these losses from its signups. The
// contract: one loss per member leaving, counted when they decide or their
// charge fails, and none once they take the cancel back or pay the bill.

const at = (iso: string) => Date.parse(iso);
const start = (kind: 'cancel' | 'failure', iso: string, subId: string | null = 'sub_1'): LossEvent => ({
  kind,
  undo: false,
  subId,
  who: 'u1',
  atMs: at(iso),
});
const undo = (kind: 'cancel' | 'failure', iso: string, subId = 'sub_1'): LossEvent => ({
  kind,
  undo: true,
  subId,
  who: 'u1',
  atMs: at(iso),
});
const standing = (events: LossEvent[]) => settleLosses(events).filter((l) => l.undoneAtMs == null);

test('a declined charge that is then paid is not a loss', () => {
  const losses = settleLosses([start('failure', '2026-10-01T00:00:00Z'), undo('failure', '2026-10-03T00:00:00Z')]);
  assert.equal(losses.length, 1);
  assert.equal(losses[0].undoneAtMs, at('2026-10-03T00:00:00Z'));
});

test('a cancel taken back is not a loss, and canceling again counts once', () => {
  const losses = settleLosses([
    start('cancel', '2026-10-01T00:00:00Z'),
    undo('cancel', '2026-10-02T00:00:00Z'),
    start('cancel', '2026-10-05T00:00:00Z'),
  ]);
  assert.deepEqual(
    losses.map((l) => [l.kind, l.atMs, l.undoneAtMs]),
    [
      ['cancel', at('2026-10-01T00:00:00Z'), at('2026-10-02T00:00:00Z')],
      ['cancel', at('2026-10-05T00:00:00Z'), null],
    ],
  );
});

test('the Cancel click and its acknowledgment are one decision, even across midnight', () => {
  assert.equal(
    standing([start('cancel', '2026-10-01T03:59:59Z'), start('cancel', '2026-10-01T04:00:01Z')]).length,
    1,
  );
});

test('a member declined and then canceling is one loss, not two', () => {
  const losses = standing([start('failure', '2026-10-01T00:00:00Z'), start('cancel', '2026-10-02T00:00:00Z')]);
  assert.deepEqual(losses.map((l) => l.kind), ['failure']);
});

test('declined, canceled, then paid: the cancel still stands, on its own day', () => {
  const losses = standing([
    start('failure', '2026-10-01T00:00:00Z'),
    start('cancel', '2026-10-02T00:00:00Z'),
    undo('failure', '2026-10-03T00:00:00Z'),
  ]);
  assert.deepEqual(losses.map((l) => [l.kind, l.atMs]), [['cancel', at('2026-10-02T00:00:00Z')]]);
});

test('an undo with nothing standing changes nothing', () => {
  // A win-back on a member whose cancel was never counted.
  assert.deepEqual(settleLosses([undo('cancel', '2026-10-01T00:00:00Z')]), []);
});

test('losses on different subscriptions are separate', () => {
  // Declined on one subscription, resubscribed, then canceled the new one.
  const losses = standing([
    start('failure', '2026-10-01T00:00:00Z', 'sub_1'),
    start('cancel', '2026-10-05T00:00:00Z', 'sub_2'),
  ]);
  assert.equal(losses.length, 2);
});

test('a renewal declined and paid, then declined again, is one standing loss', () => {
  const losses = settleLosses([
    start('failure', '2026-08-01T00:00:00Z'),
    undo('failure', '2026-08-03T00:00:00Z'),
    start('failure', '2026-09-01T00:00:00Z'),
  ]);
  assert.deepEqual(losses.map((l) => l.undoneAtMs == null), [false, true]);
});

// ── From the ledger ────────────────────────────────────────────────────────

function sync(over: Partial<LedgerSyncEvent> & { at: string }): LedgerSyncEvent {
  return {
    subId: 'sub_1',
    userId: 'u1',
    email: 'a@example.com',
    status: 'active',
    tier: 'pro',
    cancelAtPeriodEnd: false,
    ...over,
  };
}

test('a renewal Stripe retried and collected leaves no loss on the ledger', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-09-01T00:00:00Z', status: 'active' }),
      sync({ at: '2026-10-01T00:00:00Z', status: 'past_due' }),
      sync({ at: '2026-10-04T00:00:00Z', status: 'active' }),
    ],
    [],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-09-01T00:00:00Z' }],
    [],
    at('2026-10-05T00:00:00Z'),
  );
  assert.equal(rows.filter((r) => r.paymentFailure).length, 1);
  assert.equal(standing(failureEvents(rows)).length, 0);
});

test('a declined trial charge that is then paid leaves no loss, whichever webhook lands first', () => {
  // Stripe's successful retry sends the payment and the turn to `active` within
  // moments of each other. Paid first, the ledger says `recovered`; active
  // first, it says `converted`. Both are the member paying.
  for (const paidAt of ['2026-09-08T23:59:59Z', '2026-09-09T00:00:01Z']) {
    const rows = buildSubscriberLedger(
      [
        sync({ at: '2026-09-01T00:00:00Z', status: 'trialing' }),
        sync({ at: '2026-09-08T00:00:00Z', status: 'active' }),
        sync({ at: '2026-09-08T01:00:00Z', status: 'past_due' }),
        sync({ at: '2026-09-09T00:00:00Z', status: 'active' }),
      ],
      [],
      [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: paidAt }],
      [],
      at('2026-09-10T00:00:00Z'),
    );
    assert.deepEqual(rows.filter((r) => r.paymentFailure).map((r) => r.kind), ['trialChargeDeclined'], paidAt);
    assert.equal(standing(failureEvents(rows)).length, 0, paidAt);
  }
});

test('a declined trial charge never paid stays one loss', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-09-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-09-08T00:00:00Z', status: 'active' }),
      sync({ at: '2026-09-08T01:00:00Z', status: 'past_due' }),
      sync({ at: '2026-09-15T00:00:00Z', status: 'canceled', tier: 'public' }),
    ],
    [],
    [],
    [],
    at('2026-09-16T00:00:00Z'),
  );
  assert.equal(standing(failureEvents(rows)).length, 1);
});

// ── From the audit log ─────────────────────────────────────────────────────

const row = (type: string, created_at: string, message: string) => ({ type, user_id: 'u1', created_at, message });
const syncRow = (created_at: string, status: string, cancel: boolean, sub = 'sub_1') =>
  row('stripe_subscription_sync', created_at, `Subscription ${sub} status=${status} tier=pro cancelAtPeriodEnd=${cancel}`);
const click = (created_at: string, sub = 'sub_1') =>
  row('stripe_cancellation_requested', created_at, `Cancellation requested for sub ${sub}`);
const ack = (created_at: string, sub = 'sub_1') =>
  row('cancellation_ack_email_sent', created_at, `Sent cancellation ack email for sub ${sub}`);

test('un-canceling anywhere (the sync clears the flag) takes the cancel back', () => {
  const events = cancelEvents([
    syncRow('2026-10-01T00:00:00Z', 'active', true),
    click('2026-10-01T00:00:00Z'),
    ack('2026-10-01T00:00:01Z'),
    // Keep my plan, the Stripe portal, a plan switch: all reach us as this.
    syncRow('2026-10-03T00:00:00Z', 'active', false),
  ]);
  assert.equal(standing(events).length, 0);
});

test('a cancel that runs its course is still a loss', () => {
  const events = cancelEvents([
    syncRow('2026-10-01T00:00:00Z', 'trialing', true),
    click('2026-10-01T00:00:00Z'),
    // The subscription ends; a final sync that reads canceled is not a reversal.
    syncRow('2026-10-08T00:00:00Z', 'canceled', false),
  ]);
  assert.equal(standing(events).length, 1);
});

test('a win-back that cleared the cancel takes it back; one that kept it does not', () => {
  const cleared = cancelEvents([
    click('2026-10-01T00:00:00Z'),
    row('billing_winback_discount_honored', '2026-10-02T00:00:00Z', 'Self-serve retention save on sub sub_1: stacked X, cleared cancel_at_period_end'),
  ]);
  assert.equal(standing(cleared).length, 0);

  const kept = cancelEvents([
    click('2026-10-01T00:00:00Z'),
    row('billing_winback_discount_honored', '2026-10-02T00:00:00Z', 'Honored win-back discount on sub sub_1 (pro/monthly): applied X over [none] (kept)'),
  ]);
  assert.equal(standing(kept).length, 1);
});

test('Keep my plan in the app takes the cancel back even before the sync lands', () => {
  const events = cancelEvents([
    click('2026-10-01T00:00:00Z'),
    row('billing_cancel_reverted_in_app', '2026-10-02T00:00:00Z', 'In-app cancel reverted for sub sub_1 (Keep my plan)'),
  ]);
  assert.equal(standing(events).length, 0);
});

test('a money-back refund is a loss nothing takes back', () => {
  const events = cancelEvents([
    row('money_back_refund_issued', '2026-10-01T00:00:00Z', 'Money-back refund (self_serve) on sub sub_1: refunded $59.00 [re_1], subscription canceled'),
  ]);
  assert.equal(standing(events).length, 1);
});
