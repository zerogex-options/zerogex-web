// Unit tests for the GEX heatmap's Expiry filter (core/heatmapExpirations.ts and
// its wiring in components/GammaHeatmapCanvas.tsx).
//
// The filter used to be a no-op: picking a date relabeled the toolbar ("Expiry
// 2026-11-20 · DTE 2d") and sent `&expiration=<date>`, a parameter
// /api/gex/heatmap never read, so every cell kept summing every expiration.
// The rules pinned here:
//   • the request carries `expirations`, the parameter the API reads, with the
//     strike-profile-timeseries semantics ('all' or comma-joined dates);
//   • under a filter the flip line is the subset's own, never the whole-chain
//     /api/gex/historical fallback;
//   • the menu is the shared, tab-wide selection (with the rolling 0DTE pick),
//     not a private single-select.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { heatmapDteLabel, heatmapFlipRows, heatmapRequestPath } from '../core/heatmapExpirations.ts';

const query = (path: string) => new URLSearchParams(path.slice(path.indexOf('?') + 1));

test('the request carries the expirations the API sums over', () => {
  const one = heatmapRequestPath({ symbol: 'SPX', timeframe: '5min', windowUnits: 234, expirationsParam: '2026-11-20' });
  assert.ok(one.startsWith('/api/gex/heatmap?'));
  const q = query(one);
  assert.equal(q.get('expirations'), '2026-11-20');
  assert.equal(q.get('symbol'), 'SPX');
  assert.equal(q.get('underlying'), 'SPX');
  assert.equal(q.get('timeframe'), '5min');
  assert.equal(q.get('window_units'), '234');

  const several = heatmapRequestPath({
    symbol: 'SPY',
    timeframe: '1min',
    windowUnits: 60,
    expirationsParam: '2026-11-18,2026-11-20',
  });
  assert.equal(query(several).get('expirations'), '2026-11-18,2026-11-20');
});

test('All is sent as all, and the old ignored `expiration` parameter is gone', () => {
  for (const param of ['all', '']) {
    const path = heatmapRequestPath({ symbol: 'SPY', timeframe: '5min', windowUnits: 60, expirationsParam: param });
    assert.equal(query(path).get('expirations'), 'all');
  }
  const path = heatmapRequestPath({ symbol: 'SPY', timeframe: '5min', windowUnits: 60, expirationsParam: '2026-11-20' });
  assert.equal(query(path).get('expiration'), null, 'the singular name was never read by the API');
});

const bucket = (flip: number | null) => ({ timestamp: '2026-11-18T15:00:00Z', gamma_flip: flip });

test('All draws the heatmap’s own flips, and falls back to the whole-chain history only when it has none', () => {
  const own = [bucket(null), bucket(6801)];
  const history = [bucket(6790)];
  assert.equal(heatmapFlipRows(own, history, false), own);
  assert.equal(heatmapFlipRows([bucket(null)], history, false), history);
  assert.equal(heatmapFlipRows(null, history, false), history);
});

test('a filtered heatmap never draws the whole-chain flip in place of its own', () => {
  const history = [bucket(6790)];
  // The subset has no flip anywhere in the window: no line, not the whole chain's.
  const none = [bucket(null), bucket(null)];
  assert.equal(heatmapFlipRows(none, history, true), none);
  assert.equal(heatmapFlipRows(null, history, true).length, 0);
  // The subset has its own flips: those.
  const own = [bucket(6812.5)];
  assert.equal(heatmapFlipRows(own, history, true), own);
});

test('the DTE readout follows the selection', () => {
  const today = '2026-11-18';
  assert.equal(heatmapDteLabel([], today), 'All');
  assert.equal(heatmapDteLabel(['2026-11-18'], today), '0d');
  assert.equal(heatmapDteLabel(['2026-11-20'], today), '2d');
  assert.equal(heatmapDteLabel(['2026-11-18', '2026-11-21'], today), '0–3d');
  assert.equal(heatmapDteLabel(['2026-11-17'], today), '—', 'an expired pick is not 0DTE');
});

// Component wiring, read from source: the repo's tests run under Node without a
// DOM, so the canvas is checked the way tests/flipStatusChip.test.ts checks
// MarketMakerExposures.
const canvas = readFileSync(new URL('../components/GammaHeatmapCanvas.tsx', import.meta.url), 'utf8');

test('the heatmap’s Expiry menu is the shared multi-select, with the rolling 0DTE pick', () => {
  assert.match(canvas, /import ExpirationMultiSelect from '\.\/ExpirationMultiSelect'/);
  assert.match(canvas, /useChartExpirations\(symbol, true\)/, 'the tab-wide selection, reconciled to this symbol');
  assert.match(canvas, /useZeroDteOption\(availableExpirations, todayKey\)/);
  assert.match(canvas, /<ExpirationMultiSelect[\s\S]*?zeroDte=\{zeroDte\}[\s\S]*?\/>/);
  assert.match(canvas, /zeroDte\.widenedToAll/, 'a 0DTE pick with no same-day expiry says it is showing All');
  assert.doesNotMatch(canvas, /selectedExpiry/, 'no private single-select state is left');
  assert.doesNotMatch(canvas, /useGEXByStrike/, 'the expiry list no longer comes from the top-200 strike rows');
});

test('the heatmap sends the filter, and stops claiming it is best-effort', () => {
  assert.match(canvas, /heatmapRequestPath\(\{ symbol, timeframe: apiTf, windowUnits: fetchUnits, expirationsParam \}\)/);
  assert.doesNotMatch(canvas, /&expiration=/);
  assert.doesNotMatch(canvas, /best-effort/);
});

test('under a filter the flip line comes from the scoped buckets only', () => {
  assert.match(canvas, /heatmapFlipRows<GexHistoricalPoint>\(gexData, gexHistoricalData, expiryFiltered\)/);
  assert.match(canvas, /enabled: !expiryFiltered/, 'the whole-chain fallback is not even polled under a filter');
  assert.match(canvas, /LEVEL_NO_FLIP_IN_SCOPE_NOTE/, 'a filtered book with no flip says so');
});
