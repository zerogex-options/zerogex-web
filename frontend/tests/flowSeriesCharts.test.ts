// Unit tests for the pure Options Flow derivations (core/flowSeriesCharts.ts)
// that back both the /flow-analysis "Options Flow" chart and its "My Dashboard"
// widget twin. Because the page and the widget share these exact transforms,
// pinning them here is what guarantees a chart added to a board plots what the
// page plots.
//
// The module is pure (no window / React), so it imports directly with no stub.
// `nowMs` is injected everywhere a "has this bar closed yet?" decision is made,
// so the incomplete-bar rules are testable without touching the clock.
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  alignFlowSeriesToTimeline,
  canonicalTimestamp,
  generateNiceTicks,
  getDateMarkerMeta,
  getDynamicLeftMargin,
  getDynamicStep,
  getETTimeTimestamp,
  getFiveMinuteSessionTimeline,
  getUnderlyingDomain,
  is30MinBoundary,
  isBarWindowComplete,
  latestRowMs,
  mapSeriesToFlowTimeseries,
  maskIncompleteZeroFlowBars,
  optionsFlowSeries,
  roundToStep,
  safeTimeLabel,
} = await import('../core/flowSeriesCharts.ts');

type SeriesRow = {
  timestamp: string;
  call_premium_cum: number;
  put_premium_cum: number;
  net_volume_cum: number;
  raw_volume_cum: number;
  underlying_price: number | null;
};

// 2026-08-17 is a Monday; 13:30Z is 09:30 ET during daylight saving.
const BAR = (minutes: number) =>
  new Date(Date.UTC(2026, 7, 17, 13, 30) + minutes * 60_000).toISOString();

function row(minutes: number, over: Partial<SeriesRow> = {}): SeriesRow {
  return {
    timestamp: BAR(minutes),
    call_premium_cum: 1_000,
    put_premium_cum: -500,
    net_volume_cum: 250,
    raw_volume_cum: 900,
    underlying_price: 600,
    ...over,
  };
}

// ── Session timeline ─────────────────────────────────────────────────────────

test('the 5-minute session timeline runs 09:30 to 16:15 ET on even 5-minute slots', () => {
  const timeline = getFiveMinuteSessionTimeline('2026-08-17');
  assert.equal(timeline[0], BAR(0));
  assert.equal(timeline[timeline.length - 1], BAR(405)); // 09:30 + 6h45m = 16:15
  assert.equal(timeline.length, 82);
  // Every slot lands on a 5-minute boundary, in ascending order.
  for (let i = 1; i < timeline.length; i++) {
    const step = new Date(timeline[i]).getTime() - new Date(timeline[i - 1]).getTime();
    assert.equal(step, 5 * 60_000);
  }
});

test('an unparseable date key yields no timeline rather than a bogus one', () => {
  assert.deepEqual(getFiveMinuteSessionTimeline('not-a-date'), []);
});

test('getETTimeTimestamp resolves ET wall-clock across the DST boundary', () => {
  // August: ET is UTC-4, so 16:15 ET is 20:15Z.
  assert.equal(getETTimeTimestamp('2026-08-17', 16, 15), Date.UTC(2026, 7, 17, 20, 15));
  // January: ET is UTC-5, so 16:15 ET is 21:15Z.
  assert.equal(getETTimeTimestamp('2026-01-20', 16, 15), Date.UTC(2026, 0, 20, 21, 15));
});

// ── Row mapping ──────────────────────────────────────────────────────────────

test('canonicalTimestamp normalizes server stamps so timeline keys match', () => {
  assert.equal(canonicalTimestamp('2026-08-17T13:30:00Z'), '2026-08-17T13:30:00.000Z');
  // Unparseable values pass through untouched rather than becoming "Invalid Date".
  assert.equal(canonicalTimestamp('nonsense'), 'nonsense');
});

test('the net-volume basis picks net vs raw cumulative, and splits the area by sign', () => {
  const rows = [row(0, { net_volume_cum: -400, raw_volume_cum: 900 })];

  const [directional] = mapSeriesToFlowTimeseries(rows, 'directional');
  assert.equal(directional.netVolume, -400);
  assert.equal(directional.positiveNetVolume, 0);
  assert.equal(directional.negativeNetVolume, -400);

  const [raw] = mapSeriesToFlowTimeseries(rows, 'raw');
  assert.equal(raw.netVolume, 900);
  assert.equal(raw.positiveNetVolume, 900);
  assert.equal(raw.negativeNetVolume, 0);

  // Premium fields are straight renames — nothing is accumulated client-side.
  assert.equal(directional.callPremium, 1_000);
  assert.equal(directional.putPremium, -500);
  assert.equal(directional.underlyingPrice, 600);
});

// ── Timeline alignment ───────────────────────────────────────────────────────

