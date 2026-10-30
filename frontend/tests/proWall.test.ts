import test from 'node:test';
import assert from 'node:assert/strict';
import { NAV_GROUPS } from '../core/navigation.ts';
import { BLOG_IMAGE_DIMENSIONS } from '../core/blogImageManifest.ts';
import { PRO_PAGE_PITCHES, proPagePitch, proWallCopy, proWallTerms } from '../core/proWall.ts';

// The screen a Basic member gets on a Pro page (app/unauthorized, audience
// 'upgrade'). It is the moment they are most curious about Pro, so it has to
// say what the page does and exactly what switching would mean for them today.

const HOUR = 3_600_000;
const NOW = Date.parse('2026-11-02T15:00:00Z');
const basicMonthly = { tier: 'basic', cadence: 'monthly' } as const;

function terms(over: Partial<Parameters<typeof proWallTerms>[0]> = {}) {
  return proWallTerms({
    status: 'trialing',
    current: basicMonthly,
    periodEndIso: new Date(NOW + 120 * HOUR).toISOString(),
    guaranteeUsed: false,
    nowMs: NOW,
    ...over,
  });
}

test('every Pro page in the menu has its own pitch', () => {
  const proIds: string[] = [];
  for (const group of NAV_GROUPS) {
    for (const item of group.items ?? []) if (item.requiredTier === 'pro') proIds.push(item.id);
    for (const sg of group.subgroups ?? []) {
      if (sg.id && sg.requiredTier === 'pro') proIds.push(sg.id);
      for (const item of sg.items) if (item.requiredTier === 'pro') proIds.push(item.id);
    }
  }
  assert.ok(proIds.length >= 14, `found ${proIds.length} Pro pages`);
  for (const id of proIds) assert.ok(PRO_PAGE_PITCHES[id], `${id} has no pitch`);
});

test('a screenshot is only named when the site serves it', () => {
  for (const [id, pitch] of Object.entries(PRO_PAGE_PITCHES)) {
    if (pitch.image) assert.ok(BLOG_IMAGE_DIMENSIONS[pitch.image.src], `${id}: ${pitch.image.src} is not in assets/blog`);
  }
});

test('an unknown path gets the general Pro pitch rather than nothing', () => {
  assert.match(proPagePitch('/not-a-page').pitch, /Pro adds Trade Bias/);
  assert.match(proPagePitch(undefined).pitch, /Pro adds Trade Bias/);
});

test("in the trial's last two days, the screen offers to keep the free days", () => {
  const t = terms({ periodEndIso: new Date(NOW + 30 * HOUR).toISOString() });
  assert.equal(t.kind, 'keep_trial');
  const copy = proWallCopy(t);
  assert.equal(copy.priceLine, 'Pro is $59 a month, $20 more than Basic.');
  assert.match(copy.termsLine, /Switch now and the rest of it stays free/);
  assert.match(copy.termsLine, /Pro's \$59 instead of Basic's \$39/);
  assert.match(copy.termsLine, /you can still cancel any time before then/);
  assert.doesNotMatch(copy.termsLine, /guarantee/);
  assert.equal(copy.cta.label, 'Switch to Pro');
  assert.match(copy.cta.href, /^\/pricing\?.*switch=pro.*from=locked_page/);
});

test('earlier in the trial it says switching charges today, and when the free option opens', () => {
  const t = terms();
  assert.equal(t.kind, 'trial_early');
  if (t.kind !== 'trial_early') return;
  assert.equal(Date.parse(t.opensAtIso), NOW + (120 - 51) * HOUR);
  const copy = proWallCopy(t);
  assert.match(copy.termsLine, /Switching now ends your free trial and starts Pro at \$59 today, covered by the 7-day money-back guarantee/);
  assert.match(copy.termsLine, /in the last two days of your trial, you can switch and keep those days free/);
  assert.match(copy.annual?.line ?? '', /Pro annual is \$299, about \$24\.92 a month/);
  // No guarantee promised to someone who has used their one refund.
  assert.doesNotMatch(proWallCopy(terms({ guaranteeUsed: true })).termsLine, /guarantee/);
});

test('paying, past-due and plan-less members each get terms that are true for them', () => {
  const paid = proWallCopy(terms({ status: 'active' }));
  assert.match(paid.termsLine, /Stripe shows you the exact amount before anything changes/);
  assert.doesNotMatch(paid.termsLine, /guarantee|trial/);

  const pastDue = proWallCopy(terms({ status: 'past_due' }));
  assert.equal(pastDue.cta.href, '/account');
  assert.equal(pastDue.annual, null);

  assert.equal(terms({ status: null }).kind, 'none');
  // A reactivation trial on Basic annual starts paying today when it moves.
  assert.equal(terms({ current: { tier: 'basic', cadence: 'annual' } }).kind, 'trial_other');
});
