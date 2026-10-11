import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BILLABLE_TIERS, BILLING_CADENCES, CADENCE_MONTHS, LIST_PRICE_USD } from '../core/billingPlans.ts';
import { pricingJsonLd, pricingOffers } from '../core/pricingJsonLd.ts';

// /pricing's structured data quotes a price per plan. The failure that would
// go unnoticed is that price drifting from the card beside it: Google would
// show a number the checkout does not charge. So every Offer is checked
// against the catalogue the cards render from, and the two Pro integration
// landings are checked to quote the same constant rather than a copy.

const SITE = 'https://example.test';
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('every offer quotes the list price of its plan', () => {
  const offers = pricingOffers(SITE, BILLING_CADENCES);
  assert.equal(offers.length, BILLABLE_TIERS.length * BILLING_CADENCES.length);
  for (const tier of BILLABLE_TIERS) {
    for (const cadence of BILLING_CADENCES) {
      const offer = offers.find((o) => o['@id'] === `${SITE}/pricing#${tier}-${cadence}`);
      assert.ok(offer, `${tier} ${cadence} offer missing`);
      assert.equal(offer.price, String(LIST_PRICE_USD[tier][cadence]));
      assert.equal(offer.priceSpecification.price, offer.price);
      assert.equal(offer.priceSpecification.billingDuration.value, CADENCE_MONTHS[cadence]);
      assert.equal(offer.url, `${SITE}/pricing?plan=${tier}`);
    }
  }
});

test('only the cadences on sale are offered', () => {
  const offers = pricingOffers(SITE, ['monthly', 'annual']);
  assert.equal(offers.length, 4);
  assert.ok(offers.every((o) => !o['@id'].endsWith('-quarterly')));
});

test('the application node carries the offers and the shared publisher reference', () => {
  const publisher = { '@id': `${SITE}/#organization` };
  const ld = pricingJsonLd({ siteUrl: SITE, publisher, cadences: ['monthly'] });
  assert.equal(ld['@type'], 'SoftwareApplication');
  assert.equal(ld['@id'], `${SITE}/#app`);
  assert.deepEqual(ld.publisher, publisher);
  assert.equal(ld.offers.length, BILLABLE_TIERS.length);
});

test('the pricing page and the Pro integration landings read the same constant', () => {
  assert.match(read('../app/pricing/page.tsx'), /pricingJsonLd\(/);
  for (const page of ['../app/ninjatrader-indicator/page.tsx', '../app/sierra-chart-indicator/page.tsx']) {
    const source = read(page);
    assert.match(source, /price: String\(LIST_PRICE_USD\.pro\.monthly\)/, `${page} should quote Pro monthly from billingPlans`);
    assert.ok(source.includes('/pricing#pro-monthly'), `${page} should point at the /pricing Offer node`);
  }
});
