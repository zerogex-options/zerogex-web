// Pair Comparison's replay session picker (core/pairReplaySessions.ts): which
// days the two columns can replay together. The cases that matter are the ones
// that put a column on the wrong day or on a day with blank ladders: two
// symbols whose histories differ, days whose per-strike rows have aged out
// (the API's has_strikes flag, or the 60-day fallback when it gives none), and
// a pick that stops being valid when a symbol changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  pairReplaySessionOptions,
  resolvePairReplayDate,
  sessionLacksStrikes,
  strikeRetentionCutoff,
  SESSION_LIST_LIMIT,
  STRIKE_RETENTION_DAYS,
  type ListedSession,
} from '../core/pairReplaySessions.ts';

// Weekday sessions from `from` to `to` inclusive, newest first, the order
// /api/replay/sessions lists them in. Holidays don't matter to these tests.
function sessions(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    const day = new Date(t);
    const dow = day.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(day.toISOString().slice(0, 10));
  }
  return out.reverse();
}

// Those days as /api/replay/sessions rows. Without `hasStrikes` they carry no
// has_strikes field at all: the shape an API from before the field sends.
function rows(dates: readonly string[], hasStrikes?: (date: string) => boolean | null): ListedSession[] {
  return dates.map((date) => (hasStrikes ? { date, has_strikes: hasStrikes(date) } : { date }));
}

test('the retention cutoff is 60 calendar days back from today in ET', () => {
  assert.equal(STRIKE_RETENTION_DAYS, 60);
  // The customer's case: on Nov 7, 2026 strike rows existed from Sep 8.
  assert.equal(strikeRetentionCutoff('2026-11-07'), '2026-09-08');
  // Across a month end and a year end.
  assert.equal(strikeRetentionCutoff('2026-03-01'), '2025-12-31');
  assert.equal(strikeRetentionCutoff('2026-11-07', 30), '2026-10-08');
  // An unusable key means no cutoff rather than a wrong one.
  assert.equal(strikeRetentionCutoff(''), '');
  assert.equal(strikeRetentionCutoff('Nov 7'), '');
});

test('the session list reaches past the retention window', () => {
  // 60 trading sessions are at least 84 calendar days, so the oldest kept day
  // is always in the list the API returns.
  assert.ok(Math.floor(SESSION_LIST_LIMIT / 5) * 7 >= STRIKE_RETENTION_DAYS);
  assert.ok(SESSION_LIST_LIMIT <= 180, 'the API caps limit at 180');
});

test('only days both symbols list are offered, newest first', () => {
  // ES follows SPX, NQ follows NDX, and NDX history starts later.
  const es = sessions('2026-08-14', '2026-11-06');
  const nq = sessions('2026-09-21', '2026-11-06');
  const options = pairReplaySessionOptions(rows(es), rows(nq), '2026-11-07');
  assert.equal(options[0], '2026-11-06');
  assert.equal(options.at(-1), '2026-09-21');
  for (const d of options) assert.ok(es.includes(d) && nq.includes(d), `${d} is on both lists`);
  assert.deepEqual(options, [...options].sort().reverse(), 'newest first');
  // A day missing from one side (a feed outage on NQ) is not offered.
  const gap = nq.filter((d) => d !== '2026-11-02');
  assert.ok(!pairReplaySessionOptions(rows(es), rows(gap), '2026-11-07').includes('2026-11-02'));
});

test('an API without has_strikes falls back to the 60-day cutoff, exactly as before', () => {
  // gex_summary is never pruned, so the list runs back to Aug 14; the strike
  // rows only go back to Sep 8. An API from before the flag can't say so, and
  // the cutoff does. (Every other case here built with rows() and no flag is
  // the same check.)
  const es = rows(sessions('2026-08-14', '2026-11-06'));
  const spx = rows(sessions('2026-08-14', '2026-11-06'));
  assert.ok([...es, ...spx].every((s) => !('has_strikes' in s)), 'no field at all');
  const options = pairReplaySessionOptions(es, spx, '2026-11-07');
  assert.deepEqual(options, sessions('2026-09-08', '2026-11-06'));
  assert.ok(!options.includes('2026-09-04'));
  // Monday, Nov 2 is on offer: the customer's "replay an earlier day".
  assert.ok(options.includes('2026-11-02'));
});

