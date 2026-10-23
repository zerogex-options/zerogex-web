// Unit tests for the Daily Replay's expiration scope — the whole-chain / 0DTE /
// next-Friday switch on /replay/[symbol]/[date]. Three things matter here and
// none of them are cosmetic: an unknown ?exp= must degrade to a page that is
// still true, the All scope must never grow a second URL for an already-indexed
// page, and the rolling 0DTE token must reach the API as a token (the server
// resolves it against the REPLAYED date, which is what keeps a shared link
// meaning what it meant).
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNyseHolidayCalendar, parseNyseHolidays } from '../core/optionsCalendar.ts';
import {
  DEFAULT_REPLAY_SCOPE,
  nextFridayExpiration,
  parseReplayMinute,
  parseReplayScope,
  replayRangeQuery,
  replayScopeHref,
  replayScopeLabel,
  replayScopeExpiration,
  replayScopeParam,
  replayScopeTitle,
  REPLAY_MINUTE_PARAM,
  REPLAY_SCOPE_PARAM,
  REPLAY_SCOPES,
} from '../core/replayScope.ts';

test('a missing or unknown ?exp= opens the whole chain', () => {
  assert.equal(parseReplayScope(undefined), 'all');
  assert.equal(parseReplayScope(null), 'all');
  assert.equal(parseReplayScope(''), 'all');
  assert.equal(parseReplayScope('all'), 'all');
  // A stale or mistyped token is a page that still renders, not a 404.
  assert.equal(parseReplayScope('7dte'), 'all');
  assert.equal(parseReplayScope('0DTE-ish'), 'all');
  assert.equal(DEFAULT_REPLAY_SCOPE, 'all');
});

test('0dte is recognised however it was typed or repeated', () => {
  assert.equal(parseReplayScope('0dte'), '0dte');
  assert.equal(parseReplayScope('0DTE'), '0dte');
  assert.equal(parseReplayScope('  0dte '), '0dte');
  // Next hands a repeated query param back as an array.
  assert.equal(parseReplayScope(['0dte', 'all']), '0dte');
});

test('the All scope keeps the bare dated URL', () => {
  // These dated pages are indexed; ?exp=all would be a second URL competing
  // with itself for the same query.
  assert.equal(replayScopeHref('SPY', '2026-09-15', 'all'), '/replay/SPY/2026-09-15');
  assert.equal(
    replayScopeHref('SPY', '2026-09-15', '0dte'),
    `/replay/SPY/2026-09-15?${REPLAY_SCOPE_PARAM}=0dte`,
  );
});

test('only a real HHMM wall-clock survives as a playhead token', () => {
  assert.equal(parseReplayMinute('0930'), '0930');
  assert.equal(parseReplayMinute('1600'), '1600');
  assert.equal(parseReplayMinute(' 1447 '), '1447');
  assert.equal(parseReplayMinute(undefined), null);
  assert.equal(parseReplayMinute('930'), null);
  assert.equal(parseReplayMinute('14:47'), null);
  // Shape alone is not enough — these are four digits but not a time.
  assert.equal(parseReplayMinute('2460'), null);
  assert.equal(parseReplayMinute('9999'), null);
});

test('the scope toggle carries the playhead across the navigation', () => {
  // Switching scope is a server navigation, so without this the scrubber
  // remounts at the closing bell every time.
  assert.equal(
    replayScopeHref('SPY', '2026-09-15', '0dte', '1447'),
    `/replay/SPY/2026-09-15?${REPLAY_SCOPE_PARAM}=0dte&${REPLAY_MINUTE_PARAM}=1447`,
  );
  assert.equal(
    replayScopeHref('SPY', '2026-09-15', 'all', '1447'),
    `/replay/SPY/2026-09-15?${REPLAY_MINUTE_PARAM}=1447`,
  );
  // A junk minute is dropped rather than propagated into the URL.
  assert.equal(replayScopeHref('SPY', '2026-09-15', 'all', '99:99'), '/replay/SPY/2026-09-15');
  assert.equal(replayScopeHref('SPY', '2026-09-15', 'all', null), '/replay/SPY/2026-09-15');
});

