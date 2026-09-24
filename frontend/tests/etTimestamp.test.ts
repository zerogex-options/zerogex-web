import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { etUtcOffsetLabel, formatEtTime, formatEtTimestamp } from '../core/etTimestamp.ts';

// Newer ICU builds put a narrow no-break space before AM/PM. The label is for
// people, so compare it the way a reader sees it.
const plain = (s: string | null) => (s == null ? s : s.replace(/\s/g, ' '));

test('a 08:00Z stamp in September reads as 4:00 AM daylight time, UTC−4', () => {
  // Action Card #11270 — the pre-market call the raw ISO string disguised.
  assert.equal(
    plain(formatEtTimestamp('2026-09-23T08:00:00+00:00')),
    'Sep 23, 2026, 4:00 AM EDT (UTC−4)',
  );
});

test('winter stamps read as standard time, UTC−5', () => {
  assert.equal(
    plain(formatEtTimestamp('2026-01-15T14:30:00Z')),
    'Jan 15, 2026, 9:30 AM EST (UTC−5)',
  );
});

test('the offset follows the DST switch, not the calendar month', () => {
  // 2026-03-08: clocks jump 02:00 EST → 03:00 EDT at 07:00Z.
  assert.equal(etUtcOffsetLabel(new Date('2026-03-08T06:59:00Z')), 'UTC−5');
  assert.equal(etUtcOffsetLabel(new Date('2026-03-08T07:00:00Z')), 'UTC−4');
  // 2026-11-01: clocks fall back 02:00 EDT → 01:00 EST at 06:00Z.
  assert.equal(etUtcOffsetLabel(new Date('2026-11-01T05:59:00Z')), 'UTC−4');
  assert.equal(etUtcOffsetLabel(new Date('2026-11-01T06:00:00Z')), 'UTC−5');
});

test('an instant after UTC midnight still lands on the Eastern evening before', () => {
  assert.equal(
    plain(formatEtTimestamp('2026-09-24T02:15:00Z')),
    'Sep 23, 2026, 10:15 PM EDT (UTC−4)',
  );
});

test('time-only label for rows under a dated heading', () => {
  assert.equal(plain(formatEtTime('2026-09-23T08:00:00Z')), '4:00 AM');
  assert.equal(plain(formatEtTime('2026-09-23T13:30:00Z')), '9:30 AM');
  assert.equal(plain(formatEtTime('2026-09-23T20:00:00Z')), '4:00 PM');
});

test('missing or unparseable input yields null, never "Invalid Date"', () => {
  for (const bad of [undefined, null, '', 'not-a-date']) {
    assert.equal(formatEtTimestamp(bad), null);
    assert.equal(formatEtTime(bad), null);
  }
});
