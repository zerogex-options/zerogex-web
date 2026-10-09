import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIST_PRICE_USD } from '../core/billingPlans.ts';
import {
  COMPETITOR_PRICES,
  competitorCheckedLabel,
  fillComparisonPrices,
  type CompetitorId,
  type CompetitorPlanPrice,
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
  ['menthorq', 'zerogex-vs-menthorq'],
  ['tradegex', 'zerogex-vs-tradegex'],
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
  assert.equal(fillComparisonPrices('{{quantdata:platform:monthly}}'), '$74.99');
  assert.equal(fillComparisonPrices('{{quantdata:platform:annual}}'), '$750');
  assert.equal(fillComparisonPrices('{{quantdata:platform:annual:mo}}'), '$62.50');
  assert.equal(fillComparisonPrices('{{quantdata:api:monthly}}'), '$149.99');
  assert.equal(fillComparisonPrices('{{quantdata:api:annual}}'), '$1,499.99');
  // Quant Data shows $1,499.99 a year as $124.99 a month; the page matches it
  // rather than printing $125.00.
  assert.equal(fillComparisonPrices('{{quantdata:api:annual:mo}}'), '$124.99');
  assert.equal(fillComparisonPrices('{{quantdata:checked}}'), 'September 30, 2026');
  assert.equal(fillComparisonPrices('{{menthorq:premium:monthly}}'), '$129');
  assert.equal(fillComparisonPrices('{{menthorq:premium:firstMonth}}'), '$39');
  assert.equal(fillComparisonPrices('{{menthorq:premium:annual}}'), '$1,164');
  assert.equal(fillComparisonPrices('{{menthorq:premium:annual:mo}}'), '$97');
  assert.equal(fillComparisonPrices('{{menthorq:pro:monthly}}'), '$349');
  assert.equal(fillComparisonPrices('{{menthorq:pro:firstMonth}}'), '$174.50');
  assert.equal(fillComparisonPrices('{{menthorq:pro:annual}}'), '$3,108');
  assert.equal(fillComparisonPrices('{{menthorq:pro:annual:mo}}'), '$259');
  assert.equal(fillComparisonPrices('{{menthorq:checked}}'), 'September 30, 2026');
  assert.equal(fillComparisonPrices('{{tradegex:platform:monthly}}'), '$59.99');
  assert.equal(fillComparisonPrices('{{tradegex:platform:sixMonths}}'), '$299');
  assert.equal(fillComparisonPrices('{{tradegex:platform:annual}}'), '$599');
  // TradeGEX prints no per-month figure for its yearly plan, so the page
  // derives one and says "about".
  assert.equal(fillComparisonPrices('{{tradegex:platform:annual:mo}}'), '$49.92');
  assert.equal(fillComparisonPrices('{{tradegex:checked}}'), 'October 9, 2026');
});

// A plan that records both a yearly total and a per-month figure has to agree
// with itself to the cent, so an edit to one cannot leave the other stale.
test('a yearly total and its per-month figure agree', () => {
  for (const [id, entry] of Object.entries(COMPETITOR_PRICES)) {
    for (const [plan, price] of Object.entries(entry.plans) as Array<[string, CompetitorPlanPrice]>) {
      if (price.annual === undefined || price.annualPerMonth === undefined) continue;
      assert.ok(Math.abs(price.annual / 12 - price.annualPerMonth) < 0.01, `${id} ${plan}`);
    }
  }
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
    // Quant Data does not show its Professional plan's price.
    '{{quantdata:professional:monthly}}',
    // A first-month price exists only where a vendor lists one, is already
    // monthly, and has no ZeroGEX counterpart.
    '{{bullflow:basic:firstMonth}}',
    '{{menthorq:premium:firstMonth:mo}}',
    '{{zgx:basic:firstMonth}}',
    // So is a six-month plan: it is already one charge for its period.
    '{{bullflow:basic:sixMonths}}',
    '{{tradegex:platform:sixMonths:mo}}',
    '{{zgx:pro:sixMonths}}',
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

  // "Both ZeroGEX plans cost less than Quant Data's platform plan, monthly or
  // yearly"
  const quantdata = COMPETITOR_PRICES.quantdata.plans.platform;
  for (const tier of ['basic', 'pro'] as const) {
    assert.ok(LIST_PRICE_USD[tier].monthly < quantdata.monthly, `${tier} monthly`);
    assert.ok(LIST_PRICE_USD[tier].annual < quantdata.annual, `${tier} yearly`);
  }

  // "ZeroGEX Pro includes the API access that Quant Data sells as a separate
  // plan", and costs less than that plan on its own
  const quantdataApi = COMPETITOR_PRICES.quantdata.plans.api;
  assert.ok(LIST_PRICE_USD.pro.monthly < quantdataApi.monthly);
  assert.ok(LIST_PRICE_USD.pro.annual < quantdataApi.annual);

  // "Both ZeroGEX plans cost less than either MenthorQ plan, monthly or yearly"
  const menthorq = COMPETITOR_PRICES.menthorq.plans;
  for (const tier of ['basic', 'pro'] as const) {
    for (const plan of [menthorq.premium, menthorq.pro]) {
      assert.ok(LIST_PRICE_USD[tier].monthly < plan.monthly, `${tier} monthly`);
      assert.ok(LIST_PRICE_USD[tier].annual < plan.annual, `${tier} yearly`);
    }
  }
  // "MenthorQ's discounted first month of Premium costs the same as a regular
  // month of ZeroGEX Basic"
  assert.equal(menthorq.premium.firstMonth, LIST_PRICE_USD.basic.monthly);

  // "Month to month, ZeroGEX Basic costs less than TradeGEX, and ZeroGEX Pro
  // costs about the same"
  const tradegex = COMPETITOR_PRICES.tradegex.plans.platform;
  assert.ok(LIST_PRICE_USD.basic.monthly < tradegex.monthly);
  assert.ok(Math.abs(LIST_PRICE_USD.pro.monthly - tradegex.monthly) <= 1);
  // "On yearly billing, ZeroGEX Pro costs about half as much as TradeGEX - the
  // same as TradeGEX's six-month plan"
  assert.ok(Math.abs(LIST_PRICE_USD.pro.annual - tradegex.annual / 2) < 1);
  assert.equal(LIST_PRICE_USD.pro.annual, tradegex.sixMonths);
});
