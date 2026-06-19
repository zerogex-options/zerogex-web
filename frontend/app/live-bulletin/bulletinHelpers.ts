// Pure data-shaping + copy-generation helpers for the admin social report
// card. Kept framework-free so the formatting rules (and the auto-generated
// headline/lead the operator can then tweak) are testable in isolation and
// shared between the live preview and the PNG export.

export type RegimeKey = 'positive' | 'negative' | 'neutral' | 'unresolved';

// Calendar-free expected-move horizons, expressed as a span length (not a
// specific date) so they read unambiguously whether or not the market is open —
// "Daily" is one trading session of vol, never a promise about a calendar day.
// ~252 trading days a year underpins the √(t/252) annualized-vol scaling.
export type HorizonKey = 'daily' | 'weekly' | 'monthly';

export const HORIZONS: Record<HorizonKey, { label: string; days: number; phrase: string }> = {
  daily: { label: 'Daily', days: 1, phrase: 'over the next session' },
  weekly: { label: 'Weekly', days: 5, phrase: 'over the next week' },
  monthly: { label: 'Monthly', days: 21, phrase: 'over the next month' },
};

const TRADING_DAYS_PER_YEAR = 252;

export interface GexSummaryInput {
  timestamp?: string;
  symbol?: string;
  spot_price?: number | null;
  total_call_gex?: number | null;
  total_put_gex?: number | null;
  net_gex?: number | null;
  net_gex_at_spot?: number | null;
  gamma_flip?: number | null;
  max_pain?: number | null;
  call_wall?: number | null;
  put_wall?: number | null;
  put_call_ratio?: number | null;
}

export interface ReportInputs {
  symbol: string;
  spot: number | null;
  priorClose: number | null;
  summary: GexSummaryInput | null;
  /** Annualized index implied vol in points (e.g. 14.5). Drives the expected-move band. */
  vix: number | null;
  /** Which implied-vol index `vix` came from — VIX for SPX/SPY, VXN for QQQ. Label only. */
  volIndex: 'VIX' | 'VXN';
  horizon: HorizonKey;
}

// The IV-derived expected-move band plus how the dealer-gamma walls sit
// relative to it — the "probability-bounded prediction".
export interface ExpectedRange {
  horizonKey: HorizonKey;
  horizonLabel: string;
  horizonPhrase: string; // natural sentence fragment, e.g. "over the next session"
  days: number;
  volIndex: string; // 'VIX' | 'VXN' — the implied-vol input the band was built from
  vix: number; // the index level used (points)
  sigmaPct: number; // 1σ as a fraction of spot
  moveAbs: number; // 1σ move in points
  low: number;
  high: number;
  context: string; // where the call/put walls fall relative to the band
}

export interface ReportModel {
  symbol: string;
  regime: RegimeKey;
  spot: number | null;
  changePct: number | null;
  changeAbs: number | null;
  gammaFlip: number | null;
  flipDistance: number | null; // spot - flip, in points
  callWall: number | null;
  putWall: number | null;
  maxPain: number | null;
  netGex: number | null;
  putCallRatio: number | null;
  headline: string;
  lead: string;
  regimeBadge: string;
  regimeLabel: string;
  /** Null when VIX or spot is unavailable, in which case the card hides the band. */
  expectedRange: ExpectedRange | null;
}

// Spot within this fraction of the flip is genuinely "at the flip" — mirrors
// GexRegimeHeader's AT_FLIP_BAND_PCT so the card and the live app agree on
// where the regime boundary sits.
const AT_FLIP_BAND_PCT = 0.0025;

export function detectRegime(
  gammaFlip: number | null | undefined,
  spot: number | null | undefined,
): RegimeKey {
  if (gammaFlip == null || !Number.isFinite(gammaFlip)) return 'unresolved';
  if (spot == null || !Number.isFinite(spot) || spot <= 0) return 'unresolved';
  const rel = (spot - gammaFlip) / spot;
  if (Math.abs(rel) <= AT_FLIP_BAND_PCT) return 'neutral';
  return rel > 0 ? 'positive' : 'negative';
}

