# The projected range is wider than it needs to be, and that is not the problem

> **Do not read this as "scale the band by 0.8".** That is the one change the
> measurement below argues against. The live model's p80 is 0.804, but its
> failures arrive in consecutive-day clusters, so a uniform narrowing would
> tighten the quiet days the band already handles and do nothing for the two
> sessions that broke it worst. Nor is the fix `VOL_RATIO_MAX`: that question
> is settled below and the answer is no. Read **The three findings** and
> **Recommendation** before changing a constant.

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

**3b. There is a hard ceiling on the width. It is not the cause.**
Read after this document was first written, from `zerogex-oa` @ `release`
(`39f2819`), `src/jobs/forecast_range_model.py`:

```python
VOL_RATIO_MIN = 0.45
VOL_RATIO_MAX = 1.90
EVENT_DAY_MULTIPLIER = 1.5
...
ratio = _clamp(ratio, VOL_RATIO_MIN, VOL_RATIO_MAX)   # last step before the band
```

The expected-vol ratio is clamped to **1.90x a normal day**. Aug 3-4 needed
2.231x and 2.605x the band that shipped. So the fat right tail may not be a
detection failure at all: the model may have seen it coming and been gagged.

**ANSWERED, 2026-09-23, and it is NOT the clamp.** Measured on production
with `make forecast-range-width SYMBOL=SPX`:

```
date         needed k    asked for    vs cap 1.90   model
2026-08-04      2.605      1.000x         under   heuristic_v1_4
2026-08-03      2.231      1.052x         under   heuristic_v1_4
2026-07-15      1.473      1.058x         under   heuristic_v1_4
2026-07-23      1.393      1.093x         under   heuristic_v1_4
```

Not one miss came close to the ceiling. On the worst day in the entire record
the model asked for **1.000x — a completely normal day — and got 2.605x**. It
was not gagged by the clamp. It was blind.

Raising `VOL_RATIO_MAX` would therefore change nothing: the model never asked
for the width it was already permitted.

**And 1.000 is the tell.** `VOL_BASE_RATIO = 1.0` is the *neutral fallback*,
taken when BOTH anchors are unavailable:

```python
if persistence_anchor is not None and persistence_anchor > 0:
    ratio = float(persistence_anchor); anchor_src = "persistence"
elif atr_5d is not None and atr_5d > 0 and implied_move is not None and implied_move > 0:
    ratio = atr_5d / normal_range;      anchor_src = "atr"
else:
    ratio = VOL_BASE_RATIO              # 1.0 — anchor_src = "neutral"
```

An exact 1.000 after four multiplicative modifiers is either a coincidence or
the neutral path with nothing firing. If Aug 3-4 fell through to neutral because
the inputs were missing, this is not a modelling problem at all — it is a
**missing-data problem wearing a modelling problem's clothes**, and no amount of
regime work fixes it.

**CONFIRMED, 2026-09-23, on production.** The persistence anchor was NULL on
every one of the four:

```
    date    | expected_vol_ratio | state  | persistence_anchor | atr_5d
------------+--------------------+--------+--------------------+--------
 2026-07-15 |             1.0580 | normal |                    | 61.22
 2026-07-23 |             1.0933 | normal |                    | 58.834
 2026-08-03 |             1.0524 | normal |                    | 98.774
 2026-08-04 |             1.0000 | normal |                    | 98.764
```

`vol_persistence_anchor` is empty on all four, and this module's own docstring
calls it *"the dominant driver of the expected-vol prediction"* and the reason
the model does not default to "normal". It was absent, and the model defaulted
to "normal" on all four — exactly as documented.

Note what `atr_5d` says too: 61 and 59 in July against 99 and 99 in August. The
tape was already moving 60% wider before Aug 3-4, and the committed ratio
barely registered it (1.05 -> 1.00). The information was in the inputs and did
not reach the band.

### Both questions answered, 2026-09-23

`implied_move` was NOT the gap — it is populated on all four misses and on all
49 `v1_4` sessions. And the persistence anchor is not universally absent: it
fires on 34 of 49. But look where the 15 blanks landed.

```
 sessions | with_persistence | with_implied_move | min_ratio | max_ratio | avg_ratio | sd_ratio
       49 |               34 |                49 |    0.6864 |    1.0997 |    0.8738 |   0.1268
```

**Finding 1 — the blanks are not randomly distributed.** The anchor is missing
on 15 of 49 sessions (31%), and all four `v1_4` misses are inside that 15.
Drawing four sessions at random, the chance of all four landing in the blank
group is C(15,4)/C(49,4) ≈ **0.6%**. Missing the anchor and breaking the band
are not independent events.

**Finding 2, and this is the real one — the model has never once predicted an
above-normal day.** Across all 49 sessions `expected_vol_ratio` spans
**0.6864 to 1.0997**, mean 0.8738, sd 0.1268. It has never printed 1.2, let
alone approached the 1.90 ceiling. The band's width control has a ceiling it
cannot reach and a dynamic range of roughly ±13%, against realized width that
varies 12x (k from 0.222 to 2.605).

That single fact explains, at once, three things previously treated as separate
problems:

