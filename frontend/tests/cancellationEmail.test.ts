import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCancelReasonFollowupEmail, buildCancellationEmail } from '../core/mailer.ts';

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

  assert.equal(subject, 'Sorry to see you go - mind sharing why?');
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

// The 25% save has exactly one route: the one-click button. Carrying a manual
// "reply 'discount'" route as well read as two different deals, and a member
// who clicked the button and then replied anyway hit the shared one-shot latch
// in core/retentionOffer — the second ask cannot be honored, so it just goes
// unanswered.

test('the button is the only way the offer is ever made', () => {
  const { text, html } = buildCancellationEmail({
    periodEndIso: PERIOD_END,
    saveUrl: 'https://zerogex.io/save?t=abc',
  });

  for (const body of [text, html]) {
    assert.doesNotMatch(body, /reply with .?"?discount/i);
    assert.doesNotMatch(body, /I'?ll set it up on your account/i);
  }
  // The offer itself is still made — once, by the button.
  assert.match(text, /25% off/);
  assert.match(html, /25% off/);
});

test('with no save link there is no discount offer, manual or otherwise', () => {
  // buildSaveUrl throws when ZEROGEX_END_USER_TOKEN_SECRET is unset and the
  // webhook passes null. That is a broken deployment, not a mode to write copy
  // for — the email makes no offer it cannot honor.
  const { text, html } = buildCancellationEmail({ periodEndIso: PERIOD_END, saveUrl: null });

  for (const body of [text, html]) {
    assert.doesNotMatch(body, /discount/i);
    assert.doesNotMatch(body, /25% off/);
  }
  // What must survive the missing secret: the acknowledgment and the survey.
  assert.match(text, /full access until October 14, 2026/);
  assert.match(text, /what made you cancel/);
  assert.match(html, /what made you cancel/);
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

test('a "too complex" cancel points at My Dashboard and the Education hub', () => {
  const { text, html } = buildCancellationEmail({
    periodEndIso: PERIOD_END,
    cancellationFeedback: 'too_complex',
  });
  assert.match(text, /You said ZeroGEX felt too complex/);
  assert.match(text, /\/my-dashboard/);
  assert.match(text, /\/education/);
  assert.match(html, /href="[^"]*\/my-dashboard"/);
  assert.match(html, /href="[^"]*\/education"/);
});

test('other reasons, and no reason, carry no "too complex" paragraph', () => {
  for (const cancellationFeedback of [undefined, null, 'too_expensive', 'other']) {
    const { text, html } = buildCancellationEmail({ periodEndIso: PERIOD_END, cancellationFeedback });
    assert.doesNotMatch(text, /too complex/);
    assert.doesNotMatch(html, /too complex/);
  }
});

// A member who picked a reason has already told us why. Asking "what made you
// cancel?" anyway, with a list of reasons under it, reads as a form letter
// nobody looked at, so the open ask is only for members who skipped the survey.

test('no reason given: the subject and body ask why, with the common-reasons list', () => {
  for (const cancellationFeedback of [undefined, null, '', 'none']) {
    const { subject, text, html } = buildCancellationEmail({ periodEndIso: PERIOD_END, cancellationFeedback });
    assert.equal(subject, 'Sorry to see you go - mind sharing why?');
    assert.match(text, /what made you cancel/);
    assert.match(html, /what made you cancel/);
    assert.match(html, /<li>Just trying it out for a stretch<\/li>/);
  }
});

test('a picked reason is never asked again: no open ask, no list, no "mind sharing why?"', () => {
  for (const cancellationFeedback of [
    'too_complex',
    'too_expensive',
    'missing_features',
    'unused',
    'switched_service',
    'customer_service',
    'low_quality',
    'other',
    'some_future_stripe_value',
  ]) {
    const { subject, text, html } = buildCancellationEmail({ periodEndIso: PERIOD_END, cancellationFeedback });
    assert.equal(subject, 'Sorry to see you go', cancellationFeedback);
    for (const body of [text, html]) {
      assert.doesNotMatch(body, /what made you cancel/, cancellationFeedback);
      assert.doesNotMatch(body, /Common ones I hear/, cancellationFeedback);
      assert.doesNotMatch(body, /Whatever the reason/, cancellationFeedback);
      assert.match(body, /I read every reply/, cancellationFeedback);
    }
  }
});

test('"too complex" asks which part was too much', () => {
  const { text, html } = buildCancellationEmail({ periodEndIso: PERIOD_END, cancellationFeedback: 'too_complex' });
  assert.match(text, /which part felt like too much/);
  assert.match(html, /which part felt like too much/);
});

test('"too expensive" is not told "if it comes down to price"', () => {
  const { text, html } = buildCancellationEmail({
    periodEndIso: PERIOD_END,
    saveUrl: 'https://x/save',
    savePercent: 50,
    cancellationFeedback: 'too_expensive',
  });
  for (const body of [text, html]) {
    assert.doesNotMatch(body, /If it comes down to price/);
    assert.match(body, /You said price was the reason/);
  }
  // Every other cancel keeps the conditional framing.
  const other = buildCancellationEmail({ periodEndIso: PERIOD_END, saveUrl: 'https://x/save', cancellationFeedback: 'unused' });
  assert.match(other.text, /If it comes down to price/);
});

test('a typed comment is thanked, not followed by another question', () => {
  for (const cancellationFeedback of [null, 'too_complex', 'other']) {
    const { subject, text, html } = buildCancellationEmail({
      periodEndIso: PERIOD_END,
      cancellationFeedback,
      cancellationComment: 'Too many charts for me',
    });
    assert.equal(subject, 'Sorry to see you go');
    for (const body of [text, html]) {
      assert.match(body, /Thank you for telling me why in your own words/);
      assert.doesNotMatch(body, /what made you cancel/);
      assert.doesNotMatch(body, /which part felt like too much/);
    }
  }
  // Whitespace is not a comment.
  const blank = buildCancellationEmail({ periodEndIso: PERIOD_END, cancellationComment: '   ' });
  assert.match(blank.text, /what made you cancel/);
});

// "You've been a real part of what I've been building" is for paying members.
// Said to someone who tried it for a few days and never paid, it reads as a
// form letter.

test('a trial cancel says the trial is canceled and nothing will be charged', () => {
  const { text, html } = buildCancellationEmail({ periodEndIso: PERIOD_END, trialing: true });
  for (const body of [text, html]) {
    assert.match(body, /canceled your ZeroGEX trial/);
    assert.match(body, /won(&#39;|')t be charged anything/);
    assert.doesNotMatch(body, /real part of what/);
    assert.doesNotMatch(body, /canceled your ZeroGEX subscription/);
  }
});

test('a paid cancel keeps the "real part" thanks', () => {
  for (const trialing of [undefined, false]) {
    const { text, html } = buildCancellationEmail({ periodEndIso: PERIOD_END, trialing });
    assert.match(text, /canceled your ZeroGEX subscription/);
    assert.match(text, /real part of what/);
    assert.match(html, /real part of what/);
  }
});

test('a trial that is already converting is never told "you won\'t be charged"', () => {
  const { text, html } = buildCancellationEmail({
    periodEndIso: PERIOD_END,
    trialing: true,
    conversionChargePending: true,
  });
  for (const body of [text, html]) {
    assert.doesNotMatch(body, /won(&#39;|')t be charged/);
    assert.match(body, /That is your final charge/);
  }
});

test('the save box states the percent of the link it carries', () => {
  const fifty = buildCancellationEmail({ periodEndIso: PERIOD_END, saveUrl: 'https://x/save', savePercent: 50 });
  assert.match(fifty.text, /claim 50% off/);
  assert.match(fifty.html, /claim 50% off/);
  assert.doesNotMatch(fifty.html, /25% off/);
  const def = buildCancellationEmail({ periodEndIso: PERIOD_END, saveUrl: 'https://x/save' });
  assert.match(def.html, /claim 25% off/);
});

// A cancel after the payment had already failed (past_due / unpaid). The cancel
// ends the plan on the spot and voids the open bill (core/pastDueCancel.ts), so
// the ordinary copy is wrong three ways: "full access until …" (the 3-day
// payment-grace cutoff has usually taken access already), the save offer (there
// is no live subscription left to keep), and, for a trial whose first charge was
// declined, the thanks for being "a real part" of the business. Members got all
// three on 2026-10-16 and 2026-11-08.

const VOIDED_TRIAL = { neverPaid: true, billVoided: true };
const VOIDED_RENEWAL = { neverPaid: false, billVoided: true };

// What no failed-payment cancel may say, whatever else it says.
function assertNoAccessOrSaveClaims(body: string) {
  assert.doesNotMatch(body, /full access until/);
  assert.doesNotMatch(body, /nothing changes yet on your end/);
  assert.doesNotMatch(body, /October 14, 2026/);
  assert.doesNotMatch(body, /25% off|50% off|claim \d+% off/);
  assert.doesNotMatch(body, /zerogex\.io\/save/);
  assert.doesNotMatch(body, /final charge/);
}

test('past_due trial conversion, bill voided: trial opening, no charge, no access claim', () => {
  const { text, html } = buildCancellationEmail({
    periodEndIso: PERIOD_END,
    // The caller passes no save link, but the copy must not offer one even if it did.
    saveUrl: 'https://zerogex.io/save?t=abc',
    paymentFailed: VOIDED_TRIAL,
  });
  for (const body of [text, html]) {
    assert.match(body, /canceled your ZeroGEX trial/);
    assert.doesNotMatch(body, /real part of what/);
    assert.doesNotMatch(body, /canceled your ZeroGEX subscription/);
    assert.match(body, /The payment due when your trial ended didn(&#39;|')t go through/);
    assert.match(body, /your plan ended when you canceled/);
    assert.match(body, /canceled that unpaid bill/);
    assert.match(body, /You won(&#39;|')t be charged anything/);
    assert.match(body, /payment won(&#39;|')t be tried again/);
    assertNoAccessOrSaveClaims(body);
  }
});

test('past_due trial conversion, bill NOT voided: no promise about charges', () => {
  const { text, html } = buildCancellationEmail({
    periodEndIso: PERIOD_END,
    paymentFailed: { neverPaid: true, billVoided: false },
  });
  for (const body of [text, html]) {
    assert.match(body, /canceled your ZeroGEX trial/);
    assert.doesNotMatch(body, /real part of what/);
    assert.match(body, /your plan ended when you canceled/);
    // The bill may still be open, so nothing says it can't be charged.
    assert.doesNotMatch(body, /won(&#39;|')t be charged/);
    assert.doesNotMatch(body, /Nothing more will be charged/);
    assert.doesNotMatch(body, /canceled that unpaid bill/);
    assertNoAccessOrSaveClaims(body);
  }
});

test('past_due renewal, bill voided: thanks a paying member, says nothing more will be charged', () => {
  const { text, html } = buildCancellationEmail({
    periodEndIso: PERIOD_END,
    saveUrl: 'https://zerogex.io/save?t=abc',
    paymentFailed: VOIDED_RENEWAL,
  });
  for (const body of [text, html]) {
    assert.match(body, /canceled your ZeroGEX subscription/);
    assert.match(body, /real part of what/);
    assert.doesNotMatch(body, /canceled your ZeroGEX trial/);
    assert.match(body, /Your last payment didn(&#39;|')t go through/);
    assert.match(body, /your plan ended when you canceled instead of running to the end of the billing period/);
    assert.match(body, /canceled that unpaid bill/);
    assert.match(body, /Nothing more will be charged/);
    assert.match(body, /payment won(&#39;|')t be tried again/);
    assertNoAccessOrSaveClaims(body);
  }
});

test('past_due renewal, bill NOT voided: says the plan ended, promises nothing about charges', () => {
  const { text, html } = buildCancellationEmail({
    periodEndIso: PERIOD_END,
    paymentFailed: { neverPaid: false, billVoided: false },
  });
  for (const body of [text, html]) {
    assert.match(body, /real part of what/);
    assert.match(body, /your plan ended when you canceled/);
    assert.doesNotMatch(body, /Nothing more will be charged/);
    assert.doesNotMatch(body, /canceled that unpaid bill/);
    assertNoAccessOrSaveClaims(body);
  }
});

test('a failed payment overrides the trialing and charge-in-flight copy', () => {
  // Neither flag can be set alongside a failed payment by the callers, but the
  // failed-payment copy must win if they ever are.
  const { text } = buildCancellationEmail({
    periodEndIso: PERIOD_END,
    trialing: true,
    conversionChargePending: true,
    paymentFailed: VOIDED_RENEWAL,
  });
  assert.match(text, /real part of what/);
  assert.doesNotMatch(text, /trial had already ended/);
  assertNoAccessOrSaveClaims(text);
});

test('a failed-payment cancel still answers the reason it was given', () => {
  const { subject, text } = buildCancellationEmail({
    periodEndIso: null,
    cancellationFeedback: 'too_expensive',
    paymentFailed: VOIDED_TRIAL,
  });
  assert.equal(subject, 'Sorry to see you go');
  assert.match(text, /what would ZeroGEX need to cost/);
  // No "You said price was the reason" save box: there is nothing left to save.
  assert.doesNotMatch(text, /You said price was the reason/);
  assertNoAccessOrSaveClaims(text);
});

// The one-off cancel-reason follow-up (scripts/send-cancel-reason-followup.mts).
const UNSUB = 'https://zerogex.io/unsubscribe?u=x&t=y';

test('follow-up, too expensive + still active: the 50% save link and the access date', () => {
  const save = 'https://zerogex.io/save?u=x&t=y&o=price';
  const { subject, text, html } = buildCancelReasonFollowupEmail({
    reason: 'too_expensive',
    state: 'pending',
    periodEndIso: PERIOD_END,
    offerUrl: save,
    unsubUrl: UNSUB,
  });
  assert.equal(subject, 'Half price, if that helps');
  assert.match(text, /50% off for the next 12 months/);
  assert.match(text, /October 14, 2026/);
  assert.ok(text.includes(save));
  assert.ok(html.includes('href="https://zerogex.io/save?u=x&amp;t=y&amp;o=price"'));
  assert.ok(html.includes(UNSUB.replace(/&/g, '&amp;')));
});

test('follow-up, too expensive + ended: the win-back checkout link', () => {
  const { text, html } = buildCancelReasonFollowupEmail({
    reason: 'too_expensive',
    state: 'lapsed',
    periodEndIso: null,
    offerUrl: 'https://zerogex.io/pricing?winback=1',
    unsubUrl: UNSUB,
  });
  assert.match(text, /50% off for your first 12 months/);
  assert.ok(html.includes('https://zerogex.io/pricing?winback=1'));
  assert.doesNotMatch(text, /cancellation stands/);
});

test('follow-up, too complex: My Dashboard and the Education hub, keep-plan or pricing by state', () => {
  const pending = buildCancelReasonFollowupEmail({
    reason: 'too_complex',
    state: 'pending',
    periodEndIso: PERIOD_END,
    offerUrl: null,
    unsubUrl: UNSUB,
  });
  assert.equal(pending.subject, 'ZeroGEX can be a lot simpler');
  assert.match(pending.html, /\/my-dashboard"/);
  assert.match(pending.html, /\/education"/);
  assert.match(pending.text, /Keep my plan/);
  assert.doesNotMatch(pending.text, /50%/);

  const lapsed = buildCancelReasonFollowupEmail({
    reason: 'too_complex',
    state: 'lapsed',
    periodEndIso: null,
    offerUrl: null,
    unsubUrl: UNSUB,
  });
  assert.match(lapsed.html, /\/pricing"/);
  assert.doesNotMatch(lapsed.text, /Keep my plan/);
});