test('a day flagged has_strikes false is left out, even inside 60 days', () => {
  const days = sessions('2026-08-14', '2026-11-06');
  // Had DATA_RETENTION_DAYS dropped to 30, the API flags every day before
  // Oct 8, and the picker follows it. The 60-day fallback alone would still
  // offer Sep 8 to Oct 7.
  const fallback = pairReplaySessionOptions(rows(days), rows(days), '2026-11-07');
  assert.ok(fallback.includes('2026-09-08') && fallback.includes('2026-10-07'));
  const kept30 = (d: string) => d >= strikeRetentionCutoff('2026-11-07', 30);
  assert.deepEqual(
    pairReplaySessionOptions(rows(days, kept30), rows(days, kept30), '2026-11-07'),
    sessions('2026-10-08', '2026-11-06'),
  );
  // Either symbol's flag is enough, whatever the other side says: the pair
  // replays one day, and a ladder with no rows on it would be blank.
  const flagged = rows(days, (d) => d !== '2026-11-02');
  for (const other of [rows(days, () => true), rows(days, () => null), rows(days)]) {
    for (const [left, right] of [[flagged, other], [other, flagged]]) {
      const options = pairReplaySessionOptions(left, right, '2026-11-07');
      assert.ok(!options.includes('2026-11-02'), 'Nov 2 is left out');
      assert.ok(options.includes('2026-10-30') && options.includes('2026-11-03'), 'its neighbors stay');
    }
  }
});

test('a day flagged has_strikes true or null is kept or cut exactly as before', () => {
  const days = sessions('2026-08-14', '2026-11-06');
  const before = sessions('2026-09-08', '2026-11-06');
  // What the API answers on Nov 7: strike rows from Sep 8 on, so true from
  // there and false before it. The same days the cutoff kept.
  const onFile = rows(days, (d) => d >= '2026-09-08');
  assert.deepEqual(pairReplaySessionOptions(onFile, onFile, '2026-11-07'), before);
  // null is the API saying it couldn't check, so the cutoff stands in, as
  // before: on both sides, or on one side whatever the other says.
  const unchecked = rows(days, () => null);
  assert.deepEqual(pairReplaySessionOptions(unchecked, unchecked, '2026-11-07'), before);
  assert.deepEqual(pairReplaySessionOptions(onFile, unchecked, '2026-11-07'), before);
  assert.deepEqual(pairReplaySessionOptions(unchecked, rows(days, () => true), '2026-11-07'), before);
  // The other shapes answer as they did, too. (A true day past the 60 days is
  // the one difference; see the next case.)
  const spy = sessions('2026-10-01', '2026-11-06');
  assert.deepEqual(pairReplaySessionOptions(rows(spy, () => true), [], '2026-11-07'), spy);
  assert.deepEqual(pairReplaySessionOptions([], rows(spy, () => null), '2026-11-07'), spy);
  const stale = rows(['2026-07-02', '2026-07-01'], () => null);
  assert.deepEqual(pairReplaySessionOptions(stale, stale, '2026-11-07'), ['2026-07-02']);
  // An unusable today key still means no cutoff rather than a wrong one.
  assert.deepEqual(pairReplaySessionOptions(unchecked, unchecked, ''), days);
});

test('a day flagged true stays on offer past the 60-day fallback', () => {
  // The flag, not the mirror, follows DATA_RETENTION_DAYS: had it been raised
  // to 90, the API vouches for every listed day and the picker offers them
  // all. On today's 60 days this is only the extra day that survives from
  // midnight to the 02:00 ET prune, and that day does have its rows.
  const days = sessions('2026-08-14', '2026-11-06');
  const vouched = rows(days, () => true);
  assert.deepEqual(pairReplaySessionOptions(vouched, vouched, '2026-11-07'), days);
});

test('the newest shared day is always offered, even past the window or flagged', () => {
  // A pair whose newest shared day is older than the window still opens on it,
  // as Replay did before the picker; its own frames then say whether its
  // ladders have rows.
  const stale = ['2026-07-02', '2026-07-01'];
  assert.deepEqual(pairReplaySessionOptions(rows(stale), rows(stale), '2026-11-07'), ['2026-07-02']);
  // Likewise a symbol with no strike rows on file at all: every day flagged.
  const days = sessions('2026-10-01', '2026-11-06');
  assert.deepEqual(
    pairReplaySessionOptions(rows(days, () => true), rows(days, () => false), '2026-11-07'),
    ['2026-11-06'],
  );
  // And a newest day flagged on its own keeps its place at the top.
  const newestFlagged = rows(days, (d) => d !== '2026-11-06');
  assert.deepEqual(pairReplaySessionOptions(newestFlagged, rows(days, () => true), '2026-11-07'), days);
});