const REGIME_COPY: Record<RegimeKey, { badge: string; label: string; short: string; explain: string }> = {
  positive: {
    badge: '+ GAMMA REGIME',
    label: 'Positive GEX · pinned, low vol',
    short: 'Dealers Long Gamma',
    explain:
      'Above the flip, dealers hedge against direction — moves get sold into, ranges compress and dips tend to mean-revert.',
  },
  negative: {
    badge: '− GAMMA REGIME',
    label: 'Negative GEX · trending, high vol',
    short: 'Dealers Short Gamma',
    explain:
      'Below the flip, dealer hedging amplifies the tape — moves accelerate, ranges expand and trends extend rather than fade.',
  },
  neutral: {
    badge: '~ GAMMA REGIME',
    label: 'At the flip · transition',
    short: 'Pinned At The Gamma Flip',
    explain:
      'Spot is sitting on the flip — the sign of dealer hedging is unstable here and a small move tips the market into the next regime.',
  },
  unresolved: {
    badge: '? GAMMA REGIME',
    label: 'Flip unresolved this snapshot',
    short: 'Gamma Flip Unresolved',
    explain:
      'The dealer gamma flip could not be resolved from this snapshot — treat positioning levels below as provisional.',
  },
};

export function regimeCopy(regime: RegimeKey) {
  return REGIME_COPY[regime];
}

// Alternate phrasings of each regime's mechanics so the closing line of the
// auto-lead isn't word-for-word identical every time the same regime shows up.
const MECHANICS_VARIANTS: Record<RegimeKey, string[]> = {
  positive: [
    REGIME_COPY.positive.explain,
    'Expect rallies to get faded and dips to get bought as dealers hedge against direction — the net effect is range compression.',
    'Dealer hedging works against momentum here: pushes stall, pullbacks recover, and the tape leans mean-reverting.',
  ],
  negative: [
    REGIME_COPY.negative.explain,
    'Dealer hedging runs with momentum here: breaks extend, dips can cascade, and intraday ranges widen out.',
    'Expect moves to feed on themselves rather than fade — short-gamma hedging chases price and stretches the range.',
  ],
  neutral: [
    REGIME_COPY.neutral.explain,
    'With hedging flow indeterminate right at the flip, the first decisive break is likely to set the tone for the session.',
  ],
  unresolved: [REGIME_COPY.unresolved.explain],
};

