// Unit tests for the Gamma Chart's net-cumulative volume pane
// (core/netVolumeSeries.ts) — the running uptick-minus-downtick total the
// VOLUME strip draws instead of stacked columns when the Cumulative view is
// selected.
//
// What these pin down is the arithmetic a trader reads off the pane: the total
// covers the most recent session only — it starts at that session's first bar
// (not at the left edge of the viewport) and every earlier bar is exactly zero
// — and the area changes color exactly where the curve crosses zero rather
// than at the next bar.
//
// The module is pure (no window / React), so it imports directly with no stub.
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  cumulativeNetVolume,
  netVolumeAreaPaths,
  netVolumeDomain,
  netVolumeScale,
  lastSessionStartIndex,
  signedAreaSegments,
  tradingSessionKeyFor,
  VOLUME_MODE_LABELS,
} = await import('../core/netVolumeSeries.ts');

// 2026-08-17 is a Monday; 13:30Z is 09:30 ET during daylight saving.
const BAR = (minutes: number) =>
  new Date(Date.UTC(2026, 7, 17, 13, 30) + minutes * 60_000).toISOString();

const bar = (minutes: number, upVolume: number, downVolume: number) => ({
  timestamp: BAR(minutes),
  upVolume,
  downVolume,
});

// ── Accumulation ─────────────────────────────────────────────────────────────

test('the total is a running up-minus-down sum through each bar', () => {
  const values = cumulativeNetVolume([
    bar(0, 1_000, 400), // +600
    bar(5, 200, 900), // −700 → −100
    bar(10, 0, 0), // flat → −100
    bar(15, 500, 100), // +400 → +300
  ]);
  assert.deepEqual(values, [600, -100, -100, 300]);
});

test('only the most recent session accumulates; every earlier bar is zero', () => {
  // 1_440 minutes on is the next calendar day in ET as well as UTC.
  const values = cumulativeNetVolume([
    bar(0, 1_000, 0), // a settled session: contributes nothing
    bar(5, 500, 0),
    bar(1_440, 100, 400), // the latest session opens on its own: −300
    bar(1_445, 50, 0), // −250
  ]);
  assert.deepEqual(values, [0, 0, -300, -250]);
});

test('a series inside one session accumulates from its first bar', () => {
  const values = cumulativeNetVolume([bar(0, 1_000, 0), bar(5, 0, 400)]);
  assert.deepEqual(values, [1_000, 600]);
});

test('the window scope accumulates across every bar (daily candles)', () => {
  const values = cumulativeNetVolume(
    [bar(0, 1_000, 0), bar(1_440, 100, 400), bar(2_880, 0, 200)],
    { scope: 'window' },
  );
  assert.deepEqual(values, [1_000, 700, 500]);
});

test('a futures session runs from the 18:00 ET open, not from midnight', () => {
  // Bars are offsets from 09:30 ET, so +7h30 is 17:00 ET (the CME maintenance
  // break, still the prior session), +9h30 is 19:00 ET (the session that
  // settles the NEXT day), and +15h30 is 01:00 ET — the same futures session,
  // carried across midnight.
  const overnight = [
    bar(7 * 60 + 30, 900, 0), // 17:00 ET — prior session
    bar(9 * 60 + 30, 100, 0), // 19:00 ET — the new session opens
    bar(15 * 60 + 30, 0, 400), // 01:00 ET the next day — same session
  ];
  assert.deepEqual(cumulativeNetVolume(overnight, { symbol: 'ES' }), [0, 100, -300]);
  // A cash symbol keys on the calendar date, so midnight does start a session.
  assert.deepEqual(cumulativeNetVolume(overnight, { symbol: 'SPY' }), [0, 0, -400]);
});

test('a bar with a non-finite volume counts as zero rather than poisoning the total', () => {
  const values = cumulativeNetVolume([
    bar(0, 1_000, 400),
    { timestamp: BAR(5), upVolume: Number.NaN, downVolume: 100 },
    bar(10, 200, 0),
  ]);
  assert.deepEqual(values, [600, 500, 700]);
});

test('an empty series has no points', () => {
  assert.deepEqual(cumulativeNetVolume([]), []);
});

// ── Session boundaries ───────────────────────────────────────────────────────

test('the session start is the first bar of the last ET trading date', () => {
  const bars = [bar(0, 0, 0), bar(5, 0, 0), bar(1_440, 0, 0), bar(1_445, 0, 0)];
  assert.equal(lastSessionStartIndex(bars), 2);
  // Nothing but one session (or nothing at all) starts at the first bar.
  assert.equal(lastSessionStartIndex(bars.slice(0, 2)), 0);
  assert.equal(lastSessionStartIndex([]), 0);
});

