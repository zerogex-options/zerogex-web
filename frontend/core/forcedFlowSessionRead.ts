// Forced-flow session read — the interpretation layer for the full-session
// forced-flow field (the ForcedFlowSurfaceChart). The chart draws the field;
// this turns it into the two questions a trader actually asks of it, correctly
// distinguishing the two kinds of zero-flow level:
//
//   • MAGNET (attractor): dealers buy below it and sell above, so forced flow
//     RESTORES price to it — a stable pin. Price is pulled toward it.
//   • PIVOT (repeller): dealers sell below it and buy above, so forced flow
//     PUSHES price away — an unstable, short-gamma tipping point / tripwire.
//     Price is repelled from it; a break through it accelerates.
//
// A level sitting near spot is only a "magnet" if it's an attractor. A repeller
// that happens to sit near spot is a pivot, not a magnet — mislabeling it was
// the bug this read now fixes.
//
//   1. WHERE IS PRICE LIKELY HEADED?  If the nearest level is a magnet, toward
//      it (and the projected close magnet is the field's close target). If it's a
//      pivot, the field is amplifying — price is pushed away from the pivot in
//      whichever direction it's already leaning.
//
//   2. HOW HAS PRICE REACTED SO FAR?  A within-session backtest. In a pinning
//      regime: did price move TOWARD the magnet ("pin respect")? In an amplifying
//      regime: did price run AWAY from the pivot ("ran off the pivot")? Moving
//      away from a repeller is the field WORKING, not being fought.
//
// Pure and dependency-free so it is unit-testable under the node test runner and
// reusable off the same payload the chart already fetches (see
// ForcedFlowSessionColumn — magnet + pivot come straight from the response).

export interface SessionColumnLike {
  min_to_close: number;
  spot: number;
  magnet: number | null; // attractor (stable pin)
  pivot: number | null; // repeller (unstable tripwire)
  is_past: boolean;
}

export interface ForcedFlowSessionReadInput {
  spot: number;
  columns: SessionColumnLike[];
  now_index: number;
}

export type BiasDir = 'up' | 'down' | 'flat';

// The field's structure at spot right now:
//   pin     — the nearest zero-flow level is a magnet (attractor); long-gamma-like.
//   pivot   — the nearest is a repeller; short-gamma, dealers amplify moves.
//   none    — no zero-flow level near spot.
//   unknown — too little session has printed to read.
export type FieldRegime = 'pin' | 'pivot' | 'none' | 'unknown';

export interface ForcedFlowSessionRead {
  magnetNow: number | null; // nearest attractor to spot
  pivotNow: number | null; // nearest repeller to spot
  regime: FieldRegime;

  // The level the read keys on: the magnet in a pinning regime, the pivot in an
  // amplifying one.
  keyLevel: number | null;
  keyLevelKind: 'pin' | 'pivot' | null;
  keyLevelPoints: number | null; // keyLevel − spot
  keyLevelPct: number | null;

  // Q1 — directional bias.
  biasDir: BiasDir | null;
  closeTarget: number | null; // projected close MAGNET (attractor), when one exists
  closeTargetPct: number | null;

  // Q2 — reaction over the realized session.
  reactionKind: 'respect' | 'amplify' | null; // toward-magnet vs away-from-pivot
  reactionPct: number | null;
  reactionObeyed: number;
  reactionTotal: number;

  headline: string;
  sentence: string;
}

// Below this |level−spot|/spot the bias is treated as flat (4 bps ≈ 0.3 pt on a
// 7800 index). A step's level must lean at least PULL_EPS to count toward the
// reaction, and the realized move must clear MOVE_EPS.
const BIAS_EPS_PCT = 0.0004;
const PULL_EPS_PCT = 0.00004;
const MOVE_EPS_PCT = 0.00001;
// Minimum realized steps before the reaction % is worth leaning on in the prose.
const MIN_STEPS = 5;

function isFiniteNum(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v);
}

// Price formatter that tracks instrument scale: whole points on an index
// (spot ≥ 1000), 2 dp on an ETF.
function fmtPrice(v: number, spot: number): string {
  return v.toFixed(spot >= 1000 ? 0 : 2);
}

// Signed points, scale-aware.
function fmtPoints(v: number, spot: number): string {
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const abs = Math.abs(v);
  const dp = spot >= 1000 ? (abs >= 10 ? 0 : 1) : 2;
  return `${sign}${abs.toFixed(dp)}`;
}

