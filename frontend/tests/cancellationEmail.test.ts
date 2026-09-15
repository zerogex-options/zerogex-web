import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCancellationEmail } from '../core/mailer.ts';

// The cancellation acknowledgment fires the instant Stripe flips
// cancel_at_period_end 0→1. Its default copy reassures the member that
// "nothing changes yet on your end" — which is true when they cancel during
// their trial, and FALSE when they cancel in the hour between trial end and
// Stripe finalizing the draft cycle invoice, because a charge lands on them
// within the hour.
//
// That second case is a real member (see docs/disputes/): cancel acknowledged
// 10:33, $59 charged 11:04, conversion receipt 11:04. The charge itself stands
// — the trial ran its full term. The contradiction is what has to go.

const PERIOD_END = new Date(Date.UTC(2026, 9, 14, 10, 3, 14)).toISOString();

test('the ordinary cancel keeps its reassuring copy', () => {
  const { subject, text, html } = buildCancellationEmail({ periodEndIso: PERIOD_END });

  assert.equal(subject, 'Sorry to see you go — mind sharing why?');
  assert.match(text, /nothing changes yet on your end/);
  assert.match(html, /nothing changes yet on your end/);
  assert.match(text, /full access until October 14, 2026/);
  // No charge is in flight, so the email must not invent one.
  assert.doesNotMatch(text, /final charge/);
  assert.doesNotMatch(html, /final charge/);
});

test('a conversion charge in flight is disclosed instead of "nothing changes yet"', () => {
  const { text, html } = buildCancellationEmail({
    periodEndIso: PERIOD_END,
    conversionChargePending: true,
  });

  // The false sentence is gone from BOTH bodies.
  assert.doesNotMatch(text, /nothing changes yet on your end/);
  assert.doesNotMatch(html, /nothing changes yet on your end/);

  // Replaced by the truth, stated before anything else.
  assert.match(text, /trial had already ended when you canceled/);
  assert.match(html, /trial had already ended when you canceled/);
  assert.match(text, /already in motion and will go through shortly/);

  // And bounded — they need to know it is the LAST one, or they assume a
  // recurring charge and reach for their bank instead of the reply button.
  assert.match(text, /That is your final charge/);
  assert.match(html, /That is your final charge/);
  assert.match(text, /nothing renews after it/);
  assert.match(html, /nothing renews after it/);

  // Access still runs to period end either way.
  assert.match(text, /full access until October 14, 2026/);
  assert.match(html, /October 14, 2026/);
});

test('the save offer still rides along on a charge-pending cancel', () => {
  // They just paid for the period; 25%/yr is still the right save attempt, and
  // suppressing it here would quietly cost the one retention shot we get.
  const { text, html } = buildCancellationEmail({
    periodEndIso: PERIOD_END,
    saveUrl: 'https://zerogex.io/save?t=abc',
    conversionChargePending: true,
  });

  assert.match(text, /https:\/\/zerogex\.io\/save\?t=abc/);
  assert.match(html, /href="https:\/\/zerogex\.io\/save\?t=abc"/);
  assert.match(text, /25% off/);
});

test('a missing period end degrades to neutral wording, never a guessed date', () => {
  const { text } = buildCancellationEmail({
    periodEndIso: null,
    conversionChargePending: true,
  });

  assert.match(text, /the end of your current billing period/);
  assert.match(text, /That is your final charge/);
  assert.doesNotMatch(text, /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/);
});

test('dynamic values are HTML-escaped, never interpolated raw', () => {
  const { html } = buildCancellationEmail({
    periodEndIso: PERIOD_END,
    saveUrl: 'https://zerogex.io/save?t=a"><script>alert(1)</script>',
  });

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
