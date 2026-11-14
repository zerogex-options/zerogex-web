// After the 16:00 ET close the live surfaces show the session's final reading.
// These pin when they start saying "closed" instead of "live", and how a
// reading from an earlier day is named, in both daylight-saving seasons.
import test from 'node:test';
import assert from 'node:assert/strict';

import { readingLabel, sessionHasClosed } from '../core/sessionClosed.ts';

const at = (iso: string) => Date.parse(iso);

test('a session closes at 16:00 ET, not before', () => {
  // Summer (EDT) and winter (EST).
  assert.equal(sessionHasClosed('2026-10-29', at('2026-10-29T15:59:00-04:00')), false);
  assert.equal(sessionHasClosed('2026-10-29', at('2026-10-29T16:00:00-04:00')), true);
  assert.equal(sessionHasClosed('2026-10-29', at('2026-10-29T16:13:00-04:00')), true);
  assert.equal(sessionHasClosed('2026-12-01', at('2026-12-01T15:59:00-05:00')), false);
  assert.equal(sessionHasClosed('2026-12-01', at('2026-12-01T16:00:00-05:00')), true);
});

test('an earlier session stays closed overnight, over a weekend, and before the open', () => {
  assert.equal(sessionHasClosed('2026-11-13', at('2026-11-14T10:00:00-05:00')), true); // Saturday
  assert.equal(sessionHasClosed('2026-11-13', at('2026-11-16T08:00:00-05:00')), true); // Monday pre-open
  // Late evening ET is already the next UTC day; the ET date still decides.
  assert.equal(sessionHasClosed('2026-11-13', at('2026-11-13T22:30:00-05:00')), true);
});

test('an unknown session is never called closed', () => {
  assert.equal(sessionHasClosed(null, at('2026-11-14T10:00:00-05:00')), false);
  assert.equal(sessionHasClosed('', at('2026-11-14T10:00:00-05:00')), false);
});

test('a reading from today shows its time; from an earlier day, its weekday too', () => {
  const lastRead = at('2026-11-13T15:59:00-05:00'); // Friday
  assert.equal(readingLabel(lastRead, at('2026-11-13T16:13:00-05:00')), '15:59 ET');
  assert.equal(readingLabel(lastRead, at('2026-11-16T08:00:00-05:00')), 'Fri 15:59 ET');
  assert.equal(readingLabel(null, at('2026-11-13T16:13:00-05:00')), '--:-- ET');
});
