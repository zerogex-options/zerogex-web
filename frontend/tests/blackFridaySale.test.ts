import test from 'node:test';
import assert from 'node:assert/strict';

// The Black Friday 2026 sale (core/blackFridaySale.ts): what it costs on each
// plan, when it is open, who checkout sells it to, and the page copy that
// states it. The prices are what the pricing page shows and the setup script
// checks the Stripe coupon against, so they are pinned here rather than
// trusted to stay in step by eye.

import {
  BLACK_FRIDAY_SALE,
  SALE_REFUSAL_MESSAGE,
  decideSaleCheckout,
  formatSaleDeadline,
  isSaleWindowOpen,
  parseSaleWindow,
  salePayments,
  salePerMonthUsd,
  salePriceUsd,
  type SaleCheckoutInput,
} from '../core/blackFridaySale.ts';
import { BILLABLE_TIERS, BILLING_CADENCES, LIST_PRICE_USD, formatUsd } from '../core/billingPlans.ts';
import { LOCALES } from '../core/i18n/locales.ts';
import { dict } from '../app/pricing/Client.i18n.ts';

const START = '2026-11-27T05:00:00Z'; // 12:00 AM ET, Friday, November 27
const END = '2026-12-02T04:59:59Z'; // 11:59:59 PM ET, Tuesday, December 1

test('the offer is half off the first year', () => {
  assert.deepEqual(BLACK_FRIDAY_SALE, { percentOff: 50, months: 12 });
});

test('every plan comes out at an exact sale price, shown to the cent', () => {
  const expected = {
    basic: { monthly: 19.5, quarterly: 37.5, annual: 99.5 },
    pro: { monthly: 29.5, quarterly: 57.5, annual: 149.5 },
  };
  for (const tier of BILLABLE_TIERS) {
    for (const cadence of BILLING_CADENCES) {
      assert.equal(salePriceUsd({ tier, cadence }), expected[tier][cadence], `${tier} ${cadence}`);
    }
  }
  // The page formats with formatUsd, never the whole-dollar formatBilledUsd,
  // which would show $19.50 as $20.
  assert.equal(formatUsd(salePriceUsd({ tier: 'basic', cadence: 'monthly' })), '$19.50');
  assert.equal(formatUsd(salePriceUsd({ tier: 'pro', cadence: 'annual' })), '$149.50');
});

test('the sale price is the list price less the advertised share, on every plan', () => {
  for (const tier of BILLABLE_TIERS) {
    for (const cadence of BILLING_CADENCES) {
      const list = LIST_PRICE_USD[tier][cadence];
      const sale = salePriceUsd({ tier, cadence });
      assert.equal(Math.round((1 - sale / list) * 100), BLACK_FRIDAY_SALE.percentOff, `${tier} ${cadence}`);
    }
  }
});

test('monthly equivalents and payments covered', () => {
  assert.equal(salePerMonthUsd({ tier: 'basic', cadence: 'monthly' }), 19.5);
  assert.equal(salePerMonthUsd({ tier: 'basic', cadence: 'quarterly' }), 12.5);
  assert.equal(salePerMonthUsd({ tier: 'basic', cadence: 'annual' }), 8.29);
  assert.equal(salePerMonthUsd({ tier: 'pro', cadence: 'quarterly' }), 19.17);
  assert.equal(salePerMonthUsd({ tier: 'pro', cadence: 'annual' }), 12.46);
  // 12 months of payments: twelve monthly, four quarterly, one annual.
  assert.equal(salePayments({ tier: 'basic', cadence: 'monthly' }), 12);
  assert.equal(salePayments({ tier: 'pro', cadence: 'quarterly' }), 4);
  assert.equal(salePayments({ tier: 'pro', cadence: 'annual' }), 1);
});

test('the window: start inclusive, end exclusive', () => {
  const window = parseSaleWindow(START, END);
  assert.ok(window);
  const start = Date.parse(START);
  const end = Date.parse(END);
  assert.equal(isSaleWindowOpen(window, start - 1), false);
  assert.equal(isSaleWindowOpen(window, start), true);
  assert.equal(isSaleWindowOpen(window, end - 1), true);
  assert.equal(isSaleWindowOpen(window, end), false);
});

test('no start means open from now until the end', () => {
  const window = parseSaleWindow('', END);
  assert.deepEqual(window, { startMs: null, endMs: Date.parse(END) });
  assert.equal(isSaleWindowOpen(window, Date.parse('2026-11-18T12:00:00Z')), true);
  assert.equal(isSaleWindowOpen(window, Date.parse(END)), false);
});

