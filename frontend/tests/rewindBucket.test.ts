// Unit tests for core/rewindBucket — which strike-profile bucket a rewound
// moment may read its dealer levels from.
//
// The rule has exactly one job, and the chart got it wrong in a way scrubbing
// does not make obvious: it took the NEAREST bucket in either direction, so a
// replay clock sitting at 10:03 on a five-minute grid read the bucket measured
// at 10:05 and drew the flip, walls and pin two minutes into that bar's future.
// On a surface whose entire claim is "as it looked then", levels that move
// before the tape that moved them are the failure. So these tests are written
// as the two properties that matter — never forward, never across a session —
// rather than as a lookup table.
import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveRewindBucket } from '../core/rewindBucket.ts';

// 2026-09-15 is a Tuesday; ET is UTC-4 (EDT) on that date.
const at = (etHour: number, etMinute: number, day = 15) =>
  `2026-09-${String(day).padStart(2, '0')}T${String(etHour + 4).padStart(2, '0')}:${String(etMinute).padStart(2, '0')}:00.000Z`;
const ms = (iso: string) => new Date(iso).getTime();

const SESSION = [
  { timestamp: at(9, 35) },
  { timestamp: at(9, 40) },
  { timestamp: at(10, 0) },
  { timestamp: at(10, 5) },
];

test('an anchor exactly on a bucket takes that bucket', () => {
  const bucket = resolveRewindBucket(SESSION, ms(at(10, 0)), 'SPY');
  assert.equal(bucket?.timestamp, at(10, 0));
});

test('an anchor between buckets takes the EARLIER one, never the nearer later one', () => {
  // The regression. 10:03 is 2 minutes from 10:05 and 3 from 10:00; the old
  // nearest-match returned 10:05 — a reading from the anchor's future.
  const bucket = resolveRewindBucket(SESSION, ms(at(10, 3)), 'SPY');
  assert.equal(bucket?.timestamp, at(10, 0), 'the newest bucket AT OR BEFORE the anchor');
});

test('resolution never reaches forward, however close the next bucket is', () => {
  // One second before a bucket still must not read it.
  const bucket = resolveRewindBucket(SESSION, ms(at(10, 5)) - 1000, 'SPY');
  assert.equal(bucket?.timestamp, at(10, 0));
});

test('an anchor before the session’s first bucket resolves to nothing', () => {
  // The caller draws no levels. There is no reading yet, and the nearest one
  // is in the future — which is the case this rule exists to refuse.
  assert.equal(resolveRewindBucket(SESSION, ms(at(9, 31)), 'SPY'), null);
});

test('the carry never crosses a session boundary on a cash symbol', () => {
  // Yesterday's close is not a reading about this morning: an anchor at
  // Wednesday's open with only Tuesday's buckets behind it resolves to null
  // rather than importing a session that had already settled.
  const anchor = ms(at(9, 35, 16));
  assert.equal(resolveRewindBucket(SESSION, anchor, 'SPY'), null);

  // …and it DOES resolve once that session has a bucket of its own.
  const withWednesday = [...SESSION, { timestamp: at(9, 30, 16) }];
  assert.equal(resolveRewindBucket(withWednesday, anchor, 'SPY')?.timestamp, at(9, 30, 16));
});

test('a futures overnight session is one session, not two calendar dates', () => {
  // The CME session opens 18:00 ET and settles the NEXT day, so an anchor at
  // 19:00 ET Tuesday and a bucket at 18:30 ET Tuesday are the same session —
  // keying on the ET date alone would split it (see tradingSessionKeyFor).
  const overnight = [
    { timestamp: at(16, 0) },   // Tuesday RTH — the PREVIOUS session
    { timestamp: at(18, 30) },  // Tuesday evening — Wednesday's session
  ];
  const anchor = ms(at(19, 0));
  assert.equal(resolveRewindBucket(overnight, anchor, 'ES')?.timestamp, at(18, 30));

  // The same data read as a cash symbol keys on the ET date, so 16:00 is in
  // scope — the guard is symbol-aware, not a fixed clock rule.
  assert.equal(resolveRewindBucket(overnight, anchor, 'SPY')?.timestamp, at(18, 30));
  assert.equal(resolveRewindBucket([{ timestamp: at(16, 0) }], anchor, 'SPY')?.timestamp, at(16, 0));
  assert.equal(resolveRewindBucket([{ timestamp: at(16, 0) }], anchor, 'ES'), null);
});

test('the answer does not depend on the order buckets arrive in', () => {
  const shuffled = [SESSION[3], SESSION[0], SESSION[2], SESSION[1]];
  assert.equal(
    resolveRewindBucket(shuffled, ms(at(10, 3)), 'SPY')?.timestamp,
    resolveRewindBucket(SESSION, ms(at(10, 3)), 'SPY')?.timestamp,
  );
});

test('an unparseable bucket timestamp is skipped, not preferred', () => {
  const withJunk = [{ timestamp: 'not-a-date' }, ...SESSION];
  assert.equal(resolveRewindBucket(withJunk, ms(at(10, 3)), 'SPY')?.timestamp, at(10, 0));
});

test('missing inputs resolve to nothing rather than guessing', () => {
  assert.equal(resolveRewindBucket(SESSION, null, 'SPY'), null);
  assert.equal(resolveRewindBucket(SESSION, undefined, 'SPY'), null);
  assert.equal(resolveRewindBucket(SESSION, NaN, 'SPY'), null);
  assert.equal(resolveRewindBucket([], ms(at(10, 3)), 'SPY'), null);
});

test('resolving a prefix gives the same answer as resolving the whole window', () => {
  // The property that makes a rewound bar identical to the live write it
  // stands in for: bar i is decided by buckets <= i only, so buckets that
  // arrive later cannot change an answer already given.
  const anchor = ms(at(10, 3));
  const prefix = SESSION.filter((b) => ms(b.timestamp) <= anchor);
  assert.equal(
    resolveRewindBucket(prefix, anchor, 'SPY')?.timestamp,
    resolveRewindBucket(SESSION, anchor, 'SPY')?.timestamp,
  );
});