test('the session start follows the right edge, not the wall clock', () => {
  // Handed only the bars through an edge inside the FIRST day, the session
  // resolved is that day's — which is what a panned-back view has to measure.
  const bars = [bar(0, 0, 0), bar(5, 0, 0), bar(1_440, 0, 0)];
  assert.equal(lastSessionStartIndex(bars.slice(0, 2)), 0);
  assert.equal(lastSessionStartIndex(bars), 2);
});

test('the session key is the ET date for cash and the settle date for futures', () => {
  // Morning bars key the same either way: 09:30 ET is before any 18:00 open.
  assert.equal(tradingSessionKeyFor(BAR(0), 'SPY'), '2026-08-17');
  assert.equal(tradingSessionKeyFor(BAR(0), 'ES'), '2026-08-17');
  // 19:00 ET is the next futures session; the calendar date still reads today.
  assert.equal(tradingSessionKeyFor(BAR(9 * 60 + 30), 'ES'), '2026-08-18');
  assert.equal(tradingSessionKeyFor(BAR(9 * 60 + 30), 'SPY'), '2026-08-17');
  // 01:00 ET the next morning: one session for both, by two different routes.
  assert.equal(tradingSessionKeyFor(BAR(15 * 60 + 30), 'ES'), '2026-08-18');
  assert.equal(tradingSessionKeyFor(BAR(15 * 60 + 30), 'SPY'), '2026-08-18');
  // 22:00Z on Aug 31 is 18:00 ET — the session that settles on Sep 1, rolling
  // the month. 04:00Z on Sep 1 is midnight ET, which must NOT roll: en-US
  // formats it as hour "24" unless the formatter pins hourCycle h23.
  assert.equal(tradingSessionKeyFor('2026-08-31T22:00:00Z', 'ES'), '2026-09-01');
  assert.equal(tradingSessionKeyFor('2026-09-01T04:00:00Z', 'ES'), '2026-09-01');
  assert.equal(tradingSessionKeyFor('not a date', 'ES'), '');
});

// ── Sign-split areas ─────────────────────────────────────────────────────────

test('a series that never crosses zero is one segment', () => {
  const segments = signedAreaSegments([100, 400, 250]);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].sign, 1);
  assert.deepEqual(
    segments[0].points.map((p) => p.x),
    [0, 1, 2],
  );
});

test('a crossing is interpolated so the color changes on the axis, not at the next bar', () => {
  // +300 → −100 crosses three quarters of the way from bar 0 to bar 1.
  const segments = signedAreaSegments([300, -100]);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].sign, 1);
  assert.equal(segments[1].sign, -1);

  const end = segments[0].points[segments[0].points.length - 1];
  const start = segments[1].points[0];
  assert.equal(end.value, 0);
  assert.equal(start.value, 0);
  // Both fills meet at the same point: no gap, no overlap.
  assert.equal(end.x, start.x);
  assert.equal(end.x, 0.75);
});

test('a bar sitting exactly on zero is itself the boundary', () => {
  const segments = signedAreaSegments([500, 0, -500]);
  assert.deepEqual(
    segments.map((s) => s.sign),
    [1, -1],
  );
  assert.equal(segments[0].points[segments[0].points.length - 1].value, 0);
  assert.equal(segments[0].points[segments[0].points.length - 1].x, 1);
  assert.equal(segments[1].points[0].x, 1);
});

test('segments never span a session break', () => {
  // Same sign either side of the break: without the break this would be one
  // segment drawing a cliff across the day divider.
  const segments = signedAreaSegments([100, 400, 50, 200], [2]);
  assert.equal(segments.length, 2);
  assert.deepEqual(
    segments[0].points.map((p) => p.x),
    [0, 1],
  );
  assert.deepEqual(
    segments[1].points.map((p) => p.x),
    [2, 3],
  );
  // And no crossing is invented across the break, even on a sign change.
  const flipped = signedAreaSegments([100, -400], [1]);
  assert.equal(flipped.length, 2);
  assert.equal(flipped[0].points.length, 1);
  assert.equal(flipped[1].points.length, 1);
});

test("a session's first bar is a one-point segment the caller draws as a column", () => {
  const segments = signedAreaSegments([750]);
  assert.equal(segments.length, 1);
  assert.deepEqual(segments[0].points, [{ x: 0, value: 750 }]);
});