test('the range query omits the scope for All and sends the token for 0DTE', () => {
  const all = new URLSearchParams(
    replayRangeQuery({ symbol: 'SPY', date: '2026-09-15', scope: 'all' }),
  );
  assert.equal(all.get('symbol'), 'SPY');
  assert.equal(all.get('date'), '2026-09-15');
  assert.equal(all.get('timeframe'), '1min');
  assert.equal(all.get('expirations'), null);
  assert.equal(all.get('include_expirations'), null);

  const zero = new URLSearchParams(
    replayRangeQuery({
      symbol: 'SPX',
      date: '2026-09-15',
      scope: '0dte',
      includeExpirations: true,
    }),
  );
  // The literal token, not a date: the server resolves it against the session
  // being replayed, so the client never has to know the chain.
  assert.equal(zero.get('expirations'), '0dte');
  assert.equal(zero.get('include_expirations'), 'true');
  assert.equal(replayScopeParam('0dte', '2026-09-15'), '0dte');
  assert.equal(replayScopeParam('all', '2026-09-15'), 'all');
});

test('every scope has a label and the toggle renders whole chain, then nearest expiry first', () => {
  assert.deepEqual([...REPLAY_SCOPES], ['all', '0dte', 'fri']);
  for (const scope of REPLAY_SCOPES) {
    assert.ok(replayScopeLabel(scope).length > 0);
    assert.ok(replayScopeLabel(scope, '2026-09-15').length > 0);
  }
  assert.equal(replayScopeLabel('0dte'), '0DTE');
});

// ── Next-Friday scope ───────────────────────────────────────────────────────

const NO_HOLIDAYS = buildNyseHolidayCalendar([]);
const HOLIDAYS = buildNyseHolidayCalendar(
  parseNyseHolidays('2026-12-25,2027-01-01,2027-03-26'),
);

test('fri is recognized and keeps its own URL', () => {
  assert.equal(parseReplayScope('fri'), 'fri');
  assert.equal(parseReplayScope(' FRI '), 'fri');
  assert.equal(
    replayScopeHref('SPY', '2026-09-15', 'fri', '1447'),
    `/replay/SPY/2026-09-15?${REPLAY_SCOPE_PARAM}=fri&${REPLAY_MINUTE_PARAM}=1447`,
  );
});

test('next Friday is the coming one, and the following one on a Friday', () => {
  // Mon..Thu of the week of 2026-09-14 all land on Fri 2026-09-18.
  for (const day of ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17']) {
    assert.equal(nextFridayExpiration(day, NO_HOLIDAYS), '2026-09-18', day);
  }
  // A Friday session's own expiry is the 0DTE scope, so Fri skips a week.
  assert.equal(nextFridayExpiration('2026-09-18', NO_HOLIDAYS), '2026-09-25');
  // Across a month and a year boundary.
  assert.equal(nextFridayExpiration('2026-09-30', NO_HOLIDAYS), '2026-10-02');
  assert.equal(nextFridayExpiration('2027-12-29', NO_HOLIDAYS), '2027-12-31');
  assert.equal(nextFridayExpiration('not-a-date', NO_HOLIDAYS), null);
});

test('a holiday Friday walks back to the Thursday the weekly settles on', () => {
  // Christmas 2026 and Good Friday 2027 are Fridays.
  assert.equal(nextFridayExpiration('2026-12-21', HOLIDAYS), '2026-12-24');
  assert.equal(nextFridayExpiration('2027-03-22', HOLIDAYS), '2027-03-25');
  // The Thursday before a holiday Friday IS that week's weekly (its 0DTE), so
  // Fri moves on to the next week — here New Year's Day, also a Friday.
  assert.equal(nextFridayExpiration('2026-12-24', HOLIDAYS), '2026-12-31');
  // Without a holiday list the Friday comes back as-is.
  assert.equal(nextFridayExpiration('2026-12-21', NO_HOLIDAYS), '2026-12-25');
});

test('the range query sends the resolved Friday date for fri', () => {
  const fri = new URLSearchParams(
    replayRangeQuery({ symbol: 'SPY', date: '2026-09-15', scope: 'fri', includeExpirations: true }),
  );
  // No server-side token for this one: the endpoint takes YYYY-MM-DD lists.
  assert.equal(fri.get('expirations'), '2026-09-18');
  assert.equal(replayScopeExpiration('fri', '2026-09-18'), '2026-09-25');
  assert.equal(replayScopeExpiration('0dte', '2026-09-15'), '2026-09-15');
  assert.equal(replayScopeExpiration('all', '2026-09-15'), null);
});

test('the fri label and tooltip name the date it resolved to', () => {
  assert.equal(replayScopeLabel('fri', '2026-09-15'), 'Fri 9/18');
  assert.equal(replayScopeLabel('fri', '2026-09-18'), 'Fri 9/25');
  assert.equal(replayScopeLabel('fri'), 'Next Fri');
  assert.match(replayScopeTitle('fri', '2026-09-15'), /2026-09-18/);
});
