import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrialValueEmail } from '../core/mailer.ts';
import { AUTH_TIERS, requiredTierForRoute } from '../core/auth.ts';

// The day-two nudge goes to every trialer, and the only plan with a free trial
// is Basic monthly, so most readers are on Basic. Its third step used to send
// them to Trade Bias, a Pro-only page a Basic trialer finds locked. Every page
// it links has to be one Basic can open, checked against the real route rules
// rather than a hand-kept list. (Not via hasRequiredTier: it answers true for
// everything unless NEXT_PUBLIC_AUTH_ENABLED is set, so it can't fail here.)

const rank = (id: string) => AUTH_TIERS.find((t) => t.id === id)?.rank ?? Infinity;

const email = buildTrialValueEmail({
  trialEndIso: '2026-10-04T20:00:00Z',
  unsubUrl: 'https://zerogex.test/unsubscribe?u=user_x&t=token',
});

test('every page the email links is open to a Basic trialer', () => {
  const paths = [...email.html.matchAll(/href="([^"]+)"/g)]
    .map((m) => new URL(m[1].replace(/&amp;/g, '&'), 'https://zerogex.test').pathname)
    .filter((p) => p !== '/unsubscribe');
  assert.ok(paths.length >= 4, `expected the step links, got ${paths.join(', ')}`);
  for (const path of paths) {
    const required = requiredTierForRoute(path) ?? 'public';
    assert.ok(rank(required) <= rank('basic'), `${path} needs ${required}, not open to Basic`);
  }
});

test('the third step is Smart Money, not Trade Bias', () => {
  for (const body of [email.text, email.html]) {
    assert.match(body, /Smart Money/);
    assert.doesNotMatch(body, /Trade Bias/);
  }
  assert.match(email.html, /href="[^"]*\/smart-money"/);
});
