// Unit tests for the Spread Surface readouts.
//
// This is the only part of the Spread Monitor that RANKS rather than
// measures, so it is the only part that can be confidently wrong. Each test
// below is a way of being confidently wrong that the page must not be:
//
//   * printing a date range that spans more sessions than the comparison
//     actually used;
//   * saying "normal" on a scope with no stored history, which reads
//     identically to a page that checked;
//   * naming the WIDEST expiry when the finding is the most UNUSUAL one —
//     0DTE is the widest book every day of the year and says nothing;
//   * drifting away from the thresholds the rest of the page already uses,
//     so the same reading is "wider than usual" in one panel and "normal"
//     in the one above it.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  baselineSummary,
  hasUsableBaseline,
  mostElevatedExpiry,
  percentileVerdict,
  surfaceReadout,
  unrankedExpiry,
  type SpreadSurface,
  type SurfaceBaseline,
  type SurfaceDteRank,
  type SurfacePoint,
} from '../core/spreadMonitor.ts';

function baseline(overrides: Partial<SurfaceBaseline> = {}): SurfaceBaseline {
  return {
    sessions: 30,
    earliest_date: '2026-08-01',
    latest_date: '2026-09-15',
    time_matched: true,
    time_bucket_label: '15:30-16:00 ET',
    fell_back_to_last_bucket: false,
    min_sessions: 8,
    ...overrides,
  };
}

function point(overrides: Partial<SurfacePoint> = {}): SurfacePoint {
  return {
    money_bucket: 'm:-0.5:0.5',
    label: '-0.5% to +0.5%',
    moneyness_low_pct: -0.5,
    moneyness_high_pct: 0.5,
    center_pct: 0,
    current_pct: 6,
    historical_median_pct: 6,
    historical_p25_pct: 5.5,
    historical_p75_pct: 6.5,
    percentile: 50,
    vs_normal: 1,
    contract_count: 40,
    two_sided_pct: 98,
    sessions: 30,
    ...overrides,
  };
}

function rank(overrides: Partial<SurfaceDteRank> = {}): SurfaceDteRank {
  return {
    dte_scope: 'b0',
    label: '0DTE',
    percentile: 50,
    current_pct: 6,
    historical_median_pct: 6,
    sessions: 30,
    insufficient_history: false,
    ...overrides,
  };
}

