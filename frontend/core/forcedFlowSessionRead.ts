// Forced-flow session read — the interpretation layer for the full-session
// forced-flow field (the ForcedFlowSurfaceChart). The chart draws the field;
// this turns it into the two questions a trader actually asks of it:
//
//   1. WHERE IS PRICE LIKELY HEADED?  The field pulls price toward the magnet
//      (the zero-flow price where dealers have nothing left to hedge). So the
//      directional read is the magnet's LEAN off spot now, and — because charm
//      resolves the book into the bell — the PROJECTED CLOSE magnet, the field's
//      implied close target.
//
//   2. HOW HAS PRICE REACTED TO THE FIELD SO FAR?  A within-session backtest:
//      at each past time-slice the field was pulling price a direction
//      (magnet − spot); did price's NEXT move actually go that way? The fraction
//      of steps that obeyed is "pin respect" — high means the field is in
//      control (mean-reverting pin), low means price is fighting it (a
//      short-gamma / trend regime where the magnet is a weak target).
//
// Pure and dependency-free so it is unit-testable under the node test runner and
// reusable off the same payload the chart already fetches. All inputs are fields
// the /session-surface response already carries (see ForcedFlowSessionColumn) —
// no extra request, no backend change.

export interface SessionColumnLike {
  min_to_close: number;
  spot: number;
  magnet: number | null;
  is_past: boolean;
}

export interface ForcedFlowSessionReadInput {
  spot: number;
  columns: SessionColumnLike[];
  now_index: number;
}

// How hard price is obeying the field this session.
//   pinned   — price mean-reverts to the magnet; the field controls the tape.
//   fighting — price runs away from the magnet; dealers aren't in control.
//   balanced — a loose attractor; price only half-tracks it.
//   unknown  — too little session has printed to judge yet.
export type PinRegime = 'pinned' | 'fighting' | 'balanced' | 'unknown';

export type BiasDir = 'up' | 'down' | 'flat';

export interface ForcedFlowSessionRead {
  // --- Q1: directional bias (where the field points). ---
  magnetNow: number | null; // zero-flow price at the now column
  leanNowPoints: number | null; // magnetNow − spot, in price points
  leanNowPct: number | null; // …as a fraction of spot
  closeTarget: number | null; // projected close magnet (mtc→0 column)
  closeTargetPoints: number | null; // closeTarget − spot
  closeTargetPct: number | null; // …as a fraction of spot
  biasDir: BiasDir | null; // net directional call (close target, else now-lean)

  // --- Q2: reaction (how price has obeyed the field so far). ---
  respectPct: number | null; // fraction of past steps price moved toward its magnet
  obeyedSteps: number;
  totalSteps: number;
  gapNowPoints: number | null; // |magnetNow − spot|, the live pin distance
  gapTrend: 'converging' | 'diverging' | 'steady' | null; // is the pin tightening?
  regime: PinRegime;

  // --- Synthesis. ---
  headline: string; // short label, e.g. "Upward pin"
  sentence: string; // one-line plain-English read answering both questions
}

// Below this |lean|/spot the magnet is treated as sitting ON spot — no
// directional bias to call (4 bps ≈ 0.3 pt on a 7800 index).
const BIAS_EPS_PCT = 0.0004;
// A step's pull is only counted toward "respect" if the magnet leans at least
// this far off spot (0.4 bps) — below it there is no direction to obey and the
// crossing is numerical noise. And the realised move must clear 0.1 bp so a flat
// tick doesn't score.
const PULL_EPS_PCT = 0.00004;
const MOVE_EPS_PCT = 0.00001;
// Respect thresholds and the minimum steps before we call a regime at all.
const RESPECT_PINNED = 0.58;
const RESPECT_FIGHTING = 0.42;
const MIN_STEPS = 5;

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function isFiniteMagnet(m: number | null | undefined): m is number {
  return m != null && Number.isFinite(m);
}

// Price formatter that tracks instrument scale: whole points on an index
// (spot ≥ 1000), 2 dp on an ETF.
function fmtPrice(v: number, spot: number): string {
  return v.toFixed(spot >= 1000 ? 0 : 2);
}

function fmtPct(frac: number): string {
  return `${Math.round(frac * 100)}%`;
}

