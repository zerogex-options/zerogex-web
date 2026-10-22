// Unit tests for the Flow Analysis chart's zoom and pan (frontend/core/flowChartView.ts).
//
// The contract: no view is the whole session; zooming in from it on a live
// session keeps the newest bar on screen and follows it as bars arrive; a
// wheel zoom keeps the bar under the pointer where it is; zooming all the way
// out is the whole session again; a pan stops at the open and at the newest
// bar, and panning back to the newest bar follows it again; the time axis
// labels keep their distance; and the price scale fits what is on screen
// until the reader zooms or pans it.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FIT_PRICE,
  MIN_SPAN,
  ZOOM_STEP,
  applyPriceView,
  edgePad,
  flowWindow,
  isFitPrice,
  panView,
  tickStepMinutes,
  zoomPrice,
  zoomView,
  type FlowTimeView,
} from '../core/flowChartView.ts';

// A 1-minute session: 09:30 through the 16:15 bar is 406 slots.
const SLOTS = 406;

function zoomIn(view: FlowTimeView | null, edge: number, times: number): FlowTimeView | null {
  let v = view;
  for (let i = 0; i < times; i += 1) v = zoomView(v, 1 / ZOOM_STEP, null, SLOTS, edge);
  return v;
}

test('no view is the whole session', () => {
  assert.deepEqual(flowWindow(null, SLOTS, 60), { start: 0, end: SLOTS, span: SLOTS });
});

test('zooming in an hour into the session ends up on that hour and follows it', () => {
  const edge = 60; // 10:30: sixty bars in
  const v = zoomIn(null, edge, 5);
  assert.ok(v);
  const w = flowWindow(v, SLOTS, edge);
  assert.ok(w.span < 60, `span ${w.span}`);
  // The newest bar is on screen, just inside the right edge.
  assert.ok(edge <= w.end && w.end - edge <= edgePad(w.span) + 1e-9, `${w.start}..${w.end}`);
  assert.equal(v.end, null);
  // Ten minutes later the same view has moved with the session.
  const later = flowWindow(v, SLOTS, edge + 10);
  assert.ok(Math.abs(later.end - w.end - 10) < 1e-9);
  assert.equal(later.span, w.span);
});

test('early in a session a wide window starts at the open', () => {
  const v = zoomView(null, 1 / ZOOM_STEP, null, SLOTS, 20);
  const w = flowWindow(v, SLOTS, 20);
  assert.equal(w.start, 0);
  assert.ok(w.end > 20);
});

test('a wheel zoom keeps the bar under the pointer where it is', () => {
  const edge = SLOTS; // a finished session
  const before = flowWindow(null, SLOTS, edge);
  const anchor = 100;
  const at = (anchor - before.start) / before.span;
  const v = zoomView(null, 1 / 1.2, anchor, SLOTS, edge);
  const w = flowWindow(v, SLOTS, edge);
  assert.ok(Math.abs((anchor - w.start) / w.span - at) < 1e-9);
  assert.ok(w.span < before.span);
});

test('zooming stops at the minimum span and zooming out returns the whole session', () => {
  let v: FlowTimeView | null = null;
  for (let i = 0; i < 40; i += 1) v = zoomView(v, 1 / ZOOM_STEP, null, SLOTS, 200);
  assert.equal(flowWindow(v, SLOTS, 200).span, MIN_SPAN);
  for (let i = 0; i < 40; i += 1) v = zoomView(v, ZOOM_STEP, null, SLOTS, 200);
  assert.equal(v, null);
});

test('a pan stops at the open and at the newest bar, and following resumes there', () => {
  const edge = 300;
  const v = zoomIn(null, edge, 6);
  assert.ok(v);
  const span = flowWindow(v, SLOTS, edge).span;
  // Far back: the window starts at the open.
  const back = panView(v, 10_000, SLOTS, edge);
  assert.equal(flowWindow(back, SLOTS, edge).start, 0);
  assert.ok(back && back.end != null);
  // Into the future: held at the newest bar, following it.
  const fwd = panView(back, -10_000, SLOTS, edge);
  assert.equal(fwd?.end, null);
  assert.equal(flowWindow(fwd, SLOTS, edge).span, span);
  // A small pan back, then bars arrive: the window stays where it was put.
  const held = panView(v, 20, SLOTS, edge);
  assert.deepEqual(flowWindow(held, SLOTS, edge + 5), flowWindow(held, SLOTS, edge));
  assert.equal(panView(null, 50, SLOTS, edge), null);
});

test('a button zoom anchors on the newest bar while it is on screen', () => {
  const edge = 250;
  const v = zoomIn(null, edge, 4);
  const w = flowWindow(v, SLOTS, edge);
  assert.ok(edge >= w.start && edge <= w.end);
  // Panned away from it, a button zooms about the middle instead.
  const away = panView(v, 80, SLOTS, edge);
  const wa = flowWindow(away, SLOTS, edge);
  const mid = (wa.start + wa.end) / 2;
  const z = flowWindow(zoomView(away, 1 / ZOOM_STEP, null, SLOTS, edge), SLOTS, edge);
  assert.ok(Math.abs((z.start + z.end) / 2 - mid) < 1e-6);
});

test('time axis labels keep their distance', () => {
  assert.equal(tickStepMinutes(20, 70), 5);
  assert.equal(tickStepMinutes(5, 70), 15);
  assert.equal(tickStepMinutes(2.7, 70), 30);
  assert.equal(tickStepMinutes(0.2, 70), 120);
});

test('the price scale fits what is on screen until the reader zooms or pans it', () => {
  const base = { min: 700, max: 720 };
  assert.deepEqual(applyPriceView(base, FIT_PRICE), base);
  const z = zoomPrice(FIT_PRICE, 0.5);
  assert.deepEqual(applyPriceView(base, z), { min: 705, max: 715 });
  // Panned: centered where the reader put it.
  assert.deepEqual(applyPriceView(base, { zoom: 0.5, center: 712 }), { min: 707, max: 717 });
  // Zoomed back out with nothing panned is the fit itself.
  assert.ok(isFitPrice(zoomPrice(z, 2)));
  // Never past the limits.
  let far = FIT_PRICE;
  for (let i = 0; i < 30; i += 1) far = zoomPrice(far, 0.5);
  assert.ok(far.zoom >= 0.15 - 1e-9);
});