function fmtPct(frac: number): string {
  return `${Math.round(frac * 100)}%`;
}

function emptyRead(): ForcedFlowSessionRead {
  return {
    magnetNow: null,
    pivotNow: null,
    regime: 'unknown',
    keyLevel: null,
    keyLevelKind: null,
    keyLevelPoints: null,
    keyLevelPct: null,
    biasDir: null,
    closeTarget: null,
    closeTargetPct: null,
    reactionKind: null,
    reactionPct: null,
    reactionObeyed: 0,
    reactionTotal: 0,
    headline: 'No read yet',
    sentence: 'Not enough of the session has printed to read the field yet.',
  };
}

export function computeForcedFlowSessionRead(
  input: ForcedFlowSessionReadInput | null | undefined,
): ForcedFlowSessionRead {
  if (!input || !Array.isArray(input.columns) || !(input.spot > 0)) return emptyRead();
  const { spot, columns } = input;

  const past = columns.filter((c) => c && c.is_past && Number.isFinite(c.spot));
  if (past.length < 2) return emptyRead();

  const nowCol =
    (input.now_index >= 0 && input.now_index < columns.length && columns[input.now_index]?.is_past
      ? columns[input.now_index]
      : past[past.length - 1]) ?? past[past.length - 1];
  const magnetNow = isFiniteNum(nowCol.magnet) ? nowCol.magnet : null;
  const pivotNow = isFiniteNum(nowCol.pivot) ? nowCol.pivot : null;

  // --- Regime: which kind of level is NEAREST spot right now. ---
  const distMag = magnetNow != null ? Math.abs(magnetNow - spot) : Infinity;
  const distPiv = pivotNow != null ? Math.abs(pivotNow - spot) : Infinity;
  let regime: FieldRegime;
  if (!Number.isFinite(distMag) && !Number.isFinite(distPiv)) regime = 'none';
  else if (distMag <= distPiv) regime = 'pin';
  else regime = 'pivot';

  const keyLevelKind: 'pin' | 'pivot' | null =
    regime === 'pin' ? 'pin' : regime === 'pivot' ? 'pivot' : null;
  const keyLevel = regime === 'pin' ? magnetNow : regime === 'pivot' ? pivotNow : null;
  const keyLevelPoints = keyLevel != null ? keyLevel - spot : null;
  const keyLevelPct = keyLevel != null ? keyLevel / spot - 1 : null;

  // --- Q1b: projected close MAGNET (attractor extrapolated to the bell). ---
  const lastCol = columns[columns.length - 1];
  const closeTarget = lastCol && isFiniteNum(lastCol.magnet) ? lastCol.magnet : null;
  const closeTargetPct = closeTarget != null ? closeTarget / spot - 1 : null;

  // --- Q2: reaction backtest, keyed to the regime. In a pinning regime, count
  // steps where price moved TOWARD that column's magnet; in an amplifying one,
  // steps where price ran AWAY from that column's pivot. ---
  const pullEps = spot * PULL_EPS_PCT;
  const moveEps = spot * MOVE_EPS_PCT;
  let obeyed = 0;
  let total = 0;
  const reactionKind: 'respect' | 'amplify' | null =
    regime === 'pin' ? 'respect' : regime === 'pivot' ? 'amplify' : null;
  if (reactionKind) {
    for (let i = 0; i < past.length - 1; i++) {
      const a = past[i];
      const b = past[i + 1];
      const level = reactionKind === 'respect' ? a.magnet : a.pivot;
      if (!isFiniteNum(level)) continue;
      // Toward a magnet: pull points from spot to the magnet. Away from a pivot:
      // the "push" points from the pivot to spot (the side price is already on).
      const drive = reactionKind === 'respect' ? level - a.spot : a.spot - level;
      const move = b.spot - a.spot;
      if (Math.abs(drive) < pullEps) continue;
      if (Math.abs(move) < moveEps) continue;
      total++;
      if (drive * move > 0) obeyed++;
    }
  }
  const reactionPct = total > 0 ? obeyed / total : null;

  // --- Bias. Pin: toward the magnet (close target preferred). Pivot: the
  // amplification direction — away from the pivot, i.e. the side spot sits on. ---
  let biasDir: BiasDir | null = null;
  if (regime === 'pin') {
    const refPct = closeTargetPct ?? (magnetNow != null ? magnetNow / spot - 1 : null);
    if (refPct != null) {
      biasDir = refPct > BIAS_EPS_PCT ? 'up' : refPct < -BIAS_EPS_PCT ? 'down' : 'flat';
    }
  } else if (regime === 'pivot' && pivotNow != null) {
    const d = spot / pivotNow - 1;
    biasDir = d > BIAS_EPS_PCT ? 'up' : d < -BIAS_EPS_PCT ? 'down' : 'flat';
  }

  const { headline, sentence } = synthesize({
    spot,
    regime,
    biasDir,
    keyLevel,
    magnetNow,
    pivotNow,
    closeTarget,
    reactionKind,
    reactionPct,
    reactionTotal: total,
  });

  return {
    magnetNow,
    pivotNow,
    regime,
    keyLevel,
    keyLevelKind,
    keyLevelPoints,
    keyLevelPct,
    biasDir,
    closeTarget,
    closeTargetPct,
    reactionKind,
    reactionPct,
    reactionObeyed: obeyed,
    reactionTotal: total,
    headline,
    sentence,
  };
}

