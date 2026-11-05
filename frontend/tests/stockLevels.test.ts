import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isPublicRoute, requiredTierForRoute } from '../core/auth.ts';
import {
  LEVELS_PAGE_STOCKS,
  MODELED_SYMBOLS,
  STOCK_LISTING,
  STOCK_SYMBOLS,
  SYMBOL_DESCRIPTIONS,
} from '../core/symbols.ts';

// Every stock with a free /<ticker>-gamma-levels page, held to the same rules
// as NVDA's (tests/nvdaLevels.test.ts pins NVDA's own wording). The rest of the
// MAG 7 join LEVELS_PAGE_STOCKS one at a time, each once its backend data is
// live (zerogex-oa docs/runbooks/mag7_rollout.md), and this is what makes each
// addition complete: the page, its card, every hand-kept list it must be on,
// and copy that says nothing untrue of a stock.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
const template = read('app/spx-gamma-levels/gammaLevels.tsx');

for (const stock of LEVELS_PAGE_STOCKS) {
  const route = `/${stock.toLowerCase()}-gamma-levels`;
  const dir = `app${route}`;

  test(`${stock}: a force-static page on the shared view, with its own social card`, () => {
    assert.ok(existsSync(path.join(ROOT, dir, 'page.tsx')), `${dir}/page.tsx`);
    const page = read(`${dir}/page.tsx`);
    assert.match(page, /export const dynamic = 'force-static';/);
    assert.match(page, /export const revalidate = 60;/);
    assert.match(page, new RegExp(`return gammaMetadata\\('${stock}'\\);`));
    assert.match(page, new RegExp(`<GammaLevelsView primary="${stock}" />`));
    assert.match(read(`${dir}/opengraph-image.tsx`), new RegExp(`renderGammaOgImage\\('${stock}'\\)`));
  });

  test(`${stock}: a stock in the picker, with a name and a listing`, () => {
    assert.ok((STOCK_SYMBOLS as readonly string[]).includes(stock), 'a page only for a stock the picker offers');
    assert.ok(SYMBOL_DESCRIPTIONS[stock], 'its company name, which the page copy uses');
    assert.ok(STOCK_LISTING[stock], 'its listing, which picks its benchmark ETF');
    assert.ok(!(MODELED_SYMBOLS as readonly string[]).includes(stock), 'no forecast or signal model on a stock');
  });

  test(`${stock}: public, in the marketing shell, the sitemap, the footer, search, the widget and the coverage page`, () => {
    assert.equal(isPublicRoute(route), true);
    assert.equal(requiredTierForRoute(route), null);
    assert.match(read('components/ClientLayout.tsx'), new RegExp(`'${route}'`));
    assert.match(read('next-sitemap.config.mjs'), new RegExp(`const GAMMA_LEVEL_PATHS = \\[[^\\]]*'${route}',`));
    assert.match(read('components/Footer.tsx'), new RegExp(`\\{ href: '${route}', label: '${stock} gamma levels' \\}`));
    assert.match(read('app/search/SearchClient.tsx'), new RegExp(`href: '${route}'`));
    assert.match(
      read('app/embed/EmbedBuilder.tsx'),
      new RegExp(`${stock}: '${stock} \\\\u00b7 ${SYMBOL_DESCRIPTIONS[stock]} stock',`),
    );
    assert.match(
      read('content/help/platform/data-coverage.md'),
      new RegExp(`- \\*\\*${stock}\\*\\* - ${SYMBOL_DESCRIPTIONS[stock]}: \\[${stock} gamma levels\\]\\(${route}\\)`),
    );
  });
}

test('every stock page has its own copy, and no market page gains any', () => {
  // Written-out copy for QQQ and NVDA; stockExtras for every other stock page.
  assert.match(template, /for \(const stock of LEVELS_PAGE_STOCKS\) \{\n  SYMBOL_EXTRAS\[stock\] \?\?= stockExtras\(stock\);\n\}/);
  // Audience, chain and page content come from the stock list, not a hand edit.
  assert.match(template, /\.\.\.perStock\(\(s\) => `\$\{SYMBOL_DESCRIPTIONS\[s\]\} \(\$\{s\}\) options traders`\),/);
  assert.match(template, /\.\.\.perStock\(\(s\) => s\),/);
  assert.match(template, /\.\.\.perStock\(buildSymbolContent\),/);
  // NVDA's audience reads exactly as it did when it was written out.
  assert.equal(`${SYMBOL_DESCRIPTIONS.NVDA} (NVDA) options traders`, 'NVIDIA (NVDA) options traders');
});

test("the generated stock answers say only what the site already establishes", () => {
  const start = template.indexOf('function stockExtras(');
  assert.ok(start > 0, 'stockExtras not found');
  const copy = template.slice(start, template.indexOf('\n}\n', start));
  // The wall study's scope and figures.
  const study = read('content/articles/how-often-do-gamma-walls-break.md');
  assert.match(study, /737 wall tests across SPY, SPX, QQQ and NDX/);
  assert.match(copy, /737 wall tests covered SPY, SPX, QQQ and NDX/);
  assert.match(study, /S&P walls held about two times in three within the hour/);
  assert.match(copy, /S&P walls held about two times in three within an hour, and Nasdaq walls about half/);
  // No Expected Range on a stock, for the reason the guide gives.
  assert.match(read('content/help/platform/gamma-terminal.md'), /It isn't drawn on a single stock: the band is projected from VIX or VXN/);
  assert.match(read('core/symbols.ts'), /export function volIndexPricesSymbol[\s\S]*?return !isStockSymbol/);
  assert.match(copy, /is not drawn for \$\{symbol\}, because it is projected from VIX and VXN/);
  // The 0DTE answer never claims a same-day expiration, and no claim is about
  // one stock's volatility, which differs from stock to stock.
  assert.match(copy, /zeroDteAnswer:/);
  assert.ok(!/today's 0DTE contracts/.test(copy));
  assert.ok(!/volatility usually runs/.test(copy));
  assert.ok(!/—/.test(copy), 'house style: no em dashes in page copy');
  assert.ok(!/\b(always|guarantee[sd]?|will (hold|break))\b/i.test(copy), 'no certainty language about walls');
  // No "a"/"an" before a ticker: the right article depends on how it is read.
  assert.ok(!/\b(a|an) \$\{symbol\}/.test(copy));
});
