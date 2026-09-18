// Unit tests for the Daily Replay's expiration scope — the 0DTE / whole-chain
// switch on /replay/[symbol]/[date]. Three things matter here and none of them
// are cosmetic: an unknown ?exp= must degrade to a page that is still true, the
// All scope must never grow a second URL for an already-indexed page, and the
// rolling 0DTE token must reach the API as a token (the server resolves it
// against the REPLAYED date, which is what keeps a shared link meaning what it
// meant).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_REPLAY_SCOPE,
  parseReplayMinute,
  parseReplayScope,
  replayRangeQuery,
  replayScopeHref,
  replayScopeLabel,
  replayScopeParam,
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
  assert.equal(replayScopeParam('0dte'), '0dte');
  assert.equal(replayScopeParam('all'), 'all');
});

test('every scope has a label and the toggle renders widest book first', () => {
  assert.deepEqual([...REPLAY_SCOPES], ['all', '0dte']);
  for (const scope of REPLAY_SCOPES) {
    assert.ok(replayScopeLabel(scope).length > 0);
  }
  assert.equal(replayScopeLabel('0dte'), '0DTE');
});
