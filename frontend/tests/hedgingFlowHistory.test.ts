import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { normalizeGammaRegime, normalizeHedgingFlow } from '../core/hedgingFlowSeries.ts';

// Dated Hedging Flow permalinks: /hedging-flow/sessions and
// /hedging-flow/[symbol]/[date].
//
// Everything asserted here has a failure mode that renders a perfectly
// plausible page. A permalink that polls burns a request every 15s forever on
// a session that cannot change. A 0DTE toggle that sends TODAY's date filters
// a June session by a September expiration and comes back empty, which reads
// as "no 0DTE that day". A dated page that fetches on the client shows an
// anonymous visitor a header and an error, because the browser API is
// tier-gated. None of those throw, and none of them look broken in a
// screenshot.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

const DATED_PAGE = 'app/hedging-flow/[symbol]/[date]/page.tsx';
const DATED_CLIENT = 'app/hedging-flow/[symbol]/[date]/DatedHedgingFlow.tsx';
const LIVE_PAGE = 'app/hedging-flow/page.tsx';
const PANELS = 'app/hedging-flow/HedgingFlowPanels.tsx';

// --------------------------------------------------------------------------
// Wire-shape normalisation, shared by the polling hooks and the server fetch
// --------------------------------------------------------------------------
function flowPayload(barTimes: string[]) {
  return {
    symbol: 'SPY',
    session: '2026-06-12',
    basis: 'aggressor_inferred',
    disclosure: 'Estimated, not observed.',
    smoothing_bars: 3,
    bars: barTimes.map((t) => ({
      timestamp: t,
      bar_start: t,
      bar_end: t,
      call_flow_usd: 1,
      put_flow_usd: 1,
      net_flow_usd: 2,
      net_flow_ma_usd: null,
      cum_call_usd: 1,
      cum_put_usd: 1,
      cum_net_usd: 2,
      underlying_price: 600,
      contract_count: 1,
      classified_ratio: 1,
      is_synthetic: false,
    })),
    flips: [
      {
        bar_start: barTimes[0],
        kind: 'rate' as const,
        direction: 'to_buying' as const,
        magnitude_usd: 1,
        session_ratio: 1,
        is_significant: true,
        underlying_price: 600,
      },
    ],
  };
}

test('normalizeHedgingFlow turns the wire order into chart order', () => {
  // The endpoint answers newest-first; a chart reads left to right. Getting
  // this backwards draws the session in reverse, which looks like a session.
  const normalized = normalizeHedgingFlow(
    flowPayload(['2026-06-12T20:00:00Z', '2026-06-12T13:30:00Z']),
  );
  assert.ok(normalized);
  assert.deepEqual(
    normalized.bars.map((b) => b.bar_start),
    ['2026-06-12T13:30:00Z', '2026-06-12T20:00:00Z'],
  );
});

test('normalizeHedgingFlow leaves flips alone and survives null', () => {
  const normalized = normalizeHedgingFlow(flowPayload(['2026-06-12T13:30:00Z']));
  assert.equal(normalized?.flips.length, 1);
  assert.equal(normalizeHedgingFlow(null), null);
  assert.equal(normalizeGammaRegime(null), null);
});