test('latestRowMs finds the last row, and is -Infinity for an empty series', () => {
  assert.equal(latestRowMs([{ timestamp: BAR(0) }, { timestamp: BAR(10) }]), new Date(BAR(10)).getTime());
  assert.equal(latestRowMs([]), -Infinity);
});

test('a quiet slot inside the session carries the previous cumulative forward', () => {
  const timeline = [BAR(0), BAR(5), BAR(10)];
  const mapped = mapSeriesToFlowTimeseries(
    [row(0, { call_premium_cum: 100 }), row(10, { call_premium_cum: 300 })],
    'directional',
  );
  const aligned = alignFlowSeriesToTimeline(mapped, timeline);

  assert.equal(aligned.length, 3);
  assert.equal(aligned[0].callPremium, 100);
  // 09:35 reported nothing but sits before the last bar — hold, don't hole.
  assert.equal(aligned[1].callPremium, 100);
  assert.equal(aligned[2].callPremium, 300);
});

test('slots after the last bar stay null so the curve never runs into future time', () => {
  const timeline = [BAR(0), BAR(5), BAR(10)];
  const aligned = alignFlowSeriesToTimeline(
    mapSeriesToFlowTimeseries([row(0)], 'directional'),
    timeline,
  );

  assert.equal(aligned[0].callPremium, 1_000);
  for (const slot of aligned.slice(1)) {
    assert.equal(slot.callPremium, null);
    assert.equal(slot.putPremium, null);
    assert.equal(slot.netVolume, null);
    assert.equal(slot.positiveNetVolume, null);
    assert.equal(slot.negativeNetVolume, null);
    assert.equal(slot.underlyingPrice, null);
  }
});

test('every aligned slot is labeled in ET, on the timeline it was given', () => {
  const timeline = [BAR(0), BAR(5)];
  const aligned = alignFlowSeriesToTimeline([], timeline);
  assert.deepEqual(aligned.map((r) => r.timestamp), timeline);
  assert.deepEqual(aligned.map((r) => r.time), ['09:30', '09:35']);
});

// ── Incomplete-bar suppression ───────────────────────────────────────────────

test('a bar window is complete only once its full 5 minutes have elapsed', () => {
  const barMs = new Date(BAR(0)).getTime();
  assert.equal(isBarWindowComplete(BAR(0), barMs + 4 * 60_000), false);
  assert.equal(isBarWindowComplete(BAR(0), barMs + 5 * 60_000), true);
  // An unparseable stamp is treated as closed rather than masked forever.
  assert.equal(isBarWindowComplete('nonsense', barMs), true);
});

test('an all-zero row inside a still-open bar is blanked, not plotted at zero', () => {
  const zeroed = mapSeriesToFlowTimeseries(
    [row(0, { call_premium_cum: 0, put_premium_cum: 0, net_volume_cum: 0 })],
    'directional',
  );
  const nowInsideBar = new Date(BAR(0)).getTime() + 60_000;

  const [masked] = maskIncompleteZeroFlowBars(zeroed, nowInsideBar);
  assert.equal(masked.callPremium, null);
  assert.equal(masked.putPremium, null);
  assert.equal(masked.netVolume, null);
  // The underlying price is a quote, not a flow cumulative — it survives.
  assert.equal(masked.underlyingPrice, 600);

  // Once the window closes, a genuine zero is allowed through.
  const [kept] = maskIncompleteZeroFlowBars(zeroed, nowInsideBar + 5 * 60_000);
  assert.equal(kept.callPremium, 0);
  assert.equal(kept.netVolume, 0);
});

test('a non-zero row inside an open bar is left alone', () => {
  const live = mapSeriesToFlowTimeseries([row(0)], 'directional');
  const [out] = maskIncompleteZeroFlowBars(live, new Date(BAR(0)).getTime() + 60_000);
  assert.equal(out.callPremium, 1_000);
  assert.equal(out.netVolume, 250);
});

// ── The composed derivation ──────────────────────────────────────────────────

test('optionsFlowSeries maps, aligns and masks in one pass over the session grid', () => {
  const timeline = getFiveMinuteSessionTimeline('2026-08-17');
  const rows = [
    row(0, { call_premium_cum: 100, net_volume_cum: 10 }),
    // 09:35 is missing entirely — the aligner fills it.
    row(10, { call_premium_cum: 400, net_volume_cum: 40 }),
    // The tip bar is still open and reported nothing yet.
    row(15, { call_premium_cum: 0, put_premium_cum: 0, net_volume_cum: 0 }),
  ];
  const nowInsideTip = new Date(BAR(15)).getTime() + 60_000;

  const out = optionsFlowSeries(rows, timeline, 'directional', nowInsideTip);

  assert.equal(out.length, timeline.length);
  assert.equal(out[0].callPremium, 100); // 09:30, reported
  assert.equal(out[1].callPremium, 100); // 09:35, carried forward
  assert.equal(out[2].callPremium, 400); // 09:40, reported
  assert.equal(out[3].callPremium, null); // 09:45, open tip bar reading all-zero
  assert.equal(out[3].netVolume, null);
  assert.equal(out[4].callPremium, null); // 09:50, beyond the last bar

  // Once that tip bar's window closes, its genuine zero is plotted.
  const closed = optionsFlowSeries(rows, timeline, 'directional', nowInsideTip + 5 * 60_000);
  assert.equal(closed[3].callPremium, 0);
  assert.equal(closed[4].callPremium, null);
});

