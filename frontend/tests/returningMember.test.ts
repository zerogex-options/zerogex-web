import test from 'node:test';
import assert from 'node:assert/strict';
import { pricingHrefFor, resolveWall, type WallInput } from '../core/returningMember.ts';

// The wall's one job is to not lie about what checkout will do next. Everything
// below is a guard on that: /api/billing/checkout suppresses the trial for
// anyone who has paid before, so any path that lets the page say "7-day free
// trial" to such a visitor is the bug this module was written to kill.

function wall(over: Partial<WallInput> = {}): WallInput {
  return {
    sessionTier: 'public',
    requiredTier: 'basic',
    hasPriorPaid: false,
    foundingMember: false,
    ...over,
  };
}

test('a former customer is never promised a trial', () => {
  for (const required of ['basic', 'pro']) {
    const decision = resolveWall(wall({ hasPriorPaid: true, requiredTier: required }));
    assert.equal(decision.audience, 'returning');
    assert.equal(decision.promiseTrial, false, `required=${required} must not promise a trial`);
  }
});

test('a never-paid member keeps the trial screen', () => {
  const decision = resolveWall(wall({ hasPriorPaid: false }));
  assert.equal(decision.audience, 'newcomer');
  assert.equal(decision.promiseTrial, true);
});

test('an unresolved session promises nothing', () => {
  // hasPriorPaid === null means we could not read a session. Laying out the
  // newcomer screen is fine; making its promise is not, because we cannot rule
  // out that this is a returning member.
  const decision = resolveWall(wall({ sessionTier: null, hasPriorPaid: null }));
  assert.equal(decision.audience, 'newcomer');
  assert.equal(decision.promiseTrial, false);
});

test('the session tier wins over a forged ?current=', () => {
  // The querystring is visitor-controlled. A Basic member cannot talk the page
  // into the subscribe wall, and — the case that matters — a returning member
  // cannot be talked back into the trial promise.
  const decision = resolveWall(wall({ sessionTier: 'basic', requiredTier: 'pro', hasPriorPaid: true }));
  assert.equal(decision.audience, 'upgrade');
  assert.equal(decision.promiseTrial, false);
});

test('a Basic member reaching for Pro gets the upgrade screen', () => {
  const decision = resolveWall(wall({ sessionTier: 'basic', requiredTier: 'pro', hasPriorPaid: false }));
  assert.equal(decision.audience, 'upgrade');
});

test('an entitled member on an odd route is denied, not sold to', () => {
  for (const tier of ['pro', 'admin']) {
    const decision = resolveWall(wall({ sessionTier: tier, requiredTier: 'basic' }));
    assert.equal(decision.audience, 'denied', `tier ${tier} should not see a subscribe wall`);
  }
});

test('the founding-restore note is shown only to a returning founder', () => {
  assert.equal(
    resolveWall(wall({ hasPriorPaid: true, foundingMember: true })).showFoundingRestore,
    true,
  );
  // A founding-flagged account that has never paid has not redeemed anything to
  // restore, and a founder who still has access is not resubscribing.
  assert.equal(
    resolveWall(wall({ hasPriorPaid: false, foundingMember: true })).showFoundingRestore,
    false,
  );
  assert.equal(
    resolveWall(wall({ sessionTier: 'basic', requiredTier: 'pro', foundingMember: true }))
      .showFoundingRestore,
    false,
  );
});

test('a missing ?required= defaults to the Basic wall, not to denial', () => {
  const decision = resolveWall(wall({ requiredTier: null, hasPriorPaid: true }));
  assert.equal(decision.audience, 'returning');
});

test('pricing links carry trial=1 only when a trial is genuinely on offer', () => {
  const newcomer = resolveWall(wall({ hasPriorPaid: false }));
  assert.equal(pricingHrefFor(newcomer, 'basic'), '/pricing?trial=1&plan=basic');

  const returning = resolveWall(wall({ hasPriorPaid: true }));
  assert.equal(pricingHrefFor(returning, 'pro'), '/pricing?plan=pro');
  assert.equal(pricingHrefFor(returning), '/pricing');
});

test('pricing links never carry winback=1', () => {
  // A member who walked back on their own converts without being paid to. The
  // discount stays unspent for a later touch; see core/returnIntent.ts.
  const returning = resolveWall(wall({ hasPriorPaid: true }));
  for (const plan of [undefined, 'basic', 'pro'] as const) {
    assert.ok(!pricingHrefFor(returning, plan).includes('winback'));
  }
});
