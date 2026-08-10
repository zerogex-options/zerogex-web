import test from 'node:test';
import assert from 'node:assert/strict';
import { decidePlanSwitch, type PlanSwitchInput } from '../core/planSwitch.ts';

// decidePlanSwitch is the gate that lets a trialing member self-serve the
// advertised promo upgrade (the "unable to upgrade to Pro" ticket) instead of
// being dumped in the generic billing portal. Lock the matrix down: it must
// perform an in-app upgrade ONLY for a trialing, same-cadence basic→pro move, and
// fall back to the portal for everything else (paid members, downgrades, cadence
// changes) so it never removes a path that works today.

function input(over: Partial<PlanSwitchInput> = {}): PlanSwitchInput {
  return {
    currentTier: 'basic',
    currentCadence: 'monthly',
    targetTier: 'pro',
    targetCadence: 'monthly',
    status: 'trialing',
    ...over,
  };
}

test('trialing basic → pro at the same cadence is an in-app upgrade', () => {
  assert.deepEqual(decidePlanSwitch(input()), { kind: 'in_app_upgrade' });
});

test('trialing basic → pro also upgrades in-app on the annual cadence (same cadence both sides)', () => {
  const d = decidePlanSwitch(
    input({ currentCadence: 'annual', targetCadence: 'annual' }),
  );
  assert.deepEqual(d, { kind: 'in_app_upgrade' });
});

test('an ACTIVE (paid) member upgrading goes to the portal for proration', () => {
  assert.deepEqual(decidePlanSwitch(input({ status: 'active' })), { kind: 'portal' });
});

test('a past_due member goes to the portal, never an in-app upgrade', () => {
  assert.deepEqual(decidePlanSwitch(input({ status: 'past_due' })), { kind: 'portal' });
});

test('a downgrade (pro → basic) always routes to the portal', () => {
  const d = decidePlanSwitch(
    input({ currentTier: 'pro', targetTier: 'basic', status: 'trialing' }),
  );
  assert.deepEqual(d, { kind: 'portal' });
});

test('a cadence change during trial routes to the portal, even when the tier also upgrades', () => {
  // monthly basic → annual pro: tier upgrade AND cadence change. The coupon shape
  // and trial economics differ across cadences, so the portal handles it.
  const d = decidePlanSwitch(
    input({ currentCadence: 'monthly', targetCadence: 'annual' }),
  );
  assert.deepEqual(d, { kind: 'portal' });
});

test('a pure cadence swap (basic monthly → basic annual) during trial routes to the portal', () => {
  const d = decidePlanSwitch(
    input({ targetTier: 'basic', currentCadence: 'monthly', targetCadence: 'annual' }),
  );
  assert.deepEqual(d, { kind: 'portal' });
});

test('same plan on both sides is a no-op', () => {
  const d = decidePlanSwitch(
    input({ targetTier: 'basic', currentTier: 'basic', currentCadence: 'monthly', targetCadence: 'monthly' }),
  );
  assert.deepEqual(d, { kind: 'noop' });
});

test('an unresolvable current price (null tier) never upgrades in-app — falls back to the portal', () => {
  const d = decidePlanSwitch(
    input({ currentTier: null, currentCadence: null }),
  );
  assert.deepEqual(d, { kind: 'portal' });
});

test('a trialing pro member re-selecting pro at a different cadence is not a no-op (goes to portal)', () => {
  const d = decidePlanSwitch(
    input({ currentTier: 'pro', targetTier: 'pro', currentCadence: 'monthly', targetCadence: 'annual' }),
  );
  assert.deepEqual(d, { kind: 'portal' });
});