test('normalizeGammaRegime lands the structure series on the same order', () => {
  // The two panels share a crosshair. One reversed and the other not would
  // pair bar N of the morning with bar N of the afternoon.
  const normalized = normalizeGammaRegime({
    symbol: 'SPY',
    session: '2026-06-12',
    rolling_bars: 6,
    bars: [
      { timestamp: '2026-06-12T20:00:00Z', bar_start: '2026-06-12T20:00:00Z' },
      { timestamp: '2026-06-12T13:30:00Z', bar_start: '2026-06-12T13:30:00Z' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any,
  });
  assert.deepEqual(
    normalized?.bars.map((b) => b.bar_start),
    ['2026-06-12T13:30:00Z', '2026-06-12T20:00:00Z'],
  );
});

test('both hooks go through the shared normaliser', () => {
  // The point of core/hedgingFlowSeries is that there is exactly one copy of
  // this reshaping. A hook that re-implements it is how the live page and a
  // permalink start disagreeing about which bar is which.
  for (const hook of ['hooks/useHedgingFlow.ts', 'hooks/useGammaRegimeSeries.ts']) {
    const source = read(hook);
    assert.match(source, /from '@\/core\/hedgingFlowSeries'/, `${hook} must share the normaliser`);
    assert.doesNotMatch(source, /\.reverse\(\)/, `${hook} must not re-implement the reshaping`);
  }
});

// --------------------------------------------------------------------------
// The behaviours that only show up as a wrong-looking page
// --------------------------------------------------------------------------
test('a dated read stops polling', () => {
  // A closed session is immutable. Left polling, a permalink someone leaves
  // open re-fetches an identical answer every 15 seconds indefinitely.
  for (const hook of [
    'hooks/useHedgingFlow.ts',
    'hooks/useGammaRegimeSeries.ts',
    'hooks/useGammaWeather.ts',
  ]) {
    assert.match(
      read(hook),
      /refreshInterval: (options\.)?date \? 0 :/,
      `${hook} must switch the poll off for a dated read`,
    );
  }
});

test('the 0DTE filter uses the session date, never today', () => {
  // On the live page they are the same value and the bug is invisible. On a
  // permalink they are months apart: today's date filters a past session by an
  // expiration that did not exist, and the panel truthfully reports no 0DTE.
  const live = read(LIVE_PAGE);
  assert.match(live, /const sessionDateKey = etTodayDateKey\(\)/);
  assert.match(live, /zeroDteOnly \? \[sessionDateKey\] : undefined/);

  // The dated route never calls etTodayDateKey at all — its scope is fetched
  // server-side against the URL's date.
  assert.doesNotMatch(read(DATED_CLIENT), /etTodayDateKey/);
  assert.match(read(DATED_PAGE), /expirations: date/);
});

test('the dated page fetches on the server, never in the browser', () => {
  // This is what makes the permalink public. The browser path to /api/flow/*
  // is tier-gated at the BFF (core/api/apiTierGate), so a client fetch would
  // serve an anonymous visitor — or a crawler — a header and an error.
  // Matched as CALLS, not names: the file legitimately imports the payload
  // types from those hook modules, and type imports are erased.
  const client = read(DATED_CLIENT);
  assert.doesNotMatch(
    client,
    /\b(useHedgingFlow|useGammaRegimeSeries|useGammaWeather)\(|[^a-zA-Z]fetch\(/,
    'the dated permalink must not fetch from the browser',
  );
  const page = read(DATED_PAGE);
  assert.match(page, /serverApiGetResult</);
  assert.match(page, /serverApiGet</);
});

test('both routes render the same panels', () => {
  // A historical session that drifted from the live one would be a receipt for
  // a chart nobody can reproduce.
  for (const file of [LIVE_PAGE, DATED_CLIENT]) {
    assert.match(read(file), /HedgingFlowPanels/, `${file} must render the shared panels`);
  }
  // And the panels must own no data of their own.
  assert.doesNotMatch(read(PANELS), /useHedgingFlow\(|useGammaRegimeSeries\(|useGammaWeather\(/);
});

test('the session index is listed in the sitemap, the live tool is not', () => {
  // The index is public and indexable; the dated permalinks are discovered
  // from it, the way /replay and /scorecard work. /hedging-flow itself is
  // Basic-gated and must not be advertised.
  const sitemap = read('next-sitemap.config.mjs');
  assert.match(sitemap, /'\/hedging-flow\/sessions'/);
  // The live tool is gated, so Googlebot following it lands on a 307 to
  // /login — "Page with redirect" in Search Console. It belongs in `exclude`,
  // beside the other gated tools, not in additionalPaths.
  const excludeBlock = sitemap.slice(sitemap.indexOf('exclude: ['), sitemap.indexOf('additionalPaths:'));
  assert.match(excludeBlock, /'\/hedging-flow',/);
});

test('the pickers offer only symbols this endpoint can answer for', () => {
  // The backend's futures middleware refuses the per-contract flow endpoints
  // for ES / NQ outright (400): an SPX contract with its strike scaled by the
  // basis is not a contract anyone can trade. A picker that listed them would
  // be offering an error, and a reader cannot tell a refused symbol from a
  // broken page.
  for (const file of [
    'app/hedging-flow/sessions/page.tsx',
    'app/hedging-flow/[symbol]/[date]/DatedHedgingFlow.tsx',
    'app/hedging-flow/[symbol]/[date]/page.tsx',
  ]) {
    assert.match(read(file), /symbols=\{CASH_SYMBOLS\}/, `${file} must restrict the picker`);
  }
});

test('every dated OG image awaits its params', () => {
  // `params` is a Promise in this Next version. Destructured synchronously it
  // yields undefined, so the preview renders with no date and skips its fetch
  // — which is exactly what every one of these did until it was noticed on a
  // shared card reading "SPY ·" and then nothing.
  const images = [
    'app/hedging-flow/[symbol]/[date]/opengraph-image.tsx',
    'app/scorecard/[symbol]/[date]/opengraph-image.tsx',
    'app/forecast/[symbol]/[date]/opengraph-image.tsx',
    'app/replay/[symbol]/[date]/snapshot/[time]/opengraph-image.tsx',
    'app/cards/[id]/opengraph-image.tsx',
  ];
  for (const file of images) {
    const source = read(file);
    assert.match(source, /params: Promise</, `${file} must type params as a Promise`);
    assert.match(source, /await params/, `${file} must await params`);
  }
});
