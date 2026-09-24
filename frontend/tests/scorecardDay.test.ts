import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { scorecardHrefForCard } from '../core/scorecardDay.ts';

test('a card links to its own symbol and Eastern date', () => {
  // Card #11418: SPY, 3:47 PM EDT on Sep 23.
  assert.equal(
    scorecardHrefForCard('SPY', '2026-09-23T19:47:00+00:00'),
    '/scorecard/SPY/2026-09-23',
  );
  assert.equal(scorecardHrefForCard('qqq', '2026-09-23T13:30:00Z'), '/scorecard/QQQ/2026-09-23');
});

test('the day is the Eastern date, not the UTC date', () => {
  // 8:30 PM EDT on Sep 23 is already Sep 24 in UTC.
  assert.equal(scorecardHrefForCard('QQQ', '2026-09-24T00:30:00Z'), '/scorecard/QQQ/2026-09-23');
  // In winter the evening boundary moves to 7:00 PM EST.
  assert.equal(scorecardHrefForCard('SPY', '2026-01-16T00:30:00Z'), '/scorecard/SPY/2026-01-15');
});

test('a symbol without Scorecard pages falls back to the landing page', () => {
  // The Scorecard reads unknown symbols as SPY, so a day link would show SPY.
  assert.equal(scorecardHrefForCard('IWM', '2026-09-23T19:47:00Z'), '/scorecard');
});

test('a card without a usable timestamp keeps the old landing link', () => {
  assert.equal(scorecardHrefForCard('QQQ', undefined), '/scorecard?symbol=QQQ');
  assert.equal(scorecardHrefForCard('SPY', 'not-a-date'), '/scorecard');
  assert.equal(scorecardHrefForCard(undefined, '2026-09-23T19:47:00Z'), '/scorecard/SPY/2026-09-23');
});
