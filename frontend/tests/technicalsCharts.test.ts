// Unit tests for the Technicals chart helpers (frontend/core/technicalsCharts.ts)
// behind the /intraday-tools page and the My Dashboard ORB widgets.
//
// The contract: the page and the widgets read the same numbers — where price
// sits on the Position Within Range bar, the breakout map's rows, domain and
// ticks — and every orb_status the backend sends maps to one of five states,
// so a widget can show a label short enough to fit its card.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  orbChartDomain,
  orbChartRows,
  orbPosition,
  orbPriceTicks,
  orbStatusColor,
  orbStatusKind,
  timelineLabelStepMin,
} from '../core/technicalsCharts.ts';

// The exact strings src/api/queries/technicals.py produces.
const BACKEND_STATUSES = {
  breakout: '🚀 ORB Breakout (Long)',
  breakdown: '💥 ORB Breakdown (Short)',
  nearHigh: '⚡ Near ORB High',
  nearLow: '⚡ Near ORB Low',
  inside: '⏸️ Inside ORB',
} as const;

test('every status the backend sends maps to its state', () => {
  for (const [kind, status] of Object.entries(BACKEND_STATUSES)) {
    assert.equal(orbStatusKind(status), kind, status);
  }
});

test('no status, or one this build does not know, maps to nothing', () => {
  for (const status of [null, undefined, '', 'Something new']) {
    assert.equal(orbStatusKind(status), null);
  }
});

test('status color: breakout bullish, breakdown bearish, the rest a warning', () => {
  assert.equal(orbStatusColor(BACKEND_STATUSES.breakout), 'var(--color-bull)');
  assert.equal(orbStatusColor(BACKEND_STATUSES.breakdown), 'var(--color-bear)');
  for (const status of [BACKEND_STATUSES.nearHigh, BACKEND_STATUSES.nearLow, BACKEND_STATUSES.inside, null]) {
    assert.equal(orbStatusColor(status), 'var(--color-warning)');
  }
});

test('the bar spans one range-width either side of the range', () => {
  // Range 770–772 (width 2): the bar runs 768 to 774.
  const orb = { orb_high: 772, orb_low: 770, orb_range: 2 };
  const inside = orbPosition(orb, 771)!;
  assert.equal(inside.lowPct, (2 / 6) * 100);
  assert.equal(inside.highPct, (4 / 6) * 100);
  assert.equal(inside.pricePct, 50);
  assert.equal(orbPosition(orb, 768)!.pricePct, 0, 'one width below the range is the left end');
  assert.equal(orbPosition(orb, 774)!.pricePct, 100, 'one width above is the right end');
});

test('price further out than the bar pins to its end', () => {
  const orb = { orb_high: 772, orb_low: 770, orb_range: 2 };
  assert.equal(orbPosition(orb, 760)!.pricePct, 0);
  assert.equal(orbPosition(orb, 790)!.pricePct, 100);
});

test('a missing or zero range width falls back to one dollar', () => {
  const pos = orbPosition({ orb_high: 772, orb_low: 770, orb_range: 0 }, 771)!;
  // Bar 769–773.
  assert.equal(pos.lowPct, 25);
  assert.equal(pos.highPct, 75);
});

test('no position until the range and a price both exist', () => {
  assert.equal(orbPosition(null, 771), null);
  assert.equal(orbPosition({ orb_high: null, orb_low: 770, orb_range: 2 }, 771), null);
  assert.equal(orbPosition({ orb_high: 772, orb_low: 770, orb_range: 2 }, null), null);
  // A null must not be read as a price of zero.
  assert.equal(orbPosition({ orb_high: 772, orb_low: 770, orb_range: 2 }, ''), null);
});

const bar = (timestamp: string, close: number | null, high: number | null, low: number | null) =>
  ({
    timestamp,
    close,
    opening_range: { orb_high: high, orb_low: low },
  }) as unknown as Parameters<typeof orbChartRows>[0][number];

test('chart rows carry the band only once the range exists', () => {
  const rows = orbChartRows([
    bar('2026-09-23T13:35:00Z', 772.5, null, null),
    bar('2026-09-23T14:05:00Z', 771.2, 772.89, 770.46),
  ]);
  assert.equal(rows[0].orbBand, null, 'before 10:00 ET there is no band');
  assert.equal(rows[0].price, 772.5);
  assert.deepEqual(rows[1].orbBand, [770.46, 772.89]);
});

test('the domain covers price and both levels with 15% air', () => {
  const rows = orbChartRows([
    bar('2026-09-23T14:05:00Z', 768, 772, 770),
    bar('2026-09-23T14:10:00Z', 771, 772, 770),
  ]);
  const [lo, hi] = orbChartDomain(rows)!;
  // Values span 768–772 (4 wide): 0.6 of air each side.
  assert.ok(Math.abs(lo - 767.4) < 1e-9, String(lo));
  assert.ok(Math.abs(hi - 772.6) < 1e-9, String(hi));
  assert.equal(orbChartDomain([]), null);
});

test('price ticks sit inside the domain, edges dropped', () => {
  const ticks = orbPriceTicks([767.4, 772.6]);
  assert.ok(ticks.length >= 2);
  for (const t of ticks) assert.ok(t > 767.4 && t < 772.6, String(t));
  assert.deepEqual(orbPriceTicks(null), []);
});

test('desktop time labels thin out as the session fills', () => {
  assert.equal(timelineLabelStepMin(0), 60);
  assert.equal(timelineLabelStepMin(24), 15);
  assert.equal(timelineLabelStepMin(96), 30);
  assert.equal(timelineLabelStepMin(192), 60, 'a full 04:00–20:00 session of five-minute slots');
  assert.equal(timelineLabelStepMin(300), 120);
});
