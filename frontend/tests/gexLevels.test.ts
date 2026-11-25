import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isPublicRoute, requiredTierForRoute } from '../core/auth.ts';
import { buildReportModel, type GexSummaryInput } from '../app/live-bulletin/bulletinHelpers.ts';
import { REGIME_DISPLAY, noFlipNearSpot, regimeDisplayFor } from '../app/spx-gamma-levels/regimeDisplay.ts';
import { longGammaAtSpot, netGexAtSpotOrNull } from '../core/gammaRegime.ts';
import { keyLevelsRegime } from '../core/keyLevels.ts';

// /gex-levels is the broad "gex levels / gex data / gex charts" landing above
// the six ticker pages. These checks pin what makes it work as one: crawlable
// in the first HTML, public, listed, on the same data path as the ticker pages
// (so the two never disagree), and with every link pointing somewhere real.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
const page = read('app/gex-levels/page.tsx');
const decode = (raw: string) => raw.replace(/\\u00a0/g, ' ');

test('server-rendered and refreshed like the ticker pages', () => {
  assert.ok(!/^'use client'/m.test(page), 'the page itself must be a server component');
  assert.match(page, /export const dynamic = 'force-static';/);
  assert.match(page, /export const revalidate = 60;/);
});

test('reads the same snapshot, freshness rules and cache as the ticker pages', () => {
  assert.match(page, /loadSnapshots\(\)/);
  assert.match(page, /snapshotFreshness\(snapshots, fromCache\)/);
  assert.ok(!/serverApiGet/.test(page), 'no second data path: reuse loadSnapshots');
  const levels = read('app/spx-gamma-levels/gammaLevels.tsx');
  assert.match(levels, /export async function loadSnapshots/);
  assert.match(levels, /export function snapshotFreshness/);
});

test('metadata: self-canonical, and a title and description that fit a result', () => {
  assert.match(page, /alternates: \{ canonical: PATH \}/);
  assert.match(page, /const PATH = '\/gex-levels';/);
  const title = decode(/const TITLE = '([^']+)';/.exec(page)?.[1] ?? '');
  const description = /const DESCRIPTION =\s*'([^']+)';/.exec(page)?.[1] ?? '';
  assert.ok(title.length > 0 && title.length <= 62, `title is ${title.length} chars`);
  assert.ok(description.length >= 120 && description.length <= 160, `description is ${description.length} chars`);
  assert.ok(!/—/.test(page), 'house style: no em dashes');
});

test('public, in the marketing shell, and in the sitemap', () => {
  assert.equal(isPublicRoute('/gex-levels'), true);
  assert.equal(requiredTierForRoute('/gex-levels'), null);
  assert.match(read('components/ClientLayout.tsx'), /'\/gex-levels'/);
  assert.match(read('next-sitemap.config.mjs'), /const LEVELS_HUB_PATHS = \['\/gex-levels'\];/);
});