test('a missing or garbled window closes the sale rather than opening it', () => {
  assert.equal(parseSaleWindow(START, undefined), null);
  assert.equal(parseSaleWindow(START, ''), null);
  assert.equal(parseSaleWindow(START, 'December 1st'), null);
  assert.equal(parseSaleWindow('soon', END), null);
  assert.equal(parseSaleWindow(END, START), null);
  assert.equal(parseSaleWindow(END, END), null);
  assert.equal(isSaleWindowOpen(null, Date.parse('2026-11-28T12:00:00Z')), false);
});

test('the page names the last day of the sale in New York time, in every language', () => {
  const end = Date.parse(END);
  assert.equal(formatSaleDeadline(end), 'Tuesday, December 1');
  // An end set at exactly midnight still names the day the sale closes.
  assert.equal(formatSaleDeadline(Date.parse('2026-12-02T05:00:00Z')), 'Tuesday, December 1');
  assert.equal(formatSaleDeadline(end, 'it'), 'martedì 1 dicembre');
  assert.equal(formatSaleDeadline(end, 'de'), 'Dienstag, 1. Dezember');
  assert.equal(formatSaleDeadline(end, 'es'), 'martes, 1 de diciembre');
  assert.equal(formatSaleDeadline(end, 'fr'), 'mardi 1 décembre');
});

// --- who checkout sells it to -----------------------------------------------

function decide(overrides: Partial<SaleCheckoutInput>) {
  return decideSaleCheckout({
    saleOpen: true,
    firstTime: true,
    trialOtherwise: false,
    saleRequested: false,
    ...overrides,
  });
}

test('a first-time member buying a plan that is paid today gets the sale, asked for or not', () => {
  assert.deepEqual(decide({ saleRequested: true }), { kind: 'sale' });
  // Not asked for (a checkout started anywhere but the pricing page): still the
  // sale, so nobody is charged more than the page advertises.
  assert.deepEqual(decide({ saleRequested: false }), { kind: 'sale' });
});

test('the sale never comes with a free trial', () => {
  // Basic monthly, or a reactivation invitee: the trial stays, at the regular
  // price, unless the member picks the sale.
  assert.deepEqual(decide({ trialOtherwise: true }), { kind: 'none' });
  // Picking the sale takes it, paid today (checkout drops the trial).
  assert.deepEqual(decide({ trialOtherwise: true, saleRequested: true }), { kind: 'sale' });
});

test('returning members and closed windows never get it', () => {
  assert.deepEqual(decide({ firstTime: false }), { kind: 'none' });
  assert.deepEqual(decide({ saleOpen: false }), { kind: 'none' });
  assert.deepEqual(decide({ saleOpen: false, trialOtherwise: true }), { kind: 'none' });
});

test('asking for a sale that is not available is refused, not charged at another price', () => {
  assert.deepEqual(decide({ saleRequested: true, saleOpen: false }), { kind: 'refuse', reason: 'closed' });
  assert.deepEqual(decide({ saleRequested: true, firstTime: false }), { kind: 'refuse', reason: 'not_first_time' });
  // Closed wins: there is no point telling a returning member about eligibility
  // for a sale that is over.
  assert.deepEqual(decide({ saleRequested: true, saleOpen: false, firstTime: false }), {
    kind: 'refuse',
    reason: 'closed',
  });
  for (const message of Object.values(SALE_REFUSAL_MESSAGE)) {
    assert.match(message, /Black Friday/);
    assert.match(message, /Refresh the page/);
  }
});

// --- the page copy ------------------------------------------------------------

const SALE_KEYS = [
  'saleBannerLabel',
  'saleBannerHeadline',
  'saleBannerTerms',
  'salePriceNoteMonthly',
  'salePriceNoteQuarterly',
  'salePriceNoteAnnual',
  'saleCtaLabel',
  'saleTrialInstead',
  'saleHighlight',
  'heroTrialSubtitleSale',
  'salePolicyLabel',
  'salePolicyBody',
];

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

test('every sale string is in every language, with the same placeholders', () => {
  for (const key of SALE_KEYS) {
    const english = dict.en[key];
    assert.ok(english, `en is missing ${key}`);
    for (const locale of LOCALES) {
      const text = dict[locale]?.[key];
      assert.ok(text, `${locale} is missing ${key}`);
      assert.deepEqual(placeholders(text), placeholders(english), `${locale}.${key} placeholders`);
    }
  }
});

test('the copy states the terms checkout enforces', () => {
  // Paid today, never with the trial, covered by the guarantee, first year only.
  assert.match(dict.en.saleBannerTerms, /pay today/);
  assert.match(dict.en.salePolicyBody, /money-back guarantee, Basic monthly included/);
  assert.match(dict.en.salePolicyBody, /can’t be combined with a free trial or any other discount/);
  assert.match(dict.en.salePolicyBody, /renews at the regular price/);
  assert.match(dict.en.salePriceNoteMonthly, /12 monthly payments/);
  assert.match(dict.en.salePriceNoteQuarterly, /4 quarterly payments/);
});
