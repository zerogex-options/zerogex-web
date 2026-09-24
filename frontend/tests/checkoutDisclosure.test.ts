import test from 'node:test';
import assert from 'node:assert/strict';

// The terms line Stripe Checkout prints above the Subscribe button
// (core/checkoutDisclosure.ts). It is the last thing a customer reads before
// the charge is authorized, so the guarantee's one-refund limit and the
// automatic renewal have to be in it, in every language the site ships.

import { checkoutSubmitMessage, STRIPE_CUSTOM_TEXT_MAX } from '../core/checkoutDisclosure.ts';
import { LOCALES } from '../core/i18n/locales.ts';
import { BILLING_CADENCES } from '../core/billingPlans.ts';

const ONE_REFUND: Record<string, RegExp> = {
  en: /one refund per customer/i,
  it: /un rimborso per cliente/i,
  de: /eine erstattung pro kunde/i,
  es: /un reembolso por cliente/i,
  fr: /un remboursement par client/i,
};

const RENEWS: Record<string, RegExp> = {
  en: /renews automatically/i,
  it: /si rinnova automaticamente/i,
  de: /verlängert sich (dein Plan )?automatisch/i,
  es: /se renueva automáticamente/i,
  fr: /se renouvelle automatiquement/i,
};

test('every variant fits Stripe\'s limit and names the automatic renewal', () => {
  for (const locale of LOCALES) {
    for (const cadence of BILLING_CADENCES) {
      for (const protection of [
        { kind: 'trial' as const, days: 30 },
        { kind: 'money_back' as const, days: 7 },
        { kind: 'none' as const },
      ]) {
        const message = checkoutSubmitMessage({ locale, cadence, protection });
        assert.ok(message.length > 0);
        assert.ok(message.length <= STRIPE_CUSTOM_TEXT_MAX, `${locale}/${cadence}/${protection.kind} too long`);
        assert.match(message, RENEWS[locale], `${locale}/${cadence}/${protection.kind} omits the renewal`);
      }
    }
  }
});

test('the guarantee states its window and the one-refund limit before payment', () => {
  for (const locale of LOCALES) {
    const message = checkoutSubmitMessage({
      locale,
      cadence: 'annual',
      protection: { kind: 'money_back', days: 7 },
    });
    assert.match(message, /7/, `${locale} omits the window`);
    assert.match(message, ONE_REFUND[locale], `${locale} omits the one-refund limit`);
  }
});

test('the trial line names the length actually granted', () => {
  const message = checkoutSubmitMessage({
    locale: 'en',
    cadence: 'monthly',
    protection: { kind: 'trial', days: 30 },
  });
  assert.match(message, /Free for 30 days/);
  assert.match(message, /every month/);
  assert.doesNotMatch(message, /refund/i);
});

test('the renewal period matches the cadence being bought', () => {
  const at = (cadence: 'monthly' | 'quarterly' | 'annual') =>
    checkoutSubmitMessage({ locale: 'en', cadence, protection: { kind: 'none' } });
  assert.match(at('monthly'), /every month/);
  assert.match(at('quarterly'), /every 3 months/);
  assert.match(at('annual'), /every year/);
});

test('amounts are never restated (Stripe shows the charged figures itself)', () => {
  for (const locale of LOCALES) {
    for (const cadence of BILLING_CADENCES) {
      const message = checkoutSubmitMessage({ locale, cadence, protection: { kind: 'money_back', days: 7 } });
      assert.doesNotMatch(message, /\$/, `${locale}/${cadence} quotes a price`);
    }
  }
});
