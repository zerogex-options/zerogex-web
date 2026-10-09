// Unit tests for the Gamma Chart's prior-day / pre-market levels row
// (PDH · PDL · PDC · PMH · PML) and the lines it can draw.
//
// The rules a trader can be misled by:
//   • PDC must be the close of the same session PDH and PDL describe. The two
//     endpoints roll at different times (04:00 vs 16:00 ET), so through
//     after-hours "the current close" is today's while the range is still
//     yesterday's;
//   • a missing or zero value is left out, never drawn as a $0 line;
//   • rewound into an earlier day, today's levels are not shown at all, and
//     rewound into the pre-market, the pre-market high and low (which were
//     still being made) are not shown.
import test from 'node:test';
import assert from 'node:assert/strict';

import { chartSessionLevels, closeForSession } from '../core/sessionLevels.ts';
import type { SessionClosesData, SessionLevelsData } from '../hooks/useApiData.ts';

// Thursday 2026-10-08's levels, as served on Friday 2026-10-09.
const LEVELS: SessionLevelsData = {
  symbol: 'SPY',
  is_index: false,
  trading_date: '2026-10-09',
  premarket_high: 777.78,
  premarket_low: 775.74,
  prev_session_date: '2026-10-08',
  prev_session_high: 777.09,
  prev_session_low: 770.44,
};

// During Friday's cash session: the most recent completed close is Thursday's.
const CLOSES_OPEN: SessionClosesData = {
  symbol: 'SPY',
  current_session_close: 773.96,
  current_session_close_ts: '2026-10-08T20:00:00Z',
  prior_session_close: 771.2,
  prior_session_close_ts: '2026-10-07T20:00:00Z',
};

// Friday after-hours: session-closes has rolled to Friday's close, while
// session-levels still describes Thursday until 04:00 ET Monday.
const CLOSES_AFTER_HOURS: SessionClosesData = {
  symbol: 'SPY',
  current_session_close: 778.5,
  current_session_close_ts: '2026-10-09T20:00:00Z',
  prior_session_close: 773.96,
  prior_session_close_ts: '2026-10-08T20:00:00Z',
};

const pairs = (levels: ReturnType<typeof chartSessionLevels>) => levels.map((l) => [l.label, l.value]);

test('live: all five levels in display order', () => {
  assert.deepEqual(pairs(chartSessionLevels({ levels: LEVELS, closes: CLOSES_OPEN })), [
    ['PDH', 777.09],
    ['PDL', 770.44],
    ['PDC', 773.96],
    ['PMH', 777.78],
    ['PML', 775.74],
  ]);
});

test('PDC is the close of the session PDH and PDL describe, not the latest close', () => {
  assert.equal(closeForSession(CLOSES_OPEN, '2026-10-08'), 773.96);
  assert.equal(closeForSession(CLOSES_AFTER_HOURS, '2026-10-08'), 773.96,
    'after-hours, the latest close is today\'s; the prior day\'s is the one before it');
  const pdc = chartSessionLevels({ levels: LEVELS, closes: CLOSES_AFTER_HOURS }).find((l) => l.key === 'pdc');
  assert.equal(pdc?.value, 773.96);
});

test('no PDC when neither close is dated to the previous session', () => {
  assert.equal(closeForSession(CLOSES_OPEN, '2026-10-02'), null);
  assert.equal(closeForSession(null, '2026-10-08'), null);
  assert.equal(closeForSession(CLOSES_OPEN, null), null);
  const keys = chartSessionLevels({ levels: { ...LEVELS, prev_session_date: '2026-10-02' }, closes: CLOSES_OPEN }).map((l) => l.key);
  assert.deepEqual(keys, ['pdh', 'pdl', 'pmh', 'pml']);
});

test('missing, zero and non-numeric values are left out, never drawn at $0', () => {
  const keys = chartSessionLevels({
    levels: { ...LEVELS, premarket_high: null, premarket_low: 0, prev_session_low: Number.NaN },
    closes: null,
  }).map((l) => l.key);
  assert.deepEqual(keys, ['pdh']);
});

test('numeric strings from the API are accepted', () => {
  const levels = { ...LEVELS, prev_session_high: '777.09' as unknown as number };
  assert.equal(chartSessionLevels({ levels, closes: null })[0].value, 777.09);
});

test('nothing for an index payload or before the data arrives', () => {
  assert.deepEqual(chartSessionLevels({ levels: { ...LEVELS, is_index: true }, closes: CLOSES_OPEN }), []);
  assert.deepEqual(chartSessionLevels({ levels: null, closes: CLOSES_OPEN }), []);
  assert.deepEqual(chartSessionLevels({ levels: undefined, closes: undefined }), []);
});

test('rewound into the same trading day, after the open: everything shows', () => {
  // 10:30 ET on 2026-10-09.
  const asOf = Date.parse('2026-10-09T14:30:00Z');
  assert.equal(chartSessionLevels({ levels: LEVELS, closes: CLOSES_OPEN, asOf }).length, 5);
});

test('rewound into the pre-market: the prior day shows, the unfinished pre-market does not', () => {
  // 08:15 ET on 2026-10-09.
  const keys = chartSessionLevels({ levels: LEVELS, closes: CLOSES_OPEN, asOf: '2026-10-09T12:15:00Z' }).map((l) => l.key);
  assert.deepEqual(keys, ['pdh', 'pdl', 'pdc']);
  // 09:30 ET exactly: the pre-market is over.
  assert.equal(chartSessionLevels({ levels: LEVELS, closes: CLOSES_OPEN, asOf: '2026-10-09T13:30:00Z' }).length, 5);
});

test('rewound into an earlier day: nothing, rather than levels that had not happened yet', () => {
  // 15:00 ET on 2026-10-08, the session PDH and PDL describe.
  assert.deepEqual(chartSessionLevels({ levels: LEVELS, closes: CLOSES_OPEN, asOf: Date.parse('2026-10-08T19:00:00Z') }), []);
});

test('rewound with no trading date to check against: nothing', () => {
  assert.deepEqual(
    chartSessionLevels({ levels: { ...LEVELS, trading_date: null }, closes: CLOSES_OPEN, asOf: Date.parse('2026-10-09T14:30:00Z') }),
    [],
  );
});

test('the ET date is used, not the UTC one', () => {
  // 21:00 ET on 2026-10-09 is already 2026-10-10 in UTC.
  const asOf = '2026-10-10T01:00:00Z';
  assert.equal(chartSessionLevels({ levels: LEVELS, closes: CLOSES_AFTER_HOURS, asOf }).length, 5);
});
