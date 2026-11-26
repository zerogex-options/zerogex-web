import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pendingScheduleId, releasePendingPlanChange, RELEASE_SETTLE_MS } from '../core/pendingPlanChange.ts';
import { dict as cancelFlowDict } from '../components/CancelRetentionModal.i18n.ts';

// A plan change the billing portal holds until period end keeps the
// subscription on a schedule, and Stripe won't set a cancel while one is
// attached. Both places that set a cancel release it first
// (core/pendingPlanChange.ts).

test('nothing attached: no plan change waiting', () => {
  assert.equal(pendingScheduleId({ schedule: null }), null);
  assert.equal(pendingScheduleId({ schedule: undefined }), null);
  assert.equal(pendingScheduleId({}), null);
  assert.equal(pendingScheduleId({ schedule: '' }), null);
});

test('a schedule id, as Stripe sends it unexpanded', () => {
  assert.equal(pendingScheduleId({ schedule: 'sub_sched_123' }), 'sub_sched_123');
});

test('an expanded schedule object', () => {
  assert.equal(pendingScheduleId({ schedule: { id: 'sub_sched_456' } }), 'sub_sched_456');
  assert.equal(pendingScheduleId({ schedule: { id: null } }), null);
});

// The Stripe calls and the waits, in the order they happened.
function fakeStripe(failWith?: Error) {
  const steps: string[] = [];
  return {
    steps,
    sleep: async (ms: number) => {
      steps.push(`wait ${ms}`);
    },
    subscriptionSchedules: {
      async release(id: string) {
        if (failWith) throw failWith;
        steps.push(`release ${id}`);
        return { id, status: 'released' };
      },
    },
  };
}

test('release: nothing waiting means no Stripe call and no wait', async () => {
  const stripe = fakeStripe();
  assert.equal(await releasePendingPlanChange(stripe, { schedule: null }, stripe.sleep), null);
  assert.deepEqual(stripe.steps, []);
});

test('release: a waiting plan change is released, then the cancel waits a second, and the id comes back for the record', async () => {
  const stripe = fakeStripe();
  assert.equal(await releasePendingPlanChange(stripe, { schedule: 'sub_sched_789' }, stripe.sleep), 'sub_sched_789');
  assert.deepEqual(stripe.steps, ['release sub_sched_789', `wait ${RELEASE_SETTLE_MS}`]);
  // Stripe stamps events to the second; the cancel's must land in a later one
  // than the release's, so the webhook's ordering guard can drop a late release.
  assert.ok(RELEASE_SETTLE_MS > 1_000);
});

test('release: a Stripe failure reaches the caller, which has changed nothing yet', async () => {
  const stripe = fakeStripe(new Error('No such subscription schedule'));
  await assert.rejects(
    releasePendingPlanChange(stripe, { schedule: 'sub_sched_1' }, stripe.sleep),
    /No such subscription schedule/,
  );
  assert.deepEqual(stripe.steps, [], 'no wait after a failed release');
});

test('wiring: the Account page cancel and make set-cancellation release before they cancel', () => {
  const route = fs.readFileSync(new URL('../app/api/billing/cancel-flow/route.ts', import.meta.url), 'utf8');
  const script = fs.readFileSync(new URL('../scripts/set-cancellation.mts', import.meta.url), 'utf8');

  const routeRelease = route.indexOf('releasePendingPlanChange(stripe, live)');
  const routeCancel = route.indexOf('stripe.subscriptions.update(row.stripe_subscription_id, updateParams)');
  assert.ok(routeRelease > 0, 'the cancel route releases a waiting plan change');
  assert.ok(routeCancel > routeRelease, 'the cancel route releases it before setting the cancel');

  const scriptRelease = script.indexOf('releasePendingPlanChange(stripe, subscription)');
  const scriptCancel = script.indexOf('scheduleCancelParams({ pauseCollection: subscription.pause_collection })');
  assert.ok(scriptRelease > 0, 'set-cancellation releases a waiting plan change');
  assert.ok(scriptCancel > scriptRelease, 'set-cancellation releases it before setting the cancel');
});

test('a cancel that fails is recorded, and the member is told it did not go through and where to write', () => {
  const route = fs.readFileSync(new URL('../app/api/billing/cancel-flow/route.ts', import.meta.url), 'utf8');
  assert.match(route, /recordScheduledCancelFailure\(/);
  assert.match(route, /type: 'billing_cancel_failed'/);

  const line = cancelFlowDict.en.cancelError;
  assert.ok(line, 'the cancel window has its own cancel error');
  assert.match(line, /wasn[’']t canceled/);
  assert.match(line, /support@zerogex\.io/);
});
