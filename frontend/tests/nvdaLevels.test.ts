import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isPublicRoute, requiredTierForRoute } from '../core/auth.ts';
import {
  LEVELS_PAGE_STOCKS,
  LEVELS_PAGE_SYMBOLS,
  MARKET_LEVELS_SYMBOLS,
  MODELED_SYMBOLS,
} from '../core/symbols.ts';
import { normalizeLevelsSymbol } from '../core/levelsSubscribers.ts';
import { DIGEST_SYMBOL_ORDER } from '../core/dailyLevelsDigest.ts';

// /nvda-gamma-levels, the first single-stock levels page. These checks pin
// the decisions behind it: it is a full public levels page, in the sitemap,
// the footer, search and the widget; it stays out of the two shared feeds
// (the daily email every subscriber gets and the MCP overview partners read);
// and it leaves out every block that would say something untrue of a stock.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
const template = read('app/spx-gamma-levels/gammaLevels.tsx');

test('the page is a force-static levels page on the shared view, with its own social card', () => {
  const page = read('app/nvda-gamma-levels/page.tsx');
  assert.match(page, /export const dynamic = 'force-static';/);
  assert.match(page, /export const revalidate = 60;/);
  assert.match(page, /return gammaMetadata\('NVDA'\);/);
  assert.match(page, /<GammaLevelsView primary="NVDA" \/>/);
  assert.match(read('app/nvda-gamma-levels/opengraph-image.tsx'), /renderGammaOgImage\('NVDA'\)/);
});

