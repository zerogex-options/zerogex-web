import test from 'node:test';
import assert from 'node:assert/strict';
import { planRegisterHref } from '../core/pricingLinks.ts';
import { safeNextPath } from '../core/safeNextPath.ts';

// The plan cards' sign-up link for logged-out visitors. What matters is where
// the visitor lands AFTER signing in: register and login both pass `next`
// through safeNextPath and then send the visitor there, so the offer flags have
// to survive that trip or checkout charges full price.

// Where register/login will send the visitor once they are signed in.
function landing(href: string): URLSearchParams {
  const next = new URL(href, 'https://zerogex.io').searchParams.get('next');
  const path = safeNextPath(next);
  assert.ok(path, `next= should be a path register/login will follow, got ${next}`);
  assert.ok(path.startsWith('/pricing?'), `should return to /pricing, got ${path}`);
  return new URL(path, 'https://zerogex.io').searchParams;
}

test('a win-back visitor comes back from sign-in with the win-back flag', () => {
  const back = landing(planRegisterHref({ tier: 'pro', cadence: 'monthly', winback: true, reactivate: false }));
  assert.equal(back.get('winback'), '1');
  assert.equal(back.get('plan'), 'pro');
  assert.equal(back.get('cadence'), 'monthly');
});

test('a reactivation visitor keeps the reactivation flag, as before', () => {
  const back = landing(planRegisterHref({ tier: 'basic', cadence: 'monthly', winback: false, reactivate: true }));
  assert.equal(back.get('reactivate'), '1');
  assert.equal(back.get('winback'), null);
});

test('a visitor with no offer gets no offer flags', () => {
  const back = landing(planRegisterHref({ tier: 'pro', cadence: 'annual', winback: false, reactivate: false }));
  assert.equal(back.get('winback'), null);
  assert.equal(back.get('reactivate'), null);
  assert.equal(back.get('trial'), '1');
  assert.equal(back.get('cadence'), 'annual');
});

test('without an offer the link is exactly what the cards produced before', () => {
  assert.equal(
    planRegisterHref({ tier: 'pro', cadence: 'monthly', winback: false, reactivate: false }),
    `/register?next=${encodeURIComponent('/pricing?trial=1&plan=pro&cadence=monthly')}`,
  );
  assert.equal(
    planRegisterHref({ tier: 'basic', cadence: 'quarterly', winback: false, reactivate: true }),
    `/register?next=${encodeURIComponent('/pricing?trial=1&plan=basic&cadence=quarterly&reactivate=1')}`,
  );
});