function synthesize(a: {
  spot: number;
  regime: FieldRegime;
  biasDir: BiasDir | null;
  keyLevel: number | null;
  magnetNow: number | null;
  pivotNow: number | null;
  closeTarget: number | null;
  reactionKind: 'respect' | 'amplify' | null;
  reactionPct: number | null;
  reactionTotal: number;
}): { headline: string; sentence: string } {
  const { spot, regime, biasDir, keyLevel, magnetNow, closeTarget, reactionPct, reactionTotal } = a;

  if (regime === 'unknown') {
    return {
      headline: 'Forming',
      sentence: 'Too little of the session has printed to read the field yet.',
    };
  }
  if (regime === 'none' || keyLevel == null) {
    return {
      headline: 'No level near spot',
      sentence:
        'No zero-flow level sits near spot right now — no pin or pivot to lean on; price is between structures.',
    };
  }

  const lvl = fmtPrice(keyLevel, spot);
  const pts = fmtPoints(keyLevel - spot, spot);
  const scored = reactionPct != null && reactionTotal >= MIN_STEPS;
  const pct = reactionPct != null ? fmtPct(reactionPct) : null;

  if (regime === 'pin') {
    const target = closeTarget != null ? fmtPrice(closeTarget, spot) : lvl;
    const dirTail =
      biasDir === 'up'
        ? `Base case: drift/hold up toward ${target} into the close.`
        : biasDir === 'down'
          ? `Base case: drift/hold down toward ${target} into the close.`
          : `Base case: chop pinned around ${target} into the close.`;
    let reactSentence = '';
    if (scored && reactionPct != null) {
      const how =
        reactionPct >= 0.55
          ? `Price has respected it (${pct} of moves toward it)`
          : reactionPct <= 0.4
            ? `Price has been overpowering it (${pct} of moves toward it)`
            : `Price has loosely tracked it (${pct} of moves toward it)`;
      reactSentence = `${how} this session. `;
    } else {
      reactSentence = 'Reaction is still scoring this early in the session. ';
    }
    const headline =
      biasDir === 'up' ? 'Upward pin' : biasDir === 'down' ? 'Downward pin' : 'Flat pin';
    return {
      headline,
      sentence: `The nearest zero-flow level is a stable pin (magnet) at ${lvl} (${pts}) — dealers sell above it and buy below, so it pulls price in. ${reactSentence}${dirTail}`,
    };
  }

  // pivot / amplifying (short gamma)
  const pinTail =
    magnetNow != null
      ? `The nearest stable pin sits at ${fmtPrice(magnetNow, spot)}.`
      : 'No stable pin sits nearby.';
  let reactSentence = '';
  if (scored && reactionPct != null) {
    reactSentence =
      reactionPct >= 0.55
        ? `Price has run off it ${pct} of the time this session — moves extend, not revert. `
        : `Price has held near it (only ${pct} of moves ran away) — coiling rather than breaking. `;
  } else {
    reactSentence = 'Reaction is still scoring this early in the session. ';
  }
  const pushWord = biasDir === 'up' ? 'upward' : biasDir === 'down' ? 'downward' : 'either-way';
  return {
    headline: 'Amplifying · short γ',
    sentence: `Price is sitting by a pivot at ${lvl} (${pts}), not a pin — dealers buy above it and sell below, so they amplify moves here (short gamma), currently a ${pushWord} push. ${reactSentence}A break back through ${lvl} flips the push the other way. ${pinTail}`,
  };
}