// Small deterministic hash → the generated prose stays stable across refreshes
// (same structural snapshot reads the same) yet varies with the underlying's
// own levels, so each report feels written for its conditions rather than
// stamped from one fixed template. Seeded off slow-moving structural values
// (net GEX bucket, flip, walls) — never raw spot — so wording doesn't reshuffle
// on every intraday tick.
function hashSeed(...nums: Array<number | null | undefined>): number {
  let h = 2166136261;
  for (const n of nums) {
    const v = n == null || !Number.isFinite(n) ? 0 : Math.round(n);
    h = Math.imul(h ^ (v & 0xffff), 16777619);
    h = Math.imul(h ^ ((v >>> 16) & 0xffff), 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

export function fmtPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return value.toFixed(2);
}

export function fmtSignedPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

export function fmtSignedPts(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

export function fmtNetGex(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '−';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function fmtRatio(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}x`;
}

export function fmtDateET(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function fmtTimeET(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(d);
}

// Build the derived report model from raw inputs, including the auto-generated
// headline and lead paragraph. The operator can override the prose afterwards;
// this just gives a sane, on-brand starting point keyed off the live numbers.
export function buildReportModel(inputs: ReportInputs): ReportModel {
  const { symbol, summary } = inputs;
  const spot = pickNumber(inputs.spot, summary?.spot_price);
  const gammaFlip = pickNumber(summary?.gamma_flip);
  const callWall = pickNumber(summary?.call_wall);
  const putWall = pickNumber(summary?.put_wall);
  const maxPain = pickNumber(summary?.max_pain);
  const netGex = pickNumber(summary?.net_gex, summary?.net_gex_at_spot);
  const putCallRatio = pickNumber(summary?.put_call_ratio);

  const priorClose = pickNumber(inputs.priorClose);
  const changeAbs = spot != null && priorClose != null ? spot - priorClose : null;
  const changePct =
    spot != null && priorClose != null && priorClose !== 0
      ? ((spot - priorClose) / priorClose) * 100
      : null;

  const regime = detectRegime(gammaFlip, spot);
  const copy = REGIME_COPY[regime];
  const flipDistance = spot != null && gammaFlip != null ? spot - gammaFlip : null;

  const expectedRange = buildExpectedRange({
    spot,
    vix: pickNumber(inputs.vix),
    volIndex: inputs.volIndex,
    horizon: inputs.horizon,
    callWall,
    putWall,
  });

  const headline = buildHeadline({ symbol, spot, changePct, copy });
  const lead = buildLead({
    symbol,
    spot,
    netGex,
    flipDistance,
    gammaFlip,
    callWall,
    putWall,
    regime,
  });

  return {
    symbol,
    regime,
    spot,
    changePct,
    changeAbs,
    gammaFlip,
    flipDistance,
    callWall,
    putWall,
    maxPain,
    netGex,
    putCallRatio,
    headline,
    lead,
    regimeBadge: copy.badge,
    regimeLabel: copy.label,
    expectedRange,
  };
}

// 1σ implied expected-move band: σ% = (VIX/100)·√(days/252); the ±1σ band
// brackets roughly 68% of outcomes under the usual lognormal approximation.
// `context` describes how the dealer call/put walls sit relative to that band —
// the gamma-aware half of the prediction.
function buildExpectedRange(args: {
  spot: number | null;
  vix: number | null;
  volIndex: 'VIX' | 'VXN';
  horizon: HorizonKey;
  callWall: number | null;
  putWall: number | null;
}): ExpectedRange | null {
  const { spot, vix, volIndex, horizon, callWall, putWall } = args;
  if (spot == null || spot <= 0 || vix == null || vix <= 0) return null;

  const { label, days, phrase } = HORIZONS[horizon];
  const sigmaPct = (vix / 100) * Math.sqrt(days / TRADING_DAYS_PER_YEAR);
  const moveAbs = spot * sigmaPct;
  const low = spot - moveAbs;
  const high = spot + moveAbs;

  return {
    horizonKey: horizon,
    horizonLabel: label,
    horizonPhrase: phrase,
    days,
    volIndex,
    vix,
    sigmaPct,
    moveAbs,
    low,
    high,
    context: buildBandContext({ low, high, callWall, putWall }),
  };
}

function buildBandContext(args: {
  low: number;
  high: number;
  callWall: number | null;
  putWall: number | null;
}): string {
  const { low, high, callWall, putWall } = args;
  const callIn = callWall != null ? callWall <= high : null;
  const putIn = putWall != null ? putWall >= low : null;

  if (callIn === true && putIn === true) {
    return 'Both dealer walls sit inside the 1σ range — a textbook pin setup, with the walls as the magnets price gravitates toward.';
  }
  if (callIn === false && putIn === false) {
    return 'Both walls sit outside the 1σ range — reaching either would take a larger-than-implied move.';
  }
  if (callIn === false && putIn === true) {
    return 'The put wall sits inside the 1σ range but the call wall is beyond it — upside needs a bigger-than-implied move to reach resistance.';
  }
  if (callIn === true && putIn === false) {
    return 'The call wall sits inside the 1σ range but the put wall is beyond it — downside support is further than one implied move away.';
  }
  return 'Expected range derived from index implied volatility (1σ ≈ 68%).';
}

function buildHeadline(args: {
  symbol: string;
  spot: number | null;
  changePct: number | null;
  copy: { short: string };
}): string {
  const parts: string[] = [];
  if (args.spot != null) {
    const pct = args.changePct != null ? ` ${fmtSignedPct(args.changePct)}` : '';
    parts.push(`${args.symbol} ${fmtPrice(args.spot)}${pct}.`);
  } else {
    parts.push(`${args.symbol} Dealer Gamma Map.`);
  }
  parts.push(`${args.copy.short}.`);
  return parts.join(' ');
}

function buildLead(args: {
  symbol: string;
  spot: number | null;
  netGex: number | null;
  flipDistance: number | null;
  gammaFlip: number | null;
  callWall: number | null;
  putWall: number | null;
  regime: RegimeKey;
}): string {
  const { spot, netGex, flipDistance, gammaFlip, callWall, putWall, regime } = args;
  // Seed from structural levels only (not raw spot) so the wording is stable
  // intraday but distinct across symbols/conditions.
  const seed = hashSeed(netGex == null ? 0 : Math.round(netGex / 1e8), gammaFlip, callWall, putWall);

  const sentences = [
    describePosture(regime, netGex, seed),
    describeFlipPosition({ spot, flipDistance, gammaFlip, regime, seed: seed + 7 }),
    describeMagnets({ spot, callWall, putWall, seed: seed + 13 }),
    pick(MECHANICS_VARIANTS[regime], seed + 23),
  ];

  return sentences.filter((s): s is string => Boolean(s)).join(' ');
}

// Dealer gamma posture: sign + a magnitude-aware adjective for the size of the
// book, with a few interchangeable phrasings chosen by the seed.
function describePosture(regime: RegimeKey, netGex: number | null, seed: number): string {
  if (netGex == null) {
    return pick(
      [
        'Net dealer gamma did not resolve cleanly this snapshot, so the positioning below is provisional.',
        'Net GEX is unresolved in this snapshot — read the levels below as provisional.',
      ],
      seed,
    );
  }
  const amt = fmtNetGex(netGex);
  const abs = Math.abs(netGex);
  const mag = abs >= 2e9 ? 'heavy' : abs >= 5e8 ? 'moderate' : 'light';
  if (netGex >= 0) {
    const adj = pick(
      mag === 'heavy'
        ? ['a hefty', 'a deep', 'an outsized']
        : mag === 'moderate'
          ? ['a solid', 'a healthy', 'a firm']
          : ['a thin', 'a light', 'a slim'],
      seed,
    );
    return pick(
      [
        `Dealers are carrying ${adj} ${amt} of long gamma, positioning that leans against direction and damps intraday swings.`,
        `With ${adj} ${amt} long-gamma book, dealers are paid to fade pushes and buy dips.`,
        `Dealer gamma is long at ${amt} — ${adj} cushion that tends to compress the range.`,
      ],
      seed,
    );
  }
  const adj = pick(
    mag === 'heavy'
      ? ['a heavy', 'a deep', 'an outsized']
      : mag === 'moderate'
        ? ['a meaningful', 'a sizable', 'a notable']
        : ['a modest', 'a light', 'a small'],
    seed,
  );
  return pick(
    [
      `Dealers are short ${amt} of gamma — ${adj} short book that amplifies moves instead of muting them.`,
      `With ${adj} ${amt} short-gamma position, dealer hedging adds fuel to whichever way price breaks.`,
      `Dealer gamma is short at ${amt}; ${adj} imbalance that lets moves feed on themselves.`,
    ],
    seed,
  );
}

// Where spot sits relative to the flip, with the distance described in words
// that scale to how far away (in % of spot) it actually is.
function describeFlipPosition(args: {
  spot: number | null;
  flipDistance: number | null;
  gammaFlip: number | null;
  regime: RegimeKey;
  seed: number;
}): string | null {
  const { spot, flipDistance, gammaFlip, regime, seed } = args;
  if (gammaFlip == null || flipDistance == null || spot == null || spot <= 0) return null;
  const flipP = fmtPrice(gammaFlip);
  const pts = Math.abs(flipDistance);
  const ptsStr = pts.toFixed(0);
  const pctAway = pts / spot;

  if (regime === 'neutral' || pctAway <= 0.0025) {
    return pick(
      [
        `Price is pinned right on the ${flipP} flip, where the sign of dealer hedging is a coin toss.`,
        `Spot is sitting essentially on the ${flipP} gamma flip — the knife's edge between regimes.`,
        `We're balanced on the ${flipP} flip; a small push tips dealers into the next regime.`,
      ],
      seed,
    );
  }

  const near = pctAway < 0.006;
  const mid = pctAway < 0.015;
  if (flipDistance >= 0) {
    const adj = pick(
      near ? ['just', 'barely', 'only'] : mid ? ['a comfortable', 'a solid'] : ['a wide', 'a stretched', 'an extended'],
      seed,
    );
    return pick(
      [
        `Spot sits ${adj} ${ptsStr} pts above the ${flipP} flip, keeping dealers in long-gamma territory.`,
        `At ${adj} ${ptsStr} pts over the ${flipP} flip, the positive-gamma regime has room to breathe.`,
        `Price is ${adj} ${ptsStr} pts clear of the ${flipP} flip on the long-gamma side.`,
      ],
      seed,
    );
  }
  const adj = pick(
    near ? ['just', 'barely', 'only'] : mid ? ['a clear', 'a solid'] : ['a deep', 'a wide', 'an extended'],
    seed,
  );
  return pick(
    [
      `Spot is ${adj} ${ptsStr} pts below the ${flipP} flip, holding dealers in short-gamma territory.`,
      `At ${adj} ${ptsStr} pts under the ${flipP} flip, the negative-gamma regime is firmly in control.`,
      `Price sits ${adj} ${ptsStr} pts beneath the ${flipP} flip on the short-gamma side.`,
    ],
    seed,
  );
}