test('an all-zero series fills nothing', () => {
  assert.deepEqual(signedAreaSegments([0, 0, 0]), []);
  assert.deepEqual(signedAreaSegments([]), []);
});

// ── Plot bounds ──────────────────────────────────────────────────────────────

test('the domain always straddles zero and pads only the live side', () => {
  const positive = netVolumeDomain([100, 900]);
  assert.equal(positive.min, 0); // an all-green session sits on the pane floor
  assert.ok(positive.max > 900);

  const negative = netVolumeDomain([-100, -900]);
  assert.equal(negative.max, 0);
  assert.ok(negative.min < -900);

  const both = netVolumeDomain([-400, 800]);
  assert.ok(both.min < -400);
  assert.ok(both.max > 800);
});

test('a flat series still gets a range a scale can divide by', () => {
  const flat = netVolumeDomain([0, 0]);
  assert.ok(flat.max > flat.min);
  assert.deepEqual(netVolumeDomain([]), { min: 0, max: 1 });
});

// ── Pane scale ───────────────────────────────────────────────────────────────

// The Gamma Chart's volume pane, in its own SVG coordinates.
const PANE = { top: 100, bottom: 200 };

test('an all-positive session stands on the pane floor', () => {
  const scale = netVolumeScale([100, 900], PANE);
  assert.equal(scale.zeroY, PANE.bottom);
  assert.ok(scale.y(900) > PANE.top); // padded, so the peak clears the ceiling
  assert.ok(scale.y(900) < scale.y(100)); // bigger value, higher on screen
});

test('a session that has been both ways puts zero inside the pane', () => {
  const scale = netVolumeScale([-500, 500], PANE);
  assert.ok(scale.zeroY > PANE.top && scale.zeroY < PANE.bottom);
  assert.ok(scale.y(500) < scale.zeroY); // green side above the line
  assert.ok(scale.y(-500) > scale.zeroY); // red side below it
  // Symmetric extremes put zero in the middle of the pane.
  assert.ok(Math.abs(scale.zeroY - (PANE.top + PANE.bottom) / 2) < 0.001);
});

// ── Path building ────────────────────────────────────────────────────────────

const x10 = (index: number) => index * 10;

test('a segment is filled down to the zero line and stroked along the curve', () => {
  const scale = netVolumeScale([100, 200], PANE);
  const [area] = netVolumeAreaPaths(signedAreaSegments([100, 200]), {
    x: x10,
    y: scale.y,
    zeroY: scale.zeroY,
    columnWidth: 6,
  });
  assert.equal(area.sign, 1);
  // The outline is the curve; the fill is that same curve closed onto zero.
  assert.equal(area.line, `M0.00,${scale.y(100).toFixed(2)}L10.00,${scale.y(200).toFixed(2)}`);
  assert.equal(area.fill, `${area.line}L10.00,${scale.zeroY.toFixed(2)}L0.00,${scale.zeroY.toFixed(2)}Z`);
});

test('a single-bar run is drawn as a column standing on the zero line', () => {
  const scale = netVolumeScale([400], PANE);
  const [area] = netVolumeAreaPaths(signedAreaSegments([400]), {
    x: x10,
    y: scale.y,
    zeroY: scale.zeroY,
    columnWidth: 6,
  });
  // Centered on the bar, one columnWidth across, no outline to stroke.
  assert.equal(area.line, '');
  assert.equal(area.fill, `M-3.00,200.00L3.00,200.00L3.00,${scale.y(400).toFixed(2)}L-3.00,${scale.y(400).toFixed(2)}Z`);
});

test('the two sides of a crossing meet on the zero line', () => {
  const values = [300, -100];
  const scale = netVolumeScale(values, PANE);
  const opts = { x: x10, y: scale.y, zeroY: scale.zeroY, columnWidth: 6 };
  const [green, red] = netVolumeAreaPaths(signedAreaSegments(values), opts);
  assert.equal(green.sign, 1);
  assert.equal(red.sign, -1);
  // 300 → −100 crosses at x = 7.5 in pane coordinates, and both fills touch
  // the axis there: no sliver of green below zero, no red above it.
  const zero = scale.zeroY.toFixed(2);
  assert.ok(green.line.endsWith(`L7.50,${zero}`));
  assert.ok(red.line.startsWith(`M7.50,${zero}`));
});

// ── Control copy ─────────────────────────────────────────────────────────────

test('the two views are named for what they draw', () => {
  assert.equal(VOLUME_MODE_LABELS.updown, 'Up/Down');
  assert.equal(VOLUME_MODE_LABELS.net, 'Cumulative');
});