test('a side with nothing to replay does not blank the other column', () => {
  // A symbol with no replay history (or a list that failed to load) can't
  // narrow the day. The other column replays as it did before the menu.
  const spy = sessions('2026-10-01', '2026-11-06');
  assert.deepEqual(pairReplaySessionOptions(rows(spy), [], '2026-11-07'), spy);
  assert.deepEqual(pairReplaySessionOptions([], rows(spy), '2026-11-07'), spy);
  assert.deepEqual(pairReplaySessionOptions([], [], '2026-11-07'), []);
  // The side that stands in still brings its own flags.
  const flagged = rows(spy, (d) => d !== '2026-11-02');
  assert.ok(!pairReplaySessionOptions(flagged, [], '2026-11-07').includes('2026-11-02'));
  // Two histories with no day in common share nothing: the columns never
  // replay different days.
  assert.deepEqual(pairReplaySessionOptions(rows(['2026-11-06']), rows(['2026-11-05']), '2026-11-07'), []);
});

test('junk and duplicate dates are dropped', () => {
  const options = pairReplaySessionOptions(
    rows(['2026-11-06', '2026-11-06', 'bad', '2026-11-05']),
    rows(['2026-11-05', '2026-11-06', 'bad']),
    '2026-11-07',
  );
  assert.deepEqual(options, ['2026-11-06', '2026-11-05']);
});

test('a pick holds while it is offered, and falls back to the newest when it is not', () => {
  const options = ['2026-11-06', '2026-11-05', '2026-11-02'];
  // No pick follows the newest day: Replay's behavior before the picker.
  assert.equal(resolvePairReplayDate(null, options), '2026-11-06');
  assert.equal(resolvePairReplayDate('2026-11-02', options), '2026-11-02');
  // A symbol change to one without that day.
  assert.equal(resolvePairReplayDate('2026-08-20', options), '2026-11-06');
  assert.equal(resolvePairReplayDate('2026-11-02', []), null);
  assert.equal(resolvePairReplayDate(null, []), null);
});

test('a session with frames but no strike rows anywhere reads as missing strikes', () => {
  assert.equal(sessionLacksStrikes([{ strikes: [] }, { strikes: [] }]), true);
  assert.equal(sessionLacksStrikes([{ strikes: null }, {}]), true);
  // One minute with rows is a session with a ladder.
  assert.equal(sessionLacksStrikes([{ strikes: [] }, { strikes: [{ strike: 6800, net_gex: 1 }] }]), false);
  // No frames at all is a different state (nothing loaded, or nothing written).
  assert.equal(sessionLacksStrikes([]), false);
});

// ---- wiring (checked at the source, like tests/rewindDefaults.test.ts) ------

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('both columns load the one resolved day, and only the newest polls', () => {
  const page = read('../app/pair-comparison/PairComparisonClient.tsx');
  assert.match(page, /const sessionDate = resolvePairReplayDate\(pickedDate, sessions\.dates\);/);
  assert.match(page, /const pollNewest = mode === "replay" && sessionDate != null && sessionDate === newestDate;/);
  assert.match(page, /usePairReplay\(sym1, sessionDate, replayArmed, pollNewest\)/);
  assert.match(page, /usePairReplay\(sym2, sessionDate, replayArmed, pollNewest\)/);
  // Choosing the newest day goes back to following it, as Replay always did.
  assert.match(page, /setPickedDate\(date === newestDate \? null : date\);/);
});

test('a reloading session list keeps the day on screen', () => {
  const hook = read('../hooks/usePairReplay.ts');
  // Without the hold, changing column 2's symbol would drop column 1's
  // buffered session and fetch it again.
  assert.match(hook, /if \(!loading && !sameDates\(dates, listed\)\) setDates\(listed\);/);
  assert.match(hook, /limit=\$\{SESSION_LIST_LIMIT\}/);
  assert.doesNotMatch(hook, /limit=1\b/);
});