function emptyRead(): ForcedFlowSessionRead {
  return {
    magnetNow: null,
    leanNowPoints: null,
    leanNowPct: null,
    closeTarget: null,
    closeTargetPoints: null,
    closeTargetPct: null,
    biasDir: null,
    respectPct: null,
    obeyedSteps: 0,
    totalSteps: 0,
    gapNowPoints: null,
    gapTrend: null,
    regime: 'unknown',
    headline: 'No read yet',
    sentence: 'Not enough of the session has printed to read the field yet.',
  };
}

export function computeForcedFlowSessionRead(
  input: ForcedFlowSessionReadInput | null | undefined,
): ForcedFlowSessionRead {
  if (!input || !Array.isArray(input.columns) || !(input.spot > 0)) return emptyRead();
  const { spot, columns } = input;

  // Chronological actual columns (open → now). is_past covers history + the now
  // column; projection columns (is_past === false) are excluded from the
  // reaction backtest — they haven't happened.
  const past = columns.filter((c) => c && c.is_past && Number.isFinite(c.spot));
  if (past.length < 2) return emptyRead();

  // --- Q1a: now-lean. Prefer the flagged now column; fall back to last actual.
  const nowCol =
    (input.now_index >= 0 && input.now_index < columns.length && columns[input.now_index]?.is_past
      ? columns[input.now_index]
      : past[past.length - 1]) ?? past[past.length - 1];
  const magnetNow = isFiniteMagnet(nowCol.magnet) ? nowCol.magnet : null;
  const leanNowPoints = magnetNow != null ? magnetNow - spot : null;
  const leanNowPct = leanNowPoints != null ? leanNowPoints / spot : null;

  // --- Q1b: projected close target — the mtc→0 magnet (last column overall,
  // which is the deepest projection into the bell). Captures the into-close
  // charm drift the now-lean doesn't yet show.
  const lastCol = columns[columns.length - 1];
  const closeTarget = lastCol && isFiniteMagnet(lastCol.magnet) ? lastCol.magnet : null;
  const closeTargetPoints = closeTarget != null ? closeTarget - spot : null;
  const closeTargetPct = closeTargetPoints != null ? closeTargetPoints / spot : null;

  // --- Q2: reaction backtest. For each consecutive pair of actual columns, was
  // the field's pull (magnet − spot) the same sign as the realised next move?
  const pullEps = spot * PULL_EPS_PCT;
  const moveEps = spot * MOVE_EPS_PCT;
  let obeyed = 0;
  let total = 0;
  for (let i = 0; i < past.length - 1; i++) {
    const a = past[i];
    const b = past[i + 1];
    if (!isFiniteMagnet(a.magnet)) continue;
    const pull = a.magnet - a.spot; // where the field was pulling at time i
    const move = b.spot - a.spot; // what price actually did next
    if (Math.abs(pull) < pullEps) continue; // no direction to obey
    if (Math.abs(move) < moveEps) continue; // price didn't move — no test
    total++;
    if (pull * move > 0) obeyed++;
  }
  const respectPct = total > 0 ? obeyed / total : null;

  // --- Q2b: is the pin tightening (typical into the close) or breaking apart?
  const gaps = past
    .filter((c) => isFiniteMagnet(c.magnet))
    .map((c) => Math.abs((c.magnet as number) - c.spot));
  let gapTrend: ForcedFlowSessionRead['gapTrend'] = null;
  if (gaps.length >= 6) {
    const k = Math.max(1, Math.floor(gaps.length / 3));
    const early = mean(gaps.slice(0, k));
    const late = mean(gaps.slice(-k));
    if (early > 0 && late < early * 0.7) gapTrend = 'converging';
    else if (early > 0 && late > early * 1.4) gapTrend = 'diverging';
    else gapTrend = 'steady';
  }
  const gapNowPoints = leanNowPoints != null ? Math.abs(leanNowPoints) : null;

  // --- Regime from respect (only once enough steps have printed). ---
  let regime: PinRegime = 'unknown';
  if (respectPct != null && total >= MIN_STEPS) {
    regime =
      respectPct >= RESPECT_PINNED
        ? 'pinned'
        : respectPct <= RESPECT_FIGHTING
          ? 'fighting'
          : 'balanced';
  }

  // --- Bias direction: the forward statement (close target) if we have it,
  // else the instantaneous now-lean. ---
  const refPct = closeTargetPct ?? leanNowPct;
  let biasDir: BiasDir | null = null;
  if (refPct != null) {
    biasDir = refPct > BIAS_EPS_PCT ? 'up' : refPct < -BIAS_EPS_PCT ? 'down' : 'flat';
  }

  const { headline, sentence } = synthesize({
    spot,
    regime,
    biasDir,
    respectPct,
    totalSteps: total,
    closeTarget,
    magnetNow,
    gapTrend,
  });

  return {
    magnetNow,
    leanNowPoints,
    leanNowPct,
    closeTarget,
    closeTargetPoints,
    closeTargetPct,
    biasDir,
    respectPct,
    obeyedSteps: obeyed,
    totalSteps: total,
    gapNowPoints,
    gapTrend,
    regime,
    headline,
    sentence,
  };
}

