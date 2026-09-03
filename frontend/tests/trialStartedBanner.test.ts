import test from 'node:test';
import assert from 'node:assert/strict';

// The post-checkout dashboard banner used to greet every new member with
// "Welcome — your 7-day free trial is now active. No charge until day 7." in
// all five languages. Checkout does not always grant that:
//
//   - a cold signup returning through the reactivation email's ?reactivate=1
//     link gets REACTIVATION_TRIAL_DAYS (default 30), so the banner named a
//     charge date three weeks early;
//   - a founding member gets an absolute trial_end, which has a date but no
//     length;
//   - a returning ex-subscriber gets no trial at all and is charged at
//     checkout, so "no charge until day 7" was simply false.
//
// This covers the param → copy decision and holds every locale to taking its
// day count from {days} rather than baking one in.

import { resolveTrialStartedCopy } from '../app/dashboard/trialStartedCopy.ts';
import { dict } from '../app/dashboard/TrialStartedBanner.i18n.ts';

test('a day-count trial names the length checkout actually granted', () => {
  assert.deepEqual(resolveTrialStartedCopy('7'), { variant: 'days', days: 7 });
  assert.deepEqual(resolveTrialStartedCopy('30'), { variant: 'days', days: 30 });
  // REACTIVATION_TRIAL_DAYS is operator-tunable and clamped to 90.
  assert.deepEqual(resolveTrialStartedCopy('90'), { variant: 'days', days: 90 });
});

test('the founding deferral gets trial copy with no day count', () => {
  assert.deepEqual(resolveTrialStartedCopy('deferred'), { variant: 'deferred' });
});

test('a checkout that granted no trial never promises a charge-free window', () => {
  assert.deepEqual(resolveTrialStartedCopy('none'), { variant: 'none' });
});

test('an unreadable descriptor falls back to length-free trial copy', () => {
  // '' is the live case: a Stripe session created before ?trial= shipped can
  // still redirect here for up to a day. The rest are junk a hand-edited URL
  // could supply — none of them may put a number in front of the member.
  for (const param of ['', null, 'yes', '7d', '0', '-1', '366', '7.5', 'NaN', 'Infinity']) {
    assert.deepEqual(
      resolveTrialStartedCopy(param),
      { variant: 'deferred' },
      `param ${JSON.stringify(param)} must not name a day count`,
    );
  }
});

const LOCALES = Object.keys(dict) as Array<keyof typeof dict>;
const KEYS = [
  'welcomeDays',
  'billingDays',
  'welcomeDeferred',
  'billingDeferred',
  'welcomeNone',
  'billingNone',
  'dismiss',
];

test('every locale carries every key — no silent English fallback mid-banner', () => {
  assert.ok(LOCALES.length >= 5, 'expected the five shipped locales');
  for (const locale of LOCALES) {
    for (const key of KEYS) {
      assert.ok(dict[locale]?.[key], `${String(locale)} is missing ${key}`);
    }
  }
});

test('no locale hardcodes a trial length', () => {
  for (const locale of LOCALES) {
    const table = dict[locale];
    assert.ok(table);
    // The two `Days` strings must interpolate rather than state a number...
    for (const key of ['welcomeDays', 'billingDays']) {
      const value = table[key] as string;
      assert.match(value, /\{days\}/, `${String(locale)}.${key} must interpolate {days}`);
      assert.doesNotMatch(
        value.replaceAll('{days}', ''),
        /\d/,
        `${String(locale)}.${key} still bakes in a number`,
      );
    }
    // ...and the length-free variants must not name one at all, since they
    // render precisely when the length is unknown or does not exist.
    for (const key of ['welcomeDeferred', 'billingDeferred', 'welcomeNone', 'billingNone']) {
      assert.doesNotMatch(
        table[key] as string,
        /\d/,
        `${String(locale)}.${key} must not name a day count`,
      );
    }
  }
});

test('the no-trial copy never says the member will not be charged', () => {
  // The one claim that made the old banner actively false for a resubscriber
  // whose card was charged at checkout. Checked per language against the
  // "no charge" phrasing each of them uses in the trial variants.
  const NO_CHARGE_PHRASES: Record<string, RegExp> = {
    en: /no charge/i,
    it: /nessun addebito/i,
    de: /keine abbuchung/i,
    es: /sin cargo/i,
    fr: /aucun débit/i,
  };
  for (const locale of LOCALES) {
    const phrase = NO_CHARGE_PHRASES[String(locale)];
    assert.ok(phrase, `no "no charge" phrasing registered for ${String(locale)}`);
    // Sanity-check the phrase actually matches this locale's trial copy, so a
    // translation reword can't quietly turn the assertion below into a no-op.
    assert.match(
      dict[locale]?.billingDeferred as string,
      phrase,
      `${String(locale)}.billingDeferred should carry the "no charge" promise`,
    );
    for (const key of ['welcomeNone', 'billingNone']) {
      assert.doesNotMatch(
        dict[locale]?.[key] as string,
        phrase,
        `${String(locale)}.${key} promises no charge to a member who was just charged`,
      );
    }
  }
});
