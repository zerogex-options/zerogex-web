// Unit tests for the Spread Monitor readouts.
//
// The page's whole credibility rests on one rule, and these tests exist to
// keep it: a verdict is rendered only when there is something to base it on.
// Quoted width has no universal "wide" line — an SPX put is structurally
// wider than an SPY put on the calmest day of the year — so every judgement
// here is either a comparison against the SAME symbol's history or a
// structural statement of fact. The failure mode being guarded against is a
// page that confidently reports "normal" on a deployment with no history,
// which is indistinguishable to a reader from a page that checked.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY,
  coverageReadout,
  formatBps,
  formatCrossCost,
  formatMultiple,
  formatPct,
  formatSpread,
  moneynessAxisLabel,
  percentileVerdict,
  putCallReadout,
  sessionDrift,
  widestBucket,
  type MoneynessBucket,
  type SpreadAggregate,
  type SpreadSeriesBar,
} from '../core/spreadMonitor.ts';

function aggregate(overrides: Partial<SpreadAggregate> = {}): SpreadAggregate {
  return {
    contract_count: 100,
    tradable_count: 100,
    two_sided_pct: 100,
    zero_bid_pct: 0,
    crossed_or_locked_pct: 0,
    no_quote_pct: 0,
    median_spread: 0.5,
    median_relative_spread_pct: 4,
    p90_relative_spread_pct: 12,
    median_spread_bps_underlying: 7.4,
    p90_spread_bps_underlying: 18,
    total_open_interest: 1000,
    total_volume: 50,
    ...overrides,
  };
}

function bucket(overrides: Partial<MoneynessBucket> = {}): MoneynessBucket {
  return {
    ...aggregate(),
    moneyness_low_pct: -5,
    moneyness_high_pct: -3,
    label: '-5.0% to -3.0%',
    ...overrides,
  };
}

function bar(puts: number | null, calls: number | null = 1): SpreadSeriesBar {
  return {
    bucket_start: '2026-09-10T14:00:00Z',
    anchor_ts: '2026-09-10T14:14:00Z',
    spot: 6800,
    puts: puts == null ? null : aggregate({ median_relative_spread_pct: puts }),
    calls: calls == null ? null : aggregate({ median_relative_spread_pct: calls }),
  };
}

// ---------------------------------------------------------------------------
// Formatting — null must never render as a number
// ---------------------------------------------------------------------------

test('null formats as an em dash, never as zero', () => {
  // "0%" would read as "perfectly tight" — the opposite of "unknown".
  assert.equal(formatPct(null), EMPTY);
  assert.equal(formatBps(null), EMPTY);
  assert.equal(formatSpread(null), EMPTY);
  assert.equal(formatMultiple(null), EMPTY);
  assert.equal(formatCrossCost(null), EMPTY);
  assert.equal(formatPct(undefined), EMPTY);
  assert.equal(formatPct(Number.NaN), EMPTY);
  assert.equal(formatPct(Number.POSITIVE_INFINITY), EMPTY);
});

test('formatters render their units', () => {
  assert.equal(formatPct(4.567), '4.57%');
  assert.equal(formatPct(4.567, 1), '4.6%');
  assert.equal(formatBps(7.44), '7.4 bps');
  assert.equal(formatSpread(0.5), '$0.50');
  assert.equal(formatMultiple(2.313), '2.31×');
});

test('cross cost scales the per-share width by the contract multiplier', () => {
  // A 0.40-wide quote costs $40 to cross one contract, not 40 cents.
  assert.equal(formatCrossCost(0.4), '$40');
  assert.equal(formatCrossCost(6), '$600');
});

// ---------------------------------------------------------------------------
// The percentile verdict — the one place "is this bad?" is answered
// ---------------------------------------------------------------------------

test('no percentile and no history yield NO verdict', () => {
  // The page must render "no baseline yet" here. Returning a neutral
  // "normal range" would tell a reader the page checked when it did not.
  assert.equal(percentileVerdict(null, 60), null);
  assert.equal(percentileVerdict(undefined, 60), null);
  assert.equal(percentileVerdict(50, 0), null);
  assert.equal(percentileVerdict(Number.NaN, 60), null);
});

test('percentile verdict bands run from tighter-than-usual to the top 5%', () => {
  assert.equal(percentileVerdict(99, 60)?.label, 'Widest 5% of sessions');
  assert.equal(percentileVerdict(95, 60)?.label, 'Widest 5% of sessions');
  assert.equal(percentileVerdict(85, 60)?.label, 'Wider than usual');
  assert.equal(percentileVerdict(50, 60)?.label, 'Normal range');
  assert.equal(percentileVerdict(20, 60)?.label, 'Normal range');
  assert.equal(percentileVerdict(5, 60)?.label, 'Tighter than usual');
});

test('verdict tone is keyed to tradeability, not market direction', () => {
  // Tight quotes are the good outcome for the reader of this page, so they
  // carry the bullish tone regardless of what the tape is doing.
  assert.equal(percentileVerdict(99, 60)?.tone, 'bearish');
  assert.equal(percentileVerdict(50, 60)?.tone, 'neutral');
  assert.equal(percentileVerdict(2, 60)?.tone, 'bullish');
});

test('the verdict states the window it judged against', () => {
  assert.match(percentileVerdict(99, 60)!.meaning, /60 sessions/);
  assert.match(percentileVerdict(99, 1)!.meaning, /1 session\b/);
});

// ---------------------------------------------------------------------------
// Which side of the book is expensive
// ---------------------------------------------------------------------------

test('a put/call ratio well above 1 names the puts as the expensive side', () => {
  const readout = putCallReadout(2.4);
  assert.equal(readout?.label, 'Puts are the expensive side');
  assert.equal(readout?.tone, 'bearish');
  assert.match(readout!.meaning, /2\.40×/);
});

test('a ratio near 1 reports parity rather than reading noise as a lean', () => {
  assert.equal(putCallReadout(1.0)?.label, 'Both sides quoted alike');
  assert.equal(putCallReadout(1.2)?.label, 'Both sides quoted alike');
  assert.equal(putCallReadout(0.85)?.label, 'Both sides quoted alike');
  assert.equal(putCallReadout(1.0)?.tone, 'neutral');
});

test('the rarer call-side blowout is named too, not folded into parity', () => {
  const readout = putCallReadout(0.5);
  assert.equal(readout?.label, 'Calls are the expensive side');
  assert.match(readout!.meaning, /2\.00×/);
});

test('a missing or degenerate ratio yields no readout', () => {
  assert.equal(putCallReadout(null), null);
  assert.equal(putCallReadout(0), null);
  assert.equal(putCallReadout(-1), null);
  assert.equal(putCallReadout(Number.NaN), null);
});

// ---------------------------------------------------------------------------
// Coverage — the failure that has no width
// ---------------------------------------------------------------------------

test('coverage counts locked and crossed contracts alongside no-bid ones', () => {
  // All three are "no usable two-sided market". Counting only zero-bid
  // would understate a chain whose marks have gone stale and crossed.
  const readout = coverageReadout(
    aggregate({ zero_bid_pct: 12, crossed_or_locked_pct: 9, two_sided_pct: 79 }),
  );
  assert.equal(readout?.label, 'Large dead zone');
  assert.match(readout!.meaning, /21%/);
});

test('coverage bands: fully quoted, patchy, dead zone', () => {
  assert.equal(coverageReadout(aggregate({ zero_bid_pct: 1 }))?.label, 'Fully quoted');
  assert.equal(coverageReadout(aggregate({ zero_bid_pct: 8 }))?.label, 'Patchy coverage');
  assert.equal(coverageReadout(aggregate({ zero_bid_pct: 40 }))?.label, 'Large dead zone');
});

test('an empty chain has no coverage verdict', () => {
  assert.equal(coverageReadout(null), null);
  assert.equal(coverageReadout(aggregate({ contract_count: 0 })), null);
});

// ---------------------------------------------------------------------------
// Session drift — a different question from the percentile
// ---------------------------------------------------------------------------

test('session drift compares the latest reading to the session open', () => {
  const drift = sessionDrift([bar(2), bar(4), bar(6)]);
  assert.equal(drift?.open, 2);
  assert.equal(drift?.latest, 6);
  assert.equal(drift?.ratio, 3);
});

test('session drift skips buckets with no reading rather than treating them as zero', () => {
  // A bucket the feed missed must not register as a chain that briefly went
  // free to cross, which is what a zero would mean.
  const drift = sessionDrift([bar(null), bar(2), bar(null), bar(5)]);
  assert.equal(drift?.open, 2);
  assert.equal(drift?.latest, 5);
});

test('session drift needs two readings before it says anything', () => {
  assert.equal(sessionDrift([]), null);
  assert.equal(sessionDrift([bar(2)]), null);
  assert.equal(sessionDrift([bar(null), bar(null)]), null);
  assert.equal(sessionDrift(null), null);
});

test('session drift can read the call side', () => {
  const drift = sessionDrift([bar(9, 1), bar(9, 2)], 'calls');
  assert.equal(drift?.ratio, 2);
});

// ---------------------------------------------------------------------------
// Where the chain thins
// ---------------------------------------------------------------------------

test('the widest bucket ignores samples too thin to mean anything', () => {
  // A 90%-wide reading off two contracts is not the widest part of the
  // chain, it is a rounding artefact of a nearly-empty bucket.
  const worst = widestBucket([
    bucket({ label: 'thin wing', median_relative_spread_pct: 90, tradable_count: 2 }),
    bucket({ label: 'real wing', median_relative_spread_pct: 30, tradable_count: 40 }),
    bucket({ label: 'at the money', median_relative_spread_pct: 3, tradable_count: 60 }),
  ]);
  assert.equal(worst?.label, 'real wing');
});

test('buckets with no market at all are not candidates for widest', () => {
  const worst = widestBucket([
    bucket({ label: 'no market', median_relative_spread_pct: null, tradable_count: 0 }),
    bucket({ label: 'wide', median_relative_spread_pct: 12, tradable_count: 20 }),
  ]);
  assert.equal(worst?.label, 'wide');
});

test('widest bucket is null when nothing qualifies', () => {
  assert.equal(widestBucket([]), null);
  assert.equal(widestBucket(null), null);
  assert.equal(
    widestBucket([bucket({ median_relative_spread_pct: 40, tradable_count: 1 })]),
    null,
  );
});

test('moneyness labels read as a distance from spot, with a side', () => {
  assert.equal(
    moneynessAxisLabel(bucket({ moneyness_low_pct: -5, moneyness_high_pct: -3 })),
    '3.0–5.0% below',
  );
  assert.equal(
    moneynessAxisLabel(bucket({ moneyness_low_pct: 3, moneyness_high_pct: 5 })),
    '3.0–5.0% above',
  );
  assert.equal(
    moneynessAxisLabel(bucket({ moneyness_low_pct: -0.5, moneyness_high_pct: 0.5 })),
    'At the money',
  );
});
