# The projected range is wider than it needs to be, and that is not the problem

Measured 2026-09-22 on 55 graded SPX sessions with
`make forecast-range-width SYMBOL=SPX`
(`frontend/scripts/forecast-range-width.mts`, read-only).

**The fix belongs in `zerogex-oa`, not here.** This repo only measures. This
document exists so the measurement does not live in a terminal scrollback.

## What was asked

Published SPX range coverage read 29/29 against an 80% target. If true
coverage were 80%, 29 for 29 has probability `0.8^29 ≈ 0.0015`. So the band
is padded — but a coverage rate is a tail probability and cannot say by how
much. Narrowing by feel risks overshooting into under-coverage, which is a
real failure where over-coverage is only a wide band.

## Method

For each graded session, the smallest scale factor `k` about the open spot
that would still have contained the day:

```
high(k) = open + k * (projected_high - open)
low(k)  = open - k * (open - projected_low)
k       = max( (actual_high - open) / (projected_high - open),
               (open - actual_low)  / (open - projected_low)  )
```

Scaled **per side**, not as one half-width: the band is bounded by the call
and put walls and those are not equidistant from spot, so a symmetric scale
mis-attributes the slack. The p-th percentile of `k` is, by construction, the
scale factor that would have produced exactly p% coverage.

The script cross-checks its own `k <= 1` containment against the backend's
`range_respected` verdict. Across all 55 sessions they agreed, so `k` is
measuring the band that is actually being graded.

## Results

```
                          n   held     p50     p80     p95     max
heuristic_v1_4           48   91.7%   0.525   0.804   1.473   2.605
heuristic_v1_3            5   80.0%   0.886   0.982   1.539   1.539
heuristic_v1_2            2    0.0%   1.503   1.606   1.606   1.606
pooled                   55   87.3%   0.617   0.900   1.606   2.605
```

**Segment by model or the number is wrong.** The pooled p80 of 0.900 blends
three generations; `v1_2` sessions broke their band and sit in the right tail,
dragging the percentile up. The live model's own p80 is **0.804** — about 20%
narrower, not 10%.

## The three findings that matter

**1. The tail is live, not historical.** Four of the seven misses are
`heuristic_v1_4`, including the two worst sessions in the whole sample:

```
2026-08-04   k = 2.605   heuristic_v1_4
2026-08-03   k = 2.231   heuristic_v1_4
2026-07-15   k = 1.473   heuristic_v1_4
2026-07-23   k = 1.393   heuristic_v1_4
```

Aug 3–4 needed a band 2.2–2.6x as wide. That is the current model.

**2. The misses cluster. They are not independent trials.**

```
2026-07-06 Mon  k=1.606      2026-07-15 Wed  k=1.473
2026-07-07 Tue  k=1.503      2026-07-23 Thu  k=1.393
2026-07-08 Wed  k=1.539      2026-08-03 Mon  k=2.231
                             2026-08-04 Tue  k=2.605
```

Five of seven sit in two runs of consecutive trading days. These are two
volatility events plus two singletons, not seven coin flips. Two consequences:

- A **uniform** scale factor is the wrong instrument. Cutting to 0.804 does
  nothing for Aug 3–4 (they would need 2.8 and 3.2 instead of 2.2 and 2.6) and
  spends the margin that currently absorbs regime events.
- The **Wilson interval on coverage is overconfident**. It assumes independent
  trials; with clustered failures the effective sample is smaller than 55 and
  the true interval is wider than what is published.

**3. The band is not tracking volatility.** Required width spans 12x across
sessions (`k` from 0.222 to 2.605) while the band itself barely moves. The
median session uses 52.5% of it. A band that perfectly anticipated the day's
range would have `k` clustered near a constant; this one is close to
uninformative about which days will be wide. That is the actual defect, and it
is a regime-detection problem rather than a scale-factor one.

Note the existing event-day stretch (1.5x, per the copy on
`/forecast/[symbol]/[date]`) did not catch Jul 6–8 or Aug 3–4. Whatever flags
an event day is missing exactly the days the band exists for.

## Recommendation

**Do not apply a uniform narrowing.** The padding is real (~20% on `v1_4`) but
uniform scaling preserves the shape of a long right tail — it moves every day
including the ones already breaking, and buys tightness on the median day at
the cost of the margin covering the tail.

Work the regime problem instead: find what Jul 6–8 and Aug 3–4 had in common
that the event-day flag missed, and make the width conditional on it. A band
that is narrow on quiet days and genuinely wide on the two-day shocks beats a
band that is uniformly 20% narrower.

**In-sample caveat.** `k` was fitted to the same 48 `v1_4` sessions it is
measured on. Treat 0.804 as a starting estimate to watch forward, never as a
tuned constant.

## Reproducing

```
make forecast-range-width SYMBOL=SPX                        # all models
make forecast-range-width SYMBOL=SPX MODEL=heuristic_v1_4   # live model only
make forecast-range-width SYMBOL=SPX JSON=1                 # machine-readable
```

Read-only. Writes nothing, touches no database, hits only the forecast API.