- why the clamp never binds — nothing ever gets near it;
- why the band barely moves while required width spans 12x;
- why the vol call scores 59% against a 69% "always normal" baseline. It cannot
  beat "always normal" because it IS "always normal", by construction.

**Finding 3 — the ATR signal is present and is not reaching the band.** On the
four misses, `atr_5d / implied_move` nearly doubled while the committed ratio
moved 9%, in the opposite direction:

```
date         atr/implied   committed ratio
2026-07-15      0.7929           1.0580
2026-07-23      0.6751           1.0933
2026-08-03      1.3033           1.0524      <- ATR up 95% from Jul 23
2026-08-04      1.3146           1.0000      <- ratio DOWN
```

Pearson r = -0.796 on n = 4, which is far too small to be evidence on its own —
but it points the same way as the 49-session aggregate, and the mechanism is
visible in the code either way. With the persistence anchor NULL the ATR branch
should have taken over; whether it fired and was swamped by the modifiers, or
never fired at all, the ATR more than doubling produced no widening.

Worth noting where the asymmetry likely comes from: the gamma tilt is
`ratio *= 1.0 - VOL_GAMMA_WEIGHT * tanh(net_gex / SAT)`, which DAMPS whenever
net GEX is positive. SPX is long gamma most days, so the dominant modifier
pushes width down almost every session. A trailing-median anchor in a calm
stretch sits below 1.0 to begin with. The two compound, and the result is a
model that can say "quieter than normal" but has never said "busier".

An earlier draft of this document asserted that "whatever flags an event day is
missing exactly the days the band exists for". That was a guess made without
having read the model, and the clamp is the better hypothesis. The event-day
stretch (`EVENT_DAY_MULTIPLIER = 1.5`) may still be mis-firing, but it cannot be
diagnosed while a downstream clamp can silently overwrite whatever it produces.

## Recommendation

**Do not apply a uniform narrowing.** The padding is real (~20% on `v1_4`) but
uniform scaling preserves the shape of a long right tail — it moves every day
including the ones already breaking, and buys tightness on the median day at
the cost of the margin covering the tail.

In order:

1. ~~Settle the clamp question~~ — **done. It is not the clamp.** All four
   `v1_4` misses asked for 1.00-1.09x against a 1.90x ceiling. Do not touch
   `VOL_RATIO_MAX`; it is not the binding constraint.
2. ~~Check whether the anchors were populated~~ — **partly done. The
   persistence anchor was NULL on all four misses**, and it is the documented
   "dominant driver" of the expected-vol call. The model defaulted to normal
   because it had nothing to anchor on.
3. ~~Run the two queries~~ — **done, and they reframe the problem.** The
   expected-vol ratio has never exceeded 1.0997 in 49 sessions against a 1.90
   ceiling. The width control has a dynamic range of about +/-13% against
   realized width that varies 12x. This is not a regime-detection problem and
   not a clamp problem: **the band's width barely varies at all.**
4. **Fix the dynamic range first.** Two concrete leads, in order:
   a. **Why is `vol_persistence_anchor` NULL on 31% of sessions**, including
      every session that broke the band? It is the documented dominant driver.
      Find what populates it and why it is absent one day in three.
   b. **Why does a 95% rise in `atr_5d / implied_move` produce no widening?**
      With the anchor NULL the ATR branch is the fallback that should have
      caught Aug 3-4. Instrument `anchor_src` per session and find out whether
      it fires at all, and whether the modifiers are cancelling it.
5. **Check the modifier asymmetry.** `ratio *= 1.0 - VOL_GAMMA_WEIGHT * g`
   damps whenever net GEX is positive, which for SPX is most days. If the
   dominant modifier is a near-permanent damper, nothing downstream can ever
   call a wide day.
6. **Only then consider narrowing**, and conditionally rather than uniformly. A
   band genuinely narrow on quiet days and genuinely wide on two-day shocks
   beats one that is uniformly 20% tighter.

**In-sample caveat.** `k` was fitted to the same 48 `v1_4` sessions it is
measured on. Treat 0.804 as a starting estimate to watch forward, never as a
tuned constant.

## Reproducing

**These commands live in `zerogex-web`, not here.** Both repos deploy to the
same box and the script reads the same forecast API, so run them from the
`zerogex-web` checkout:

```
make forecast-range-width SYMBOL=SPX                        # all models + the cap readout
make forecast-range-width SYMBOL=SPX MODEL=heuristic_v1_4   # live model only
make forecast-range-width SYMBOL=SPX JSON=1                 # machine-readable
```

Read-only. Writes nothing, touches no database, hits only the forecast API.

Working only from `zerogex-oa`? The one field that decides the clamp question is
on the stored forecast:

```
curl -s -H "Authorization: Bearer $ZEROGEX_API_TOKEN" \
  "http://127.0.0.1:8000/api/forecast/2026-08-04?symbol=SPX" \
  | python3 -c "import json,sys; m=json.load(sys.stdin)['morning']; \
      print(m['expected_vol_ratio'], m['expected_vol_state'], m['range_model'])"
```

`1.9` means clipped. Anything materially below it means mispredicted. Repeat for
`2026-08-03`, `2026-07-15` and `2026-07-23` -- the four `heuristic_v1_4` misses.