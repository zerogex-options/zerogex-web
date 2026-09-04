#!/usr/bin/env python3
"""Does GEX rank predict where price reacts?

A tester kept pointing at levels we told him were noise. We said 3 to 5 levels
was the sweet spot and anything past 5 was "mostly noise". He came back with
GEX 7 and 8 seeing more action than GEX 1, and then with GEX 10 marking the
high of the day to the tick. Three observations against an assertion made with
no measurement behind it.

This script measures it. It is deliberately built to be able to embarrass us:
the controls below are the whole point, and a version of this that only counted
hits would confirm anything.

WHY A HIT COUNT PROVES NOTHING
------------------------------
The indicator can draw sixteen lines (ten ranks, five walls, VWAP). Over a
session price visits most of the range, so "a level got touched" is close to
certain and carries no information. Two controls separate signal from geometry:

  * SHUFFLE  - the same strikes, the same touches, rank labels permuted at
    random. This is the sharp test of the actual claim. The claim is not "these
    strikes matter", it is "rank 1 matters MOST" -- an ordering. If the ordering
    is real, true labels beat shuffled ones. If they do not, the number we print
    next to each line is decoration.

  * RANDOM   - the same count of levels at arbitrary strikes on the same grid.
    Tests the weaker claim that our strikes beat lines drawn for no reason.

And one confound that will probably decide the answer: DISTANCE. GEX 1 is the
largest gamma strike, which is not the same as the nearest. A huge strike far
from spot is rarely touched; a moderate one where price is trading gets tested
all day. If rank stops predicting once distance is held constant, then the
finding is not "the trader is right about 7 and 8" -- it is that ranking on
magnitude ALONE is the wrong metric, and something proximity-weighted (which we
already model separately as gex_gradient) is the right one. That is a product
change, not a setting. So every result here is also reported within distance
buckets, and the bucketed table is the one that matters.

WHAT IS MEASURED
----------------
Touch:     price traded within `tol` of the level (tol in ATR units).
Outcome:   from the touch bar, look forward `horizon` bars. Whichever comes
           first decides it -- price moving `move` ATR back the way it came
           (REJECTION) or `move` ATR through (BREAK). Neither within the
           horizon is UNRESOLVED and is excluded from rates rather than
           silently counted as a failure.
Statistic: rejection rate per rank = rejections / (rejections + breaks).

HOW MANY SESSIONS
-----------------
More than feels necessary. Planting a LARGE effect into synthetic sessions and
asking this pipeline to find it, the empirical p against the shuffled null runs:

    40 sessions -> p 0.12      80 -> p 0.036      120 -> p 0.010      200 -> p 0.002

So 40 sessions cannot detect an effect far bigger than anything real is likely
to be, and a first guess of "twenty or thirty should do" was wrong by a factor
of three. Treat 80 as the floor and 120 as comfortable; anything under 80 is a
direction to investigate, not a result to act on. `--last` accepts up to 180 in
one call, so this costs patience rather than engineering.

FIRST TOUCH ONLY, by default. A level price chops around produces dozens of
correlated touches, and letting them all count would let one indecisive
afternoon outvote thirty clean sessions. `--all-touches` if you want the other
behavior, knowing what it does.

USAGE
    export ZEROGEX_API_KEY=...            # any Pro key: the replay router is gex-scoped
    python3 scripts/gex-rank-backtest.py --symbol NQ --last 30

    # On the API box, point it at the local service and skip the CDN entirely:
    python3 scripts/gex-rank-backtest.py --base http://127.0.0.1:8000 --symbol NQ --last 120
    python3 scripts/gex-rank-backtest.py --symbol NQ --dates 2026-09-03,2026-09-02
    python3 scripts/gex-rank-backtest.py --symbol NQ --last 30 --json out.json

    # self-test on synthetic sessions with a known planted answer:
    python3 scripts/gex-rank-backtest.py --self-test

Futures note: ES/NQ payloads are projected server-side onto the futures axis --
strikes and candles alike, both are in PRICE_FIELDS -- so levels and prices are
in the same space and no basis adjustment belongs here. Never mix symbols in
one run.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, time as dtime
from typing import Any, Dict, List, Optional, Sequence, Tuple

# On the API box itself, ZEROGEX_API_BASE_URL already points at the local
# service (127.0.0.1:8000). Preferring it means a bulk run skips Cloudflare and
# the edge rate limiter entirely, which is the right way to pull a hundred
# sessions of your own data: nothing about this job belongs on the CDN.
DEFAULT_BASE = os.environ.get("ZEROGEX_API_BASE_URL") or "https://api.zerogex.io"

USER_AGENT = "ZeroGEX-GexRankBacktest/1.0 (+https://zerogex.io)"

# Held constant for a run so a rerun on the same data reproduces exactly. A
# backtest whose conclusion moves between runs is not a measurement.
SEED = 20260903


# --------------------------------------------------------------------------
# API
# --------------------------------------------------------------------------

# Transient on a long run: the rate limiter, or a gateway blinking. One of these
# used to abort the whole thing, which on a 120-session pass means discarding
# several minutes of completed work at session 90 -- and the obvious reaction to
# that is to rerun with fewer sessions, which is exactly the wrong direction
# when 80 is already the floor for detecting anything.
_RETRY_STATUS = frozenset({429, 500, 502, 503, 504})


def _get(base: str, path: str, params: Dict[str, Any], key: str,
         timeout: int = 120, attempts: int = 5) -> Any:
    url = base.rstrip("/") + path + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + key,
        "Accept": "application/json",
        # Cloudflare bans the default "Python-urllib/3.x" signature outright
        # (error 1010, browser_signature_banned) before the request ever reaches
        # the API, so a valid key gets a 403 that looks like an auth failure and
        # is not one. This says what the client is rather than pretending to be
        # a browser; the point is to be identifiable in the logs, not to hide.
        "User-Agent": USER_AGENT,
    })
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code not in _RETRY_STATUS or attempt == attempts - 1:
                body = exc.read().decode("utf-8", "replace")[:400]
                raise SystemExit(f"HTTP {exc.code} on {path}: {body}") from exc
            # Honour Retry-After when the limiter sends one: it knows its own
            # window better than a doubling guess does.
            wait = float(exc.headers.get("Retry-After") or 0) or (2.0 ** attempt)
            print(f"    HTTP {exc.code}, retrying in {wait:.0f}s "
                  f"({attempt + 1}/{attempts - 1})", file=sys.stderr)
            time.sleep(wait)
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == attempts - 1:
                raise SystemExit(f"network error on {path}: {exc}") from exc
            time.sleep(2.0 ** attempt)
    raise SystemExit(f"exhausted retries on {path}")


def list_sessions(base: str, key: str, symbol: str, limit: int) -> List[str]:
    data = _get(base, "/api/replay/sessions", {"symbol": symbol, "limit": limit}, key)
    # Sessions with almost no bars are half-days or partial captures. Ranking a
    # session that only has an hour of tape and then measuring what price "did
    # afterwards" measures the capture, not the market.
    return [s["date"] for s in data.get("sessions", []) if (s.get("bar_count") or 0) >= 120]


def fetch_session(base: str, key: str, symbol: str, date: str, band_pct: float) -> Dict[str, Any]:
    return _get(base, "/api/replay/range", {
        "symbol": symbol, "date": date, "strike_band_pct": band_pct,
    }, key)


# --------------------------------------------------------------------------
# Ranking -- identical to the indicator's
# --------------------------------------------------------------------------

def rank_strikes(strikes: Sequence[Dict[str, Any]], want: int) -> List[Tuple[float, float]]:
    """Top `want` strikes by ABSOLUTE net gamma, largest first.

    A selection pass rather than a sort, mirroring ZeroGexGammaLevels.cs
    exactly. Testing a tidier ranking than the one customers actually see would
    measure the wrong artifact.
    """
    rows = [(float(s["strike"]), float(s["net_gex"]))
            for s in strikes
            if s.get("strike") is not None and s.get("net_gex") is not None]

    taken = [False] * len(rows)
    out: List[Tuple[float, float]] = []
    for _ in range(min(want, len(rows))):
        best, best_mag = -1, 0.0
        for i, (_, gex) in enumerate(rows):
            if taken[i]:
                continue
            mag = abs(gex)
            if mag > best_mag:
                best_mag, best = mag, i
        if best < 0:
            break
        taken[best] = True
        out.append(rows[best])
    return out


# --------------------------------------------------------------------------
# Bars
# --------------------------------------------------------------------------

def parse_ts(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def true_range_atr(candles: Sequence[Dict[str, Any]], lookback: int = 60) -> Optional[float]:
    """Mean true range over the first `lookback` bars of the session.

    Every threshold here is expressed in ATR so one set of parameters means the
    same thing on NQ, SPY and SPX, whose point values differ by orders of
    magnitude. Taken from the START of the session so the yardstick cannot be
    contaminated by the move being measured.
    """
    trs: List[float] = []
    prev_close: Optional[float] = None
    for c in candles[:lookback]:
        hi, lo, cl = c.get("high"), c.get("low"), c.get("close")
        if hi is None or lo is None:
            continue
        tr = float(hi) - float(lo)
        if prev_close is not None:
            tr = max(tr, abs(float(hi) - prev_close), abs(float(lo) - prev_close))
        trs.append(tr)
        if cl is not None:
            prev_close = float(cl)
    if not trs:
        return None
    atr = sum(trs) / len(trs)
    return atr if atr > 0 else None


def classify_touch(
    candles: Sequence[Dict[str, Any]],
    start: int,
    level: float,
    tol: float,
    move: float,
    horizon: int,
) -> Optional[str]:
    """'rejection', 'break', or None when the horizon expires undecided.

    Direction of approach is taken from the close BEFORE the touch, so a level
    approached from below rejects downward and breaks upward. Unresolved is
    returned as None rather than folded into either bucket: the honest answer to
    "price touched and then did nothing much" is that it does not count.
    """
    prev_close = None
    for j in range(start - 1, -1, -1):
        if candles[j].get("close") is not None:
            prev_close = float(candles[j]["close"])
            break
    if prev_close is None:
        return None

    from_below = prev_close < level
    if abs(prev_close - level) <= tol:
        # Already sitting on the level before the touch bar: there is no
        # approach to reject, and calling one arbitrarily is how a chop day
        # manufactures a result.
        return None

    reject_at = level - move if from_below else level + move
    break_at = level + move if from_below else level - move

    for c in candles[start:start + horizon]:
        hi, lo = c.get("high"), c.get("low")
        if hi is None or lo is None:
            continue
        hi, lo = float(hi), float(lo)
        hit_break = hi >= break_at if from_below else lo <= break_at
        hit_reject = lo <= reject_at if from_below else hi >= reject_at
        if hit_break and hit_reject:
            # Both inside one bar: at 1-minute resolution the order is
            # unknowable, and guessing would bias whichever side we favored.
            return None
        if hit_break:
            return "break"
        if hit_reject:
            return "rejection"
    return None


def evaluate_levels(
    candles: Sequence[Dict[str, Any]],
    levels: Sequence[float],
    atr: float,
    tol_atr: float,
    move_atr: float,
    horizon: int,
    first_touch_only: bool,
) -> List[Optional[str]]:
    """One outcome slot per level, in the order given."""
    tol, move = tol_atr * atr, move_atr * atr
    results: List[Optional[str]] = []
    for level in levels:
        outcome: Optional[str] = None
        for i, c in enumerate(candles):
            hi, lo = c.get("high"), c.get("low")
            if hi is None or lo is None:
                continue
            if not (float(lo) - tol <= level <= float(hi) + tol):
                continue
            verdict = classify_touch(candles, i, level, tol, move, horizon)
            if verdict is not None:
                outcome = verdict
                if first_touch_only:
                    break
            if first_touch_only and verdict is None:
                # A touch that resolved nothing still consumes the "first
                # touch": pretending the next one was the first would quietly
                # search for a touch that gives an answer we like.
                break
        results.append(outcome)
    return results


# --------------------------------------------------------------------------
# One session
# --------------------------------------------------------------------------

def anchor_frame(frames: Sequence[Dict[str, Any]], anchor_hhmm: str) -> Optional[Dict[str, Any]]:
    """First frame at or after the anchor time, compared in the payload's own tz.

    Ranks are fixed once, at the anchor, and then left alone. The indicator
    re-ranks on every poll, but a level that moves during the session is not
    something a trader could have acted on in the morning, and measuring one
    would be measuring hindsight.
    """
    hh, mm = (int(x) for x in anchor_hhmm.split(":"))
    want = dtime(hh, mm)
    for f in frames:
        ts = parse_ts(f.get("timestamp"))
        if ts and ts.timetz().replace(tzinfo=None) >= want:
            return f
    return frames[0] if frames else None


def session_observations(
    payload: Dict[str, Any],
    ranks: int,
    anchor_hhmm: str,
    tol_atr: float,
    move_atr: float,
    horizon: int,
    first_touch_only: bool,
    rng: random.Random,
    shuffles: int,
) -> Optional[Dict[str, Any]]:
    frames = payload.get("frames") or []
    candles = payload.get("candles") or []
    if not frames or len(candles) < 60:
        return None

    frame = anchor_frame(frames, anchor_hhmm)
    if not frame:
        return None
    anchor_ts = parse_ts(frame.get("timestamp"))

    # Only bars AFTER the anchor are eligible. Including earlier bars would let
    # a level "predict" a touch that had already happened when it was chosen.
    forward = [c for c in candles if (parse_ts(c.get("timestamp")) or anchor_ts) >= anchor_ts] \
        if anchor_ts else list(candles)
    if len(forward) < 60:
        return None

    atr = true_range_atr(forward)
    if not atr:
        return None

    spot = None
    for c in forward:
        if c.get("open") is not None:
            spot = float(c["open"])
            break
    if spot is None:
        return None

    ranked = rank_strikes(frame.get("strikes") or [], ranks)
    if len(ranked) < 2:
        return None
    levels = [s for s, _ in ranked]

    outcomes = evaluate_levels(forward, levels, atr, tol_atr, move_atr, horizon, first_touch_only)

    # SHUFFLE control. The outcomes belong to the STRIKES, so permuting which
    # rank owns which outcome is exactly the null "the strikes are fine, the
    # ordering is arbitrary" -- and it costs no extra data.
    shuffled: List[List[Optional[str]]] = []
    for _ in range(shuffles):
        perm = list(outcomes)
        rng.shuffle(perm)
        shuffled.append(perm)

    # RANDOM control. Same count, arbitrary strikes off the same grid, with the
    # real levels excluded so the control cannot accidentally re-pick them.
    grid = sorted({float(s["strike"]) for s in (frame.get("strikes") or [])
                   if s.get("strike") is not None})
    pool = [g for g in grid if g not in set(levels)]
    rand_levels = rng.sample(pool, min(len(levels), len(pool))) if pool else []
    rand_outcomes = evaluate_levels(
        forward, rand_levels, atr, tol_atr, move_atr, horizon, first_touch_only
    )

    return {
        "date": payload.get("date"),
        "atr": atr,
        "spot": spot,
        "levels": levels,
        "distance_atr": [abs(l - spot) / atr for l in levels],
        "outcomes": outcomes,
        "shuffled": shuffled,
        "random_outcomes": rand_outcomes,
    }


# --------------------------------------------------------------------------
# Aggregation
# --------------------------------------------------------------------------

def rate(rejections: int, breaks: int) -> Optional[float]:
    n = rejections + breaks
    return rejections / n if n else None


def summarize(sessions: List[Dict[str, Any]], ranks: int) -> Dict[str, Any]:
    per_rank = [{"rejection": 0, "break": 0, "unresolved": 0} for _ in range(ranks)]
    for s in sessions:
        for i, outcome in enumerate(s["outcomes"]):
            if i >= ranks:
                break
            per_rank[i]["unresolved" if outcome is None else outcome] += 1

    # Null distribution of the per-rank rate, from the label shuffles.
    null_rates: List[List[float]] = [[] for _ in range(ranks)]
    reps = len(sessions[0]["shuffled"]) if sessions and sessions[0]["shuffled"] else 0
    for rep in range(reps):
        tally = [{"rejection": 0, "break": 0} for _ in range(ranks)]
        for s in sessions:
            if rep >= len(s["shuffled"]):
                continue
            for i, outcome in enumerate(s["shuffled"][rep]):
                if i < ranks and outcome in ("rejection", "break"):
                    tally[i][outcome] += 1
        for i in range(ranks):
            r = rate(tally[i]["rejection"], tally[i]["break"])
            if r is not None:
                null_rates[i].append(r)

    rnd = {"rejection": 0, "break": 0}
    for s in sessions:
        for outcome in s["random_outcomes"]:
            if outcome in ("rejection", "break"):
                rnd[outcome] += 1

    return {"per_rank": per_rank, "null_rates": null_rates, "random": rnd}


def empirical_p(observed: Optional[float], null: List[float]) -> Optional[float]:
    """Two-sided share of shuffles at least as extreme as observed.

    Empirical rather than a z-test: the per-rank counts are small and the null
    is right here for free, so there is no reason to assume normality.
    """
    if observed is None or not null:
        return None
    center = sum(null) / len(null)
    gap = abs(observed - center)
    extreme = sum(1 for v in null if abs(v - center) >= gap)
    return (extreme + 1) / (len(null) + 1)


def distance_table(sessions: List[Dict[str, Any]], ranks: int) -> Dict[str, Any]:
    """Rejection rate by distance bucket, and rank's mean distance.

    The decisive table. If rank only appears to work because low ranks sit
    nearer to spot, it shows up as a flat rate across ranks WITHIN a bucket
    while the buckets themselves differ.
    """
    edges = [(0.0, 2.0), (2.0, 5.0), (5.0, 10.0), (10.0, math.inf)]
    buckets = {f"{lo:g}-{hi:g} ATR": {"rejection": 0, "break": 0} for lo, hi in edges}
    rank_dist: List[List[float]] = [[] for _ in range(ranks)]

    for s in sessions:
        for i, outcome in enumerate(s["outcomes"]):
            if i >= ranks:
                break
            d = s["distance_atr"][i]
            rank_dist[i].append(d)
            if outcome not in ("rejection", "break"):
                continue
            for lo, hi in edges:
                if lo <= d < hi:
                    buckets[f"{lo:g}-{hi:g} ATR"][outcome] += 1
                    break
    return {"buckets": buckets, "rank_mean_distance": [
        (sum(v) / len(v) if v else None) for v in rank_dist
    ]}


# --------------------------------------------------------------------------
# Report
# --------------------------------------------------------------------------

def fmt_rate(r: Optional[float]) -> str:
    return "  --  " if r is None else f"{r * 100:5.1f}%"


def report(symbol: str, sessions: List[Dict[str, Any]], ranks: int, args: argparse.Namespace) -> None:
    n = len(sessions)
    print(f"\nGEX rank vs. price reaction — {symbol}, {n} sessions")
    print(f"  anchor {args.anchor} ET · touch ±{args.tol_atr} ATR · "
          f"resolve ±{args.move_atr} ATR within {args.horizon} bars · "
          f"{'first touch only' if not args.all_touches else 'every touch'}")
    if n < 80:
        print(f"  ⚠ {n} sessions. On synthetic data this design needs ~80 to detect even a")
        print( "    large effect (p 0.12 at 40, 0.036 at 80). Directional only — do not act on it.")

    s = summarize(sessions, ranks)
    dist = distance_table(sessions, ranks)

    print("\n  rank   touched  reject  break  unres   rate     shuffled-null   p")
    print("  " + "-" * 68)
    for i in range(ranks):
        row = s["per_rank"][i]
        touched = row["rejection"] + row["break"] + row["unresolved"]
        r = rate(row["rejection"], row["break"])
        null = s["null_rates"][i]
        null_mean = sum(null) / len(null) if null else None
        p = empirical_p(r, null)
        print(f"  GEX {i + 1:<2} {touched:7d} {row['rejection']:7d} {row['break']:6d} "
              f"{row['unresolved']:6d}  {fmt_rate(r)}   {fmt_rate(null_mean)}      "
              f"{'  -- ' if p is None else f'{p:.3f}'}")

    rr = rate(s["random"]["rejection"], s["random"]["break"])
    print(f"\n  random strikes (same count, same grid):  {fmt_rate(rr)}"
          f"   n={s['random']['rejection'] + s['random']['break']}")

    print("\n  by distance from the open — the table that decides it")
    print("  " + "-" * 52)
    for label, row in dist["buckets"].items():
        n_b = row["rejection"] + row["break"]
        print(f"  {label:>12}  n={n_b:4d}   rejection {fmt_rate(rate(row['rejection'], row['break']))}")
    print("\n  mean distance from open, per rank (ATR):")
    print("   " + "  ".join(
        f"{i + 1}:{'--' if d is None else f'{d:.1f}'}"
        for i, d in enumerate(dist["rank_mean_distance"])
    ))

    print("\n  How to read this:")
    print("   · 'rate' beating 'shuffled-null' is the only evidence that the ORDER means")
    print("     anything. Similar numbers mean the strikes may be fine and the rank is not.")
    print("   · p is the share of label shuffles at least as extreme. With ten ranks, expect")
    print("     one p below 0.10 by luck alone — do not chase the smallest one.")
    print("   · If the distance buckets differ but ranks within them do not, the ranking")
    print("     metric is the problem, not the level count.\n")


# --------------------------------------------------------------------------
# Self-test
# --------------------------------------------------------------------------

def synthetic_session(rng: random.Random, plant_rank: Optional[int]) -> Dict[str, Any]:
    """A fabricated session where the answer is known in advance.

    Price random-walks. One planted rank REPELS it: come within a whisker and
    price is pushed back the way it came, hard enough to clear the resolve
    threshold. Every other level sees an unbiased walk, so its rejection rate
    should land near 50% -- which is the point. A self-test whose null is not
    genuinely 50/50 cannot tell a working pipeline from a flattering one, and
    the first version of this was 40 identical sessions with no null at all.

    Strike magnitudes descend along a FIXED permutation, so rank maps to strike
    arbitrarily but reproducibly, and the planted rank is not simply the strike
    nearest the open.
    """
    base, spacing = 20000.0, 5.0
    strikes = [base + k * spacing for k in range(-20, 21)]

    order = list(strikes)
    random.Random(11).shuffle(order)                 # fixed across sessions
    gex = {s: (1000.0 - i * 7.0) * (1 if i % 2 else -1) for i, s in enumerate(order)}
    target = order[plant_rank - 1] if plant_rank else None

    price = base + rng.uniform(-6, 6)
    step, repel = 2.5, 0
    candles = []
    for m in range(390):
        if target is not None and repel == 0 and abs(price - target) <= 1.0:
            repel = 12 if price <= target else -12   # sign carries the direction
        if repel > 0:
            price -= abs(rng.gauss(step * 2.0, step)); repel -= 1
        elif repel < 0:
            price += abs(rng.gauss(step * 2.0, step)); repel += 1
        else:
            price += rng.gauss(0, step)

        wick = step * 0.8
        candles.append({
            "timestamp": f"2026-09-03T{9 + (30 + m) // 60:02d}:{(30 + m) % 60:02d}:00-04:00",
            "open": price, "high": price + wick, "low": price - wick, "close": price,
            "volume": 100, "up_volume": 50, "down_volume": 50,
        })

    return {
        "symbol": "SYN", "date": "2026-09-03", "count": 1,
        "frames": [{
            "timestamp": "2026-09-03T09:35:00-04:00",
            "strikes": [{"strike": s, "net_gex": gex[s]} for s in strikes],
        }],
        "candles": candles,
    }


def self_test(args: argparse.Namespace) -> int:
    rng = random.Random(SEED)
    print("Self-test: 120 synthetic sessions, GEX 3 planted to reject, others drifting.")
    sessions = []
    for _ in range(120):
        payload = synthetic_session(rng, plant_rank=3)
        obs = session_observations(
            payload, args.ranks, args.anchor, args.tol_atr, args.move_atr,
            args.horizon, not args.all_touches, rng, args.shuffles,
        )
        if obs:
            sessions.append(obs)

    if not sessions:
        print("FAIL: no sessions survived the pipeline"); return 1

    s = summarize(sessions, args.ranks)
    planted = rate(s["per_rank"][2]["rejection"], s["per_rank"][2]["break"])
    others = [rate(s["per_rank"][i]["rejection"], s["per_rank"][i]["break"])
              for i in range(args.ranks) if i != 2]
    others = [o for o in others if o is not None]

    others_mean = sum(others) / len(others) if others else None
    p_planted = empirical_p(planted, s["null_rates"][2])

    print(f"  sessions kept        : {len(sessions)}")
    print(f"  planted rank 3 rate  : {fmt_rate(planted)}")
    print(f"  other ranks (mean)   : {fmt_rate(others_mean)}")
    print(f"  planted vs shuffled p: {'--' if p_planted is None else f'{p_planted:.4f}'}")

    # Deliberately NOT "the planted rank beats every other rank". With ten ranks
    # each rank carries roughly one observation per session, so some other
    # rank will top the planted one on noise alone -- an earlier version of this
    # check asserted exactly that and failed a pipeline that was working. What
    # the tool claims to detect is a rank standing above the SHUFFLED NULL, so
    # that is what is asserted.
    checks = [
        ("planted rate above 0.70", planted is not None and planted > 0.70),
        ("planted at least 15pts above the mean of the rest",
         planted is not None and others_mean is not None and planted - others_mean > 0.15),
        ("others average near the 50% null",
         others_mean is not None and 0.35 < others_mean < 0.65),
        ("planted separates from the shuffled null (p < 0.05)",
         p_planted is not None and p_planted < 0.05),
    ]
    for label, ok_one in checks:
        print(f"    {'PASS' if ok_one else 'FAIL'}  {label}")

    ok = all(c[1] for c in checks)
    print("\n  PASS — a planted effect is recovered and a null is not invented\n" if ok
          else "\n  FAIL — see the failing check above\n")
    return 0 if ok else 1


# --------------------------------------------------------------------------

def main() -> int:
    p = argparse.ArgumentParser(description="Measure whether GEX rank predicts price reaction.")
    p.add_argument("--symbol", default="NQ")
    p.add_argument("--dates", help="comma-separated YYYY-MM-DD")
    p.add_argument("--last", type=int, help="use the N most recent replayable sessions")
    p.add_argument("--ranks", type=int, default=10)
    p.add_argument("--anchor", default="09:35", help="ET time ranks are fixed at")
    p.add_argument("--tol-atr", type=float, default=0.25, dest="tol_atr")
    p.add_argument("--move-atr", type=float, default=1.0, dest="move_atr")
    p.add_argument("--horizon", type=int, default=30, help="bars allowed to resolve a touch")
    p.add_argument("--all-touches", action="store_true")
    p.add_argument("--shuffles", type=int, default=500)
    p.add_argument("--band-pct", type=float, default=0.04, dest="band_pct")
    p.add_argument("--base", default=os.environ.get("ZEROGEX_API_BASE", DEFAULT_BASE))
    p.add_argument("--key", default=os.environ.get("ZEROGEX_API_KEY", ""))
    p.add_argument("--sleep", type=float, default=0.0,
                   help="seconds between sessions; raise it if the limiter pushes back")
    p.add_argument("--json", help="write the raw per-session observations here")
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args()

    if args.self_test:
        return self_test(args)

    if not args.key:
        print("Set ZEROGEX_API_KEY (any Pro key) or pass --key.", file=sys.stderr)
        return 2
    if not args.dates and not args.last:
        print("Give --dates or --last.", file=sys.stderr)
        return 2

    symbol = args.symbol.upper()
    dates = ([d.strip() for d in args.dates.split(",") if d.strip()] if args.dates
             else list_sessions(args.base, args.key, symbol, args.last))
    if not dates:
        print("No replayable sessions found.", file=sys.stderr)
        return 1

    rng = random.Random(SEED)
    sessions, skipped = [], []
    for d in dates:
        try:
            payload = fetch_session(args.base, args.key, symbol, d, args.band_pct)
        except SystemExit as exc:
            skipped.append(f"{d}: {exc}")
            continue
        obs = session_observations(
            payload, args.ranks, args.anchor, args.tol_atr, args.move_atr,
            args.horizon, not args.all_touches, rng, args.shuffles,
        )
        (sessions.append(obs) if obs else skipped.append(f"{d}: too little data"))
        print(f"  {d} … {'ok' if obs else 'skipped'}", file=sys.stderr)
        if args.sleep:
            time.sleep(args.sleep)

    if not sessions:
        print("Nothing usable.", file=sys.stderr)
        return 1
    if skipped:
        print(f"\n  skipped {len(skipped)}: " + "; ".join(skipped[:5]) +
              (" …" if len(skipped) > 5 else ""), file=sys.stderr)

    report(symbol, sessions, args.ranks, args)

    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump({"symbol": symbol, "args": vars(args), "sessions": sessions}, fh, indent=2)
        print(f"  raw observations → {args.json}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