test('optionsFlowSeries returns nothing when the session grid could not be built', () => {
  assert.deepEqual(optionsFlowSeries([row(0)], [], 'directional'), []);
});

test('an empty feed still yields one row per session slot, all null', () => {
  const timeline = getFiveMinuteSessionTimeline('2026-08-17');
  const out = optionsFlowSeries(null, timeline, 'directional');
  assert.equal(out.length, timeline.length);
  assert.ok(out.every((r) => r.callPremium === null && r.netVolume === null));
});

// ── Axis helpers ─────────────────────────────────────────────────────────────

test('the axis step lands on a 1 / 2 / 5 / 10 multiple of the range magnitude', () => {
  assert.equal(getDynamicStep(0, 60), 10);
  assert.equal(getDynamicStep(0, 6_000), 1_000);
  assert.equal(getDynamicStep(0, 30_000), 5_000);
  // Degenerate ranges never produce a zero or negative step (which would hang
  // the tick loop below).
  assert.ok(getDynamicStep(0, 0) >= 1);
  assert.ok(getDynamicStep(5, 5) >= 1);
});

test('roundToStep snaps outward and survives non-finite input', () => {
  assert.equal(roundToStep(1_234, 500, 'down'), 1_000);
  assert.equal(roundToStep(1_234, 500, 'up'), 1_500);
  assert.equal(roundToStep(-1_234, 500, 'down'), -1_500);
  assert.equal(roundToStep(NaN, 500, 'up'), 0);
});

test('nice ticks span the domain and stop at a bounded count', () => {
  const ticks = generateNiceTicks(0, 6_000);
  assert.equal(ticks[0], 0);
  assert.ok(ticks[ticks.length - 1] >= 6_000);
  assert.ok(ticks.length <= 20);
  // An inverted or collapsed domain degrades to a single tick instead of looping.
  assert.deepEqual(generateNiceTicks(10, 10), [10]);
  assert.deepEqual(generateNiceTicks(10, 5), [10]);
});

test('the underlying domain pads the observed range, or defers to auto when empty', () => {
  const rows = mapSeriesToFlowTimeseries(
    [row(0, { underlying_price: 600 }), row(5, { underlying_price: 610 })],
    'directional',
  );
  const [min, max] = getUnderlyingDomain(rows);
  assert.ok(typeof min === 'number' && typeof max === 'number');
  assert.ok(min < 600 && max > 610);

  const priceless = mapSeriesToFlowTimeseries([row(0, { underlying_price: null })], 'directional');
  assert.deepEqual(getUnderlyingDomain(priceless), ['auto', 'auto']);
});

test('the left gutter widens with the price magnitude, within bounds', () => {
  const spy = mapSeriesToFlowTimeseries([row(0, { underlying_price: 600 })], 'directional');
  const ndx = mapSeriesToFlowTimeseries([row(0, { underlying_price: 24_500 })], 'directional');
  assert.ok(getDynamicLeftMargin(ndx) >= getDynamicLeftMargin(spy));
  assert.ok(getDynamicLeftMargin(ndx) <= 120);
  // No prices at all still reserves the default gutter.
  assert.equal(getDynamicLeftMargin([]), 86);
});

// ── Label helpers ────────────────────────────────────────────────────────────

test('time labels are ET 24-hour, and degrade safely', () => {
  assert.equal(safeTimeLabel(BAR(0)), '09:30');
  assert.equal(safeTimeLabel(BAR(390)), '16:00');
  assert.equal(safeTimeLabel(undefined), '--:--');
  assert.equal(safeTimeLabel('nonsense'), '--:--');
});

test('30-minute gridlines land on the ET half-hours', () => {
  assert.equal(is30MinBoundary(BAR(0)), true); // 09:30
  assert.equal(is30MinBoundary(BAR(30)), true); // 10:00
  assert.equal(is30MinBoundary(BAR(5)), false); // 09:35
  assert.equal(is30MinBoundary('nonsense'), false);
});

test('the date marker labels only the first slot of each calendar day', () => {
  const meta = getDateMarkerMeta([BAR(0), BAR(5), BAR(1_440), BAR(1_445)]);
  assert.equal(meta.size, 2);
  assert.ok(meta.has(0));
  assert.ok(meta.has(2));
  assert.equal(meta.has(1), false);
});