function synthesize(a: {
  spot: number;
  regime: PinRegime;
  biasDir: BiasDir | null;
  respectPct: number | null;
  totalSteps: number;
  closeTarget: number | null;
  magnetNow: number | null;
  gapTrend: ForcedFlowSessionRead['gapTrend'];
}): { headline: string; sentence: string } {
  const { spot, regime, biasDir, respectPct, closeTarget, magnetNow, gapTrend } = a;
  const respect = respectPct != null ? fmtPct(respectPct) : null;
  // The level to name as the target: the projected close magnet, else the live
  // magnet, else spot.
  const target = closeTarget ?? magnetNow ?? spot;
  const targetStr = fmtPrice(target, spot);
  const diverging = gapTrend === 'diverging';

  // Bias phrase fragments.
  const upDown = biasDir === 'up' ? 'up' : biasDir === 'down' ? 'down' : 'flat';

  // Not enough session yet to judge reaction — lead with the bias only.
  if (regime === 'unknown') {
    if (biasDir === 'flat' || biasDir == null) {
      return {
        headline: 'Forming',
        sentence: `Too little of the session has printed to judge how price is reacting to the field yet. Right now the pin sits essentially on spot — no directional lean.`,
      };
    }
    return {
      headline: biasDir === 'up' ? 'Forming · up' : 'Forming · down',
      sentence: `Too little of the session has printed to judge how price is reacting yet, but the field leans ${upDown}, toward ${targetStr} into the close.`,
    };
  }

  if (regime === 'pinned') {
    if (biasDir === 'flat') {
      return {
        headline: 'Flat pin',
        sentence: `Price has respected the pin this session — ${respect} of moves ran toward the zero-flow line — and it sits essentially on spot. Base case is chop pinned around ${targetStr}, not a directional push, unless price breaks out of the field.`,
      };
    }
    const bandNote =
      biasDir === 'up'
        ? 'dips into the green (dealer-buy) band below spot should get bought back'
        : 'pops into the red (dealer-sell) band above spot should get faded';
    return {
      headline: biasDir === 'up' ? 'Upward pin' : 'Downward pin',
      sentence: `Price has respected the pin this session — ${respect} of moves ran toward the zero-flow line — and the field leans ${upDown}. Base case is a drift/pin toward ${targetStr} into the close; ${bandNote}.`,
    };
  }

  if (regime === 'fighting') {
    return {
      headline: 'Fighting the pin',
      sentence: `Price has been fighting the field this session — only ${respect} of moves ran toward the pin, so dealers aren't controlling the tape here. Treat the magnet at ${targetStr} as a weak target: moves are extending rather than reverting, so respect the trend over the pin until this flips.`,
    };
  }

  // balanced
  const leanTail =
    biasDir === 'flat' || biasDir == null
      ? 'with no clear directional lean'
      : `with a mild ${upDown}ward lean toward ${targetStr}`;
  const divTail = diverging
    ? ' The pin has been widening, not tightening — a caution flag for leaning on it.'
    : '';
  return {
    headline: 'Loose pin',
    sentence: `Price has only loosely tracked the field this session (${respect} of moves toward the pin) — a mild attractor, not a hard one, ${leanTail}.${divTail}`,
  };
}
