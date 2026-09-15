// Unit tests for the Gamma Chart's net-cumulative volume pane
// (core/netVolumeSeries.ts) — the running uptick-minus-downtick total the
// VOLUME strip draws instead of stacked columns when the Cumulative view is
// selected.
//
// What these pin down is the arithmetic a trader reads off the pane: the total
// runs from the day's first bar (not from the left edge of the viewport), it
// restarts on each ET trading date, and the area changes color exactly where
// the curve crosses zero rather than at the next bar.
//
// The module is pure (no window / React), so it imports directly with no stub.
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  cumulativeNetVolume,
  netVolumeAreaPaths,
  netVolumeDomain,
  netVolumeScale,
  sessionStartIndices,
  signedAreaSegments,
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

test('the total restarts at zero on each ET trading date', () => {
  // 1_440 minutes on is the next calendar day in ET as well as UTC.
  const values = cumulativeNetVolume([
    bar(0, 1_000, 0),
    bar(5, 500, 0), // day one ends at +1_500
    bar(1_440, 100, 400), // day two opens on its own: −300
    bar(1_445, 50, 0), // −250
  ]);
  assert.deepEqual(values, [1_000, 1_500, -300, -250]);
});

test('resetPerDay off accumulates across the whole window (daily candles)', () => {
  const values = cumulativeNetVolume(
    [bar(0, 1_000, 0), bar(1_440, 100, 400), bar(2_880, 0, 200)],
    { resetPerDay: false },
  );
  assert.deepEqual(values, [1_000, 700, 500]);
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

test('session starts mark the first bar of each ET trading date', () => {
  const starts = sessionStartIndices([bar(0, 0, 0), bar(5, 0, 0), bar(1_440, 0, 0), bar(1_445, 0, 0)]);
  assert.deepEqual(starts, [0, 2]);
  assert.deepEqual(sessionStartIndices([]), []);
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
