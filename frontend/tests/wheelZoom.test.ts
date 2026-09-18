// Unit tests for the wheel-intent rule shared by every zoomable chart.
//
// The behaviour under test is a scroll-trap fix: charts used to preventDefault
// every wheel event over their drawing surface, so a reader scrolling down a
// page full of charts would stop dead and zoom a chart by accident. A bare
// wheel must therefore resolve to 'page-scroll' — that is the whole point, and
// the case most worth pinning down against a future refactor.
import test from 'node:test';
import assert from 'node:assert/strict';

import { wheelAction, isZoomGesture } from '../core/wheelZoom.ts';

/** No modifiers, not over the price axis — someone scrolling past. */
const bare = { ctrlKey: false, metaKey: false, shiftKey: false };

test('a bare wheel lets the page scroll', () => {
  assert.equal(wheelAction(bare), 'page-scroll');
  assert.equal(wheelAction({ ...bare, overPriceAxis: false }), 'page-scroll');
  assert.equal(isZoomGesture(bare), false);
});

test('Ctrl and Cmd zoom the time axis', () => {
  assert.equal(wheelAction({ ...bare, ctrlKey: true }), 'zoom-time');
  assert.equal(wheelAction({ ...bare, metaKey: true }), 'zoom-time');
  assert.equal(isZoomGesture({ ...bare, ctrlKey: true }), true);
});

test('trackpad pinch zooms, because the browser sends it as ctrl+wheel', () => {
  // A pinch arrives as a wheel event with ctrlKey set and no key held down.
  assert.equal(wheelAction({ ...bare, ctrlKey: true }), 'zoom-time');
});

test('Shift zooms the price axis', () => {
  assert.equal(wheelAction({ ...bare, shiftKey: true }), 'zoom-price');
  assert.equal(isZoomGesture({ ...bare, shiftKey: true }), true);
});

test('the price scale is an aimed target, so a bare wheel there zooms price', () => {
  // The escape hatch for anyone who liked wheel-zoom: you cannot land on the
  // right-hand scale by accident on your way down the page.
  assert.equal(wheelAction({ ...bare, overPriceAxis: true }), 'zoom-price');
  assert.equal(isZoomGesture({ ...bare, overPriceAxis: true }), true);
});

test('an explicitly named axis beats the generic Ctrl zoom', () => {
  // Ctrl+Shift and Ctrl-over-the-scale both name the price axis outright.
  assert.equal(wheelAction({ ...bare, ctrlKey: true, shiftKey: true }), 'zoom-price');
  assert.equal(wheelAction({ ...bare, ctrlKey: true, overPriceAxis: true }), 'zoom-price');
  assert.equal(wheelAction({ ...bare, metaKey: true, shiftKey: true }), 'zoom-price');
});

test('every modifier combination that zooms also reports as a zoom gesture', () => {
  for (const ctrlKey of [false, true]) {
    for (const metaKey of [false, true]) {
      for (const shiftKey of [false, true]) {
        for (const overPriceAxis of [false, true]) {
          const input = { ctrlKey, metaKey, shiftKey, overPriceAxis };
          const zooms = wheelAction(input) !== 'page-scroll';
          assert.equal(isZoomGesture(input), zooms);
          // The only way to get the page back is to ask for nothing at all.
          assert.equal(zooms, ctrlKey || metaKey || shiftKey || overPriceAxis);
        }
      }
    }
  }
});