test('the FAQ markup is built from the visible FAQ', () => {
  assert.match(page, /mainEntity: FAQ\.map\(/);
  assert.match(page, /\{FAQ\.map\(\(f\) => \(/);
});

test('every link on the page resolves', () => {
  const hrefs = new Set([...page.matchAll(/href(?:=|: )["'](\/[^"'#?]*)["']/g)].map((m) => m[1]));
  assert.ok(hrefs.size >= 25, `expected the page's links to parse, found ${hrefs.size}`);
  for (const href of hrefs) {
    const article = /^\/education\/([a-z0-9-]+)$/.exec(href);
    const help = /^\/help\/platform\/([a-z0-9-]+)$/.exec(href);
    const ok = article
      ? existsSync(path.join(ROOT, 'content/articles', `${article[1]}.md`))
      : help
        ? existsSync(path.join(ROOT, 'content/help/platform', `${help[1]}.md`))
        : existsSync(path.join(ROOT, 'app', href === '/' ? '' : href, 'page.tsx'));
    assert.ok(ok, `${href} does not resolve to a page`);
  }
});

test('the hub is linked from the pages that should send readers to it', () => {
  for (const file of [
    'components/Footer.tsx',
    'components/LiveLevelsCTA.tsx',
    'app/spx-gamma-levels/gammaLevels.tsx',
    'app/education/page.tsx',
    'app/LandingClient.tsx',
    'app/chart/ChartClient.tsx',
  ]) {
    assert.match(read(file), /href(?:=|: )["']\/gex-levels["']/, `${file} should link /gex-levels`);
  }
});

// ── The regime badge when no flip sits near spot ────────────────────────────
// On 2026-11-25 five of the six panels read "Gamma flip unresolved" with net
// GEX at spot clearly negative, while the chart's Key Levels chip said SHORT Γ.
// With no flip the badge is the sign of net GEX at spot: the same regime Today's
// Read and the chip show. "Unresolved" is left for a snapshot with neither.

// The NDX snapshot from that morning. The whole-chain total has the OPPOSITE
// sign on purpose: it must never decide the badge.
const NDX_NO_FLIP: GexSummaryInput = {
  symbol: 'NDX',
  spot_price: 20750,
  gamma_flip: null,
  net_gex_at_spot: -1.03e9,
  net_gex: 2.1e9,
  call_wall: 21500,
  put_wall: 20500,
};

// What the other two surfaces on the same page say for the same snapshot.
const todaysRead = (d: GexSummaryInput) =>
  buildReportModel({ symbol: 'NDX', spot: d.spot_price ?? null, priorClose: null, summary: d, vix: null, volIndex: 'VXN', horizon: 'daily' });
const keyLevelsChip = (d: GexSummaryInput) =>
  keyLevelsRegime(longGammaAtSpot(netGexAtSpotOrNull(d.net_gex_at_spot), d.spot_price ?? null, d.gamma_flip ?? null));

test('no flip + negative net GEX at spot: negative gamma on the card, Today\'s Read and the chip', () => {
  const display = regimeDisplayFor(NDX_NO_FLIP);
  assert.equal(display.label, 'Negative gamma (amplified vol)');
  assert.match(display.body, /net short gamma at spot, and no gamma flip sits near spot/);
  assert.doesNotMatch(display.body, /provisional|unresolved/i);
  assert.equal(display.label, REGIME_DISPLAY[todaysRead(NDX_NO_FLIP).regime].label);
  assert.equal(keyLevelsChip(NDX_NO_FLIP)?.long, false);
  assert.equal(noFlipNearSpot(NDX_NO_FLIP), true);
});

test('no flip + positive net GEX at spot: positive gamma on the card, Today\'s Read and the chip', () => {
  const d = { ...NDX_NO_FLIP, net_gex_at_spot: 1.32e9 };
  const display = regimeDisplayFor(d);
  assert.equal(display.label, 'Positive gamma (suppressed vol)');
  assert.match(display.body, /net long gamma at spot, and no gamma flip sits near spot/);
  assert.doesNotMatch(display.body, /provisional|unresolved/i);
  assert.equal(display.label, REGIME_DISPLAY[todaysRead(d).regime].label);
  assert.equal(keyLevelsChip(d)?.long, true);
  assert.equal(noFlipNearSpot(d), true);
});

test('no flip + no net GEX at spot: the only snapshot that reads unresolved', () => {
  const d = { ...NDX_NO_FLIP, net_gex_at_spot: null };
  const display = regimeDisplayFor(d);
  assert.equal(display.label, 'Gamma regime unresolved');
  assert.match(display.body, /provisional/);
  assert.equal(todaysRead(d).regime, 'unresolved');
  assert.equal(keyLevelsChip(d), null);
  assert.equal(noFlipNearSpot(d), false);
});

test('a served numeric string at spot reads the same on the card and in Today\'s Read', () => {
  const d = { ...NDX_NO_FLIP, net_gex_at_spot: '-1030000000' as unknown as number };
  assert.equal(regimeDisplayFor(d).label, 'Negative gamma (amplified vol)');
  assert.equal(todaysRead(d).regime, 'negative');
});

test('with a flip the card is unchanged: spot against the flip, no no-flip wording', () => {
  const d = { ...NDX_NO_FLIP, gamma_flip: 20600 };
  assert.deepEqual(regimeDisplayFor(d), REGIME_DISPLAY.positive);
  assert.equal(noFlipNearSpot(d), false);
});

test('the ticker card and the /gex-levels panel both read the regime through regimeDisplayFor', () => {
  const levels = read('app/spx-gamma-levels/gammaLevels.tsx');
  for (const [name, src] of [['gammaLevels.tsx', levels], ['gex-levels/page.tsx', page]]) {
    assert.match(src, /const regime = regimeDisplayFor\(data\);/, name);
    assert.doesNotMatch(src, /detectRegime\(/, `${name} must not call the flip-only read directly`);
  }
  // A missing flip on a panel with a regime says why, instead of a bare dash.
  assert.match(page, /noFlipNearSpot\(data\) \? 'None near spot'/);
});