test('public, in the marketing shell, the sitemap, the footer, search and the hub', () => {
  assert.equal(isPublicRoute('/nvda-gamma-levels'), true);
  assert.equal(requiredTierForRoute('/nvda-gamma-levels'), null);
  assert.match(read('components/ClientLayout.tsx'), /'\/nvda-gamma-levels'/);
  assert.match(read('next-sitemap.config.mjs'), /const GAMMA_LEVEL_PATHS = \[[^\]]*'\/nvda-gamma-levels',/);
  assert.match(read('components/Footer.tsx'), /\{ href: '\/nvda-gamma-levels', label: 'NVDA gamma levels' \}/);
  assert.match(read('app/search/SearchClient.tsx'), /href: '\/nvda-gamma-levels'/);
  // /gex-levels links every stock page by name, from the same list.
  assert.match(read('app/gex-levels/page.tsx'), /LEVELS_PAGE_STOCKS\.map\(\(s, i\) => \(/);
  assert.match(read('content/help/platform/data-coverage.md'), /\[NVDA gamma levels\]\(\/nvda-gamma-levels\)/);
});

test('NVDA has a levels page and the widget, but not the daily email or the MCP feed', () => {
  assert.deepEqual([...LEVELS_PAGE_STOCKS], ['NVDA']);
  assert.ok((LEVELS_PAGE_SYMBOLS as readonly string[]).includes('NVDA'));
  assert.ok(!(MARKET_LEVELS_SYMBOLS as readonly string[]).includes('NVDA'));
  // Every current subscriber's email is unchanged: NVDA is not a choosable
  // lead and is not in the order every digest is laid out in.
  assert.equal(normalizeLevelsSymbol('NVDA'), 'SPX');
  assert.ok(!DIGEST_SYMBOL_ORDER.includes('NVDA'));
  assert.deepEqual([...DIGEST_SYMBOL_ORDER].sort(), [...MARKET_LEVELS_SYMBOLS].sort());
  assert.match(read('components/LevelsEmailSignup.tsx'), /MARKET_LEVELS_SYMBOLS\.map\(/);
  // The MCP tools' enum and overview read the market list.
  const tools = read('core/mcp/tools.ts');
  assert.match(tools, /const SYMBOL_ENUM = \[\.\.\.MARKET_LEVELS_SYMBOLS\];/);
  assert.ok(!/LEVELS_PAGE_SYMBOLS/.test(tools));
  // The widget builder labels it.
  assert.match(read('app/embed/EmbedBuilder.tsx'), /NVDA: 'NVDA \\u00b7 NVIDIA stock',/);
});

test('a stock page leaves out what is not true of a stock', () => {
  assert.ok(!(MODELED_SYMBOLS as readonly string[]).includes('NVDA'), 'NVDA has no forecast model');
  // No graded forecast record, no AI-assistant block, no chart blocks that name the six.
  assert.match(template, /\{hasForecast && <TrackRecordStrip history=\{trackRecord\} symbol=\{primary\} \/>\}/);
  assert.match(template, /hasForecast \? loadTrackRecord\(primary\) : Promise\.resolve\(null\)/);
  assert.match(template, /\{!isStock && <ReadInAssistant symbol=\{primary\} \/>\}/);
  assert.match(template, /\{!isStock && <PlotOnTradingView \/>\}/);
  assert.match(template, /\{!isStock && <PlotOnNinjaTrader /);
  assert.match(template, /\{!isStock && \(\s*<IntegrationsStrip/);
  // The trial pitches name the stock and drop the signal tools on a stock page.
  for (const f of ['LiveReadConversion', 'DashboardPreview', 'StickyTrialBar', 'PricingTrialCta']) {
    assert.match(read(`app/spx-gamma-levels/${f}.tsx`), /isStockSymbol\(symbol\)/, `${f} has no stock variant`);
  }
  assert.match(read('app/spx-gamma-levels/DashboardPreview.tsx'), /!f\.label\.startsWith\('Market State'\)/);
  // ...and so does the "One catch" card's pointer to the live dashboard.
  assert.match(template, /\? ' intraday flow and vanna\/charm on the '\n\s+: ' intraday flow, vanna\/charm, and the regime signals on the '/);
});

test('the NVDA answers say only what the site already establishes', () => {
  const start = template.indexOf('  NVDA: {\n    introNote:');
  assert.ok(start > 0, 'NVDA extras not found');
  const nvda = template.slice(start, template.indexOf('\n  },\n};', start));
  // The wall study's scope and figures.
  const study = read('content/articles/how-often-do-gamma-walls-break.md');
  assert.match(study, /737 wall tests across SPY, SPX, QQQ and NDX/);
  assert.match(nvda, /737 wall tests covered SPY, SPX, QQQ and NDX/);
  assert.match(study, /S&P walls held about two times in three within the hour/);
  assert.match(nvda, /S&P walls held about two times in three within an hour, and Nasdaq walls about half/);
  // No Expected Range on NVDA, as the Gamma Terminal guide says.
  assert.match(read('content/help/platform/gamma-terminal.md'), /It isn't drawn on NVDA/);
  assert.match(nvda, /Expected Range band ZeroGEX draws for the ETFs and indexes is not drawn for NVDA/);
  // The 0DTE answer never claims a same-day NVDA expiration.
  assert.match(nvda, /zeroDteAnswer:/);
  assert.ok(!/today's 0DTE contracts/.test(nvda));
  assert.ok(!/—/.test(nvda), 'house style: no em dashes in page copy');
  assert.ok(!/\b(always|guarantee[sd]?|will (hold|break))\b/i.test(nvda), 'no certainty language about walls');
});

test('the six market pages keep their own set and their full block list', () => {
  // The default set for loadSnapshots and freshness is still the six, which is
  // what /gex-levels and the six market pages read.
  assert.match(template, /export async function loadSnapshots\(symbols: readonly PageSymbol\[\] = SYMBOLS\)/);
  assert.match(template, /symbols: readonly PageSymbol\[\] = SYMBOLS,\n\): \{ cardStatus/);
  assert.match(template, /const pageSymbols: readonly PageSymbol\[\] = isStock \? \[primary, \.\.\.SYMBOLS\] : SYMBOLS;/);
  assert.ok(existsSync(path.join(ROOT, 'app/spx-gamma-levels/page.tsx')));
});
