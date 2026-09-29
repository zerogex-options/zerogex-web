import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIST_PRICE_USD } from '../core/billingPlans.ts';
import {
  BULLFLOW_LIST_PRICE_USD,
  BULLFLOW_PRICES_CHECKED,
  fillComparisonPrices,
  formatCheckedDate,
} from '../core/comparisonPrices.ts';
import { ARTICLE_FAQ } from '../core/articleFaq.ts';

// The ZeroGEX-vs-Bullflow page quotes both companies' prices. Ours are filled
// from the plan catalogue at render, theirs from one dated constant, and the
// page's sentences say how the two lists compare. A wrong price on a public
// comparison page is a false claim about a named competitor, so these tests
// pin all three: every token resolves, our figures are the catalogue's, and the
// comparisons the prose makes in words are still true.

const article = readFileSync(new URL('../content/articles/zerogex-vs-bullflow.md', import.meta.url), 'utf8');

test('every price token in the Bullflow comparison resolves', () => {
  const filled = fillComparisonPrices(article);
  assert.equal(filled.includes('{{'), false);
  assert.equal(filled.includes('}}'), false);
  assert.ok(filled.includes(formatCheckedDate(BULLFLOW_PRICES_CHECKED)), 'the checked date is published');
});

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

test('Bullflow figures print the way its pricing page does', () => {
  assert.equal(fillComparisonPrices('{{bullflow:basic:annual}}'), '$396');
  assert.equal(fillComparisonPrices('{{bullflow:basic:annual:mo}}'), '$33');
  assert.equal(fillComparisonPrices('{{bullflow:dataApi:annual}}'), '$1,188');
  assert.equal(fillComparisonPrices('{{bullflow:checked}}'), 'September 29, 2026');
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
    '{{price}}',
  ]) {
    assert.throws(() => fillComparisonPrices(bad), /unknown price token/, bad);
  }
});

// The article and its FAQ state these relationships in words ("the entry
// plans cost the same month to month", "ZeroGEX Pro costs less than Bullflow
// Premium", "on yearly billing, ZeroGEX costs less at both levels"). If a price
// change on either side breaks one, rewrite those sentences before shipping.
test('the price comparisons the page makes in words still hold', () => {
  assert.equal(LIST_PRICE_USD.basic.monthly, BULLFLOW_LIST_PRICE_USD.basic.monthly);
  assert.ok(LIST_PRICE_USD.pro.monthly < BULLFLOW_LIST_PRICE_USD.premium.monthly);
  assert.ok(LIST_PRICE_USD.basic.annual < BULLFLOW_LIST_PRICE_USD.basic.annual);
  assert.ok(LIST_PRICE_USD.pro.annual < BULLFLOW_LIST_PRICE_USD.premium.annual);
});

test('the FAQ quotes no dollar figures and dates its Bullflow prices', () => {
  const faq = ARTICLE_FAQ['zerogex-vs-bullflow'];
  assert.ok(faq && faq.length > 0);
  for (const { a } of faq) assert.equal(/\$\d/.test(a), false, a);
  assert.ok(faq.some(({ a }) => a.includes(formatCheckedDate(BULLFLOW_PRICES_CHECKED))));
});