function surface(overrides: Partial<SpreadSurface> = {}): SpreadSurface {
  return {
    symbol: 'SPX',
    option_type: 'P',
    spot_price: 6000,
    timestamp: '2026-09-16T19:42:00Z',
    session_date: '2026-09-16',
    dte_max: 0,
    dte_scope: 'u0',
    moneyness_band_pct: 5,
    basis: 'quoted_nbbo',
    disclosure: 'Quoted NBBO widths, not effective spreads.',
    baseline: baseline(),
    summary: {
      current_pct: 6,
      normal_pct: 6,
      vs_normal: 1,
      percentile: 50,
      two_sided_pct: 98,
      contract_count: 120,
      sessions: 30,
    },
    curve: [point()],
    by_dte: [rank()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The baseline line
// ---------------------------------------------------------------------------

test('the baseline names the sessions, the dates and the clock', () => {
  const text = baselineSummary(baseline({ sessions: 36 }));
  assert.match(text, /36 comparable sessions/);
  assert.match(text, /2026-08-01 to 2026-09-15/);
  assert.match(text, /time-matched history: 15:30-16:00 ET/);
});

test('the baseline says nothing about a clock it did not match', () => {
  const text = baselineSummary(
    baseline({ time_matched: false, earliest_date: null, latest_date: null }),
  );
  assert.doesNotMatch(text, /time-matched/);
  assert.match(text, /30 comparable sessions/);
});

test('an empty baseline says so rather than printing a range', () => {
  const text = baselineSummary(baseline({ sessions: 0, earliest_date: null, latest_date: null }));
  assert.match(text, /No comparable sessions/);
  assert.doesNotMatch(text, /2026/);
});

test('a baseline below the minimum is not usable for a rank', () => {
  assert.equal(hasUsableBaseline(baseline({ sessions: 8, min_sessions: 8 })), true);
  assert.equal(hasUsableBaseline(baseline({ sessions: 7, min_sessions: 8 })), false);
  assert.equal(hasUsableBaseline(null), false);
});

// ---------------------------------------------------------------------------
// The readout
// ---------------------------------------------------------------------------

test('no percentile means no verdict at all, not a neutral one', () => {
  const quiet = surface({
    summary: { ...surface().summary, percentile: null },
    baseline: baseline({ sessions: 0 }),
  });
  assert.equal(surfaceReadout(quiet), null);
  assert.equal(surfaceReadout(null), null);
});

test('the readout reuses the same thresholds as the rest of the page', () => {
  // If these ever diverge, one panel calls a reading "wider than usual"
  // while the card above it calls the same reading normal.
  for (const percentile of [10, 50, 85, 97]) {
    const body = surface({ summary: { ...surface().summary, percentile } });
    const shared = percentileVerdict(percentile, 30);
    assert.ok(shared);
    assert.equal(surfaceReadout(body)?.label, shared.label);
    assert.equal(surfaceReadout(body)?.tone, shared.tone);
  }
});

test('the readout names the elevated bands rather than all of them', () => {
  const body = surface({
    summary: { ...surface().summary, percentile: 97 },
    curve: [
      point({ label: '-5.0% to -3.0%', percentile: 99 }),
      point({ label: '-3.0% to -1.5%', percentile: 92 }),
      point({ label: '-0.5% to +0.5%', percentile: 40 }),
      point({ label: '+3.0% to +5.0%', percentile: 55 }),
    ],
  });
  const readout = surfaceReadout(body);
  assert.ok(readout);
  assert.match(readout.meaning, /Concentrated in -5\.0% to -3\.0%, -3\.0% to -1\.5%/);
  assert.match(readout.meaning, /2 of 4 ranked bands/);
});

test('a broad move is described as broad, not as a concentration', () => {
  const body = surface({
    summary: { ...surface().summary, percentile: 97 },
    curve: [
      point({ label: 'a', percentile: 96 }),
      point({ label: 'b', percentile: 98 }),
      point({ label: 'c', percentile: 91 }),
    ],
  });
  assert.match(surfaceReadout(body)!.meaning, /All 3 ranked strike bands are elevated/);
  assert.match(surfaceReadout(body)!.meaning, /the whole put book/);
});

test('"the whole book" is not claimed from one or two ranked bands', () => {
  // Two bands ranked, both elevated, six with no history: describing that
  // as the whole book describes the chain from the only corner of it that
  // happens to have a baseline.
  const body = surface({
    summary: { ...surface().summary, percentile: 97 },
    curve: [
      point({ label: 'a', percentile: 96 }),
      point({ label: 'b', percentile: 98 }),
      ...Array.from({ length: 6 }, (_, i) =>
        point({ label: `gap${i}`, percentile: null, sessions: 0 }),
      ),
    ],
  });
  const meaning = surfaceReadout(body)!.meaning;
  assert.doesNotMatch(meaning, /whole put book/);
  assert.match(meaning, /2 of 2 ranked bands/);
});

test('the shared verdict sentence is carried verbatim, not reworded', () => {
  const body = surface({ summary: { ...surface().summary, percentile: 97 } });
  const shared = percentileVerdict(97, 30)!;
  assert.ok(surfaceReadout(body)!.meaning.startsWith(shared.meaning));
});

test('unranked bands are never counted as calm ones', () => {
  // The dangerous version: eight bands with no history and one elevated
  // band reading as "1 of 9" — which sounds isolated and is not.
  const body = surface({
    summary: { ...surface().summary, percentile: 97 },
    curve: [
      point({ label: 'ranked', percentile: 95 }),
      point({ label: 'no history', percentile: null, sessions: 0 }),
      point({ label: 'also none', percentile: null, sessions: 0 }),
    ],
  });
  assert.match(surfaceReadout(body)!.meaning, /Concentrated in ranked — 1 of 1 ranked bands/);
});

test('a curve with nothing ranked says so instead of claiming breadth', () => {
  const body = surface({
    summary: { ...surface().summary, percentile: 97 },
    curve: [point({ percentile: null, sessions: 0 })],
  });
  assert.match(
    surfaceReadout(body)!.meaning,
    /No put strike band in this scope has enough stored history/,
  );
});

// ---------------------------------------------------------------------------
// The expiry ranking
// ---------------------------------------------------------------------------

test('the flagged expiry is the most UNUSUAL, not the widest', () => {
  // 0DTE is the widest book every day of the year. Flagging it on width
  // would make this panel say the same thing forever.
  const worst = mostElevatedExpiry([
    rank({ dte_scope: 'b0', label: '0DTE', current_pct: 20, percentile: 45 }),
    rank({ dte_scope: 'b4_7', label: '4-7 DTE', current_pct: 3, percentile: 98 }),
  ]);
  assert.equal(worst?.label, '4-7 DTE');
});

test('an unrankable expiry never wins and never blocks the others', () => {
  const worst = mostElevatedExpiry([
    rank({ dte_scope: 'b0', label: '0DTE', percentile: null, insufficient_history: true }),
    rank({ dte_scope: 'b1', label: '1DTE', percentile: 70 }),
  ]);
  assert.equal(worst?.label, '1DTE');
  assert.equal(mostElevatedExpiry([rank({ percentile: null })]), null);
  assert.equal(mostElevatedExpiry([]), null);
  assert.equal(mostElevatedExpiry(null), null);
});

// ---------------------------------------------------------------------------
// Why a bar is missing
// ---------------------------------------------------------------------------
//
// A null percentile arrives in two states that used to render identically.
// One of them recurs on a calendar: 2-3 DTE covers the weekend from Thursday
// and Friday, 1DTE does from Friday, so on roughly two sessions in five the
// chart was reporting a data shortage where the real answer is that nothing
// expires then.

test('an empty expiry bucket is the calendar, not a data shortage', () => {
  // A reading cannot exist, but the history behind the bucket is plentiful.
  const note = unrankedExpiry(rank({ percentile: null, current_pct: null, sessions: 24 }));
  assert.ok(note);
  assert.match(note.label, /No expiry/);
  assert.doesNotMatch(note.meaning, /Insufficient|not enough/);
});

test('a real baseline shortage still says so', () => {
  const note = unrankedExpiry(rank({ percentile: null, current_pct: 4.2, sessions: 3 }));
  assert.ok(note);
  assert.equal(note.label, 'Insufficient history');
  assert.match(note.meaning, /3 comparable sessions/);
});

test('the shortage message is not self-contradicting', () => {
  // The bug: 24 stored sessions against a floor of 8, reported as "only 24
  // comparable sessions stored — not enough to rank".
  const note = unrankedExpiry(rank({ percentile: null, current_pct: null, sessions: 24 }));
  assert.ok(note);
  assert.doesNotMatch(note.meaning, /24/);
});

test('a ranked bucket has no note at all', () => {
  assert.equal(unrankedExpiry(rank({ percentile: 94, current_pct: 5.0 })), null);
});

test('one stored session reads as singular', () => {
  const note = unrankedExpiry(rank({ percentile: null, current_pct: 4.2, sessions: 1 }));
  assert.match(note!.meaning, /1 comparable session stored/);
});
