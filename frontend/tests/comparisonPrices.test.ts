import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIST_PRICE_USD } from '../core/billingPlans.ts';
import {
  COMPETITOR_PRICES,
  competitorCheckedLabel,
  fillComparisonPrices,
  type CompetitorId,
} from '../core/comparisonPrices.ts';
import { ARTICLE_FAQ } from '../core/articleFaq.ts';

// The ZeroGEX-vs-competitor pages quote both sides' prices. Ours are filled
// from the plan catalogue at render, the competitor's from one dated constant,
// and the pages' sentences say how the two lists compare. A wrong price on a
// public comparison page is a false claim about a named competitor, so these
// tests pin all three: every token resolves, our figures are the catalogue's,
// and the comparisons the prose makes in words are still true.

const PAGES: Array<[CompetitorId, string]> = [
  ['bullflow', 'zerogex-vs-bullflow'],
  ['quantdata', 'zerogex-vs-quant-data'],
];

const readArticle = (slug: string) =>
  readFileSync(new URL(`../content/articles/${slug}.md`, import.meta.url), 'utf8');

for (const [competitor, slug] of PAGES) {
  test(`${slug}: every price token resolves and the check date is published`, () => {
    const filled = fillComparisonPrices(readArticle(slug));
    assert.equal(filled.includes('{{'), false);
    assert.equal(filled.includes('}}'), false);
    assert.ok(filled.includes(competitorCheckedLabel(competitor)));
  });

  test(`${slug}: the FAQ quotes no dollar figures and dates the competitor's prices`, () => {
    const faq = ARTICLE_FAQ[slug];
    assert.ok(faq && faq.length > 0);
    for (const { a } of faq) assert.equal(/\$\d/.test(a), false, a);
    assert.ok(faq.some(({ a }) => a.includes(competitorCheckedLabel(competitor))));
  });
}

test('ZeroGEX figures come from the plan catalogue', () => {
  assert.equal(fillComparisonPrices('{{zgx:basic:monthly}}'), `$${LIST_PRICE_USD.basic.monthly}`);
  assert.equal(fillComparisonPrices('{{zgx:pro:monthly}}'), `$${LIST_PRICE_USD.pro.monthly}`);
  assert.equal(fillComparisonPrices('{{zgx:basic:annual}}'), `$${LIST_PRICE_USD.basic.annual}`);
  assert.equal(fillComparisonPrices('{{zgx:pro:annual}}'), `$${LIST_PRICE_USD.pro.annual}`);
  assert.equal(
    fillComparisonPrices('{{zgx:basic:annual:mo}}'),
    `$${(LIST_PRICE_USD.basic.annual / 12).toFixed(2)}`,
  );
});

test('competitor figures print the way their sources quote them', () => {
  assert.equal(fillComparisonPrices('{{bullflow:basic:annual}}'), '$396');
  assert.equal(fillComparisonPrices('{{bullflow:basic:annual:mo}}'), '$33');
  assert.equal(fillComparisonPrices('{{bullflow:dataApi:annual}}'), '$1,188');
  assert.equal(fillComparisonPrices('{{bullflow:checked}}'), 'September 29, 2026');
  assert.equal(fillComparisonPrices('{{quantdata:api:monthly}}'), '$149.99');
  assert.equal(fillComparisonPrices('{{quantdata:api:annual:mo}}'), '$124.99');
  assert.equal(fillComparisonPrices('{{quantdata:checked}}'), 'September 30, 2026');
});

test('a malformed or unknown token throws instead of printing braces', () => {
  for (const bad of [
    '{{zgx:gold:monthly}}',
    '{{zgx:basic:weekly}}',
    '{{zgx:basic:quarterly}}',
    '{{zgx:basic}}',
    '{{zgx:basic:annual:yr}}',
    '{{bullflow:elite:monthly}}',
    '{{bullflow:checked:today}}',
    '{{bullflow:toString:monthly}}',
    '{{toString:checked}}',
    '{{price}}',
    // Quant Data's help center quotes the yearly API plan per month only, so
    // there is no yearly total to print, and its platform plan is not recorded.
    '{{quantdata:api:annual}}',
    '{{quantdata:platform:monthly}}',
  ]) {
    assert.throws(() => fillComparisonPrices(bad), /unknown price token/, bad);
  }
});

// The pages and FAQs state these relationships in words. If a price change on
// either side breaks one, rewrite those sentences before shipping.
test('the price comparisons the pages make in words still hold', () => {
  const bullflow = COMPETITOR_PRICES.bullflow.plans;
  // "the entry plans cost the same month to month"
  assert.equal(LIST_PRICE_USD.basic.monthly, bullflow.basic.monthly);
  // "ZeroGEX Pro costs less than Bullflow Premium"
  assert.ok(LIST_PRICE_USD.pro.monthly < bullflow.premium.monthly);
  // "on yearly billing, ZeroGEX costs less at both levels"
  assert.ok(LIST_PRICE_USD.basic.annual < bullflow.basic.annual);
  assert.ok(LIST_PRICE_USD.pro.annual < bullflow.premium.annual);

  // "API access comes with ZeroGEX Pro, which costs less per month than the
  // Quant Data API plan on monthly or yearly billing"
  const quantdataApi = COMPETITOR_PRICES.quantdata.plans.api;
  assert.ok(LIST_PRICE_USD.pro.monthly < quantdataApi.monthly);
  assert.ok(LIST_PRICE_USD.pro.annual / 12 < quantdataApi.annualPerMonth);
});