// The wall structure: the corridor the walls bracket and which one price leans
// toward, or the single dominant magnet when only one wall is present.
function describeMagnets(args: {
  spot: number | null;
  callWall: number | null;
  putWall: number | null;
  seed: number;
}): string | null {
  const { spot, callWall, putWall, seed } = args;
  if (callWall != null && putWall != null && spot != null) {
    const corridor = Math.abs(callWall - putWall).toFixed(0);
    const nearerCall = Math.abs(callWall - spot) <= Math.abs(spot - putWall);
    const nearName = nearerCall ? 'call wall' : 'put wall';
    const nearPrice = fmtPrice(nearerCall ? callWall : putWall);
    const nearDist = Math.round(Math.abs((nearerCall ? callWall : putWall) - spot));
    return pick(
      [
        `The ${fmtPrice(putWall)} put wall and ${fmtPrice(callWall)} call wall bracket a ${corridor}-pt corridor, with the ${nearName} the nearer magnet ${nearDist} pts off.`,
        `Resistance maps to the ${fmtPrice(callWall)} call wall and support to the ${fmtPrice(putWall)} put wall — a ${corridor}-pt band, and the ${nearName} (${nearPrice}) is closest.`,
        `Walls frame a ${corridor}-pt range from the ${fmtPrice(putWall)} put wall up to the ${fmtPrice(callWall)} call wall; price leans toward the ${nearName}, ${nearDist} pts away.`,
      ],
      seed,
    );
  }
  if (callWall != null) return `The dominant magnet overhead is the ${fmtPrice(callWall)} call wall.`;
  if (putWall != null) return `The dominant magnet below is the ${fmtPrice(putWall)} put wall.`;
  return null;
}

function pickNumber(...candidates: Array<number | null | undefined>): number | null {
  for (const c of candidates) {
    if (c != null && Number.isFinite(c)) return c;
  }
  return null;
}
