// Pure data-shaping + copy-generation helpers for the admin social report
// card. Kept framework-free so the formatting rules (and the auto-generated
// headline/lead the operator can then tweak) are testable in isolation and
// shared between the live preview and the PNG export.

export type RegimeKey = 'positive' | 'negative' | 'neutral' | 'unresolved';

// Calendar-free expected-move horizons, in trading days, so the band never
// depends on an expiry feed. ~252 trading days a year underpins the √(t/252)
// annualized-vol scaling.
export type HorizonKey = 'today' | 'week' | 'month';

export const HORIZONS: Record<HorizonKey, { label: string; days: number }> = {
  today: { label: 'Today', days: 1 },
  week: { label: 'This Week', days: 5 },
  month: { label: 'This Month', days: 21 },
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
    copy,
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

  const { label, days } = HORIZONS[horizon];
  const sigmaPct = (vix / 100) * Math.sqrt(days / TRADING_DAYS_PER_YEAR);
  const moveAbs = spot * sigmaPct;
  const low = spot - moveAbs;
  const high = spot + moveAbs;

  return {
    horizonKey: horizon,
    horizonLabel: label,
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
  copy: { explain: string };
}): string {
  const sentences: string[] = [];

  if (args.netGex != null) {
    const tone = args.netGex >= 0 ? 'net long' : 'net short';
    sentences.push(`Dealers sit ${tone} gamma at ${fmtNetGex(args.netGex)}.`);
  }

  if (args.gammaFlip != null && args.flipDistance != null) {
    const dir = args.flipDistance >= 0 ? 'above' : 'below';
    sentences.push(
      `Spot is ${Math.abs(args.flipDistance).toFixed(0)} pts ${dir} the ${fmtPrice(args.gammaFlip)} flip.`,
    );
  }

  const walls: string[] = [];
  if (args.callWall != null) walls.push(`call wall ${fmtPrice(args.callWall)}`);
  if (args.putWall != null) walls.push(`put wall ${fmtPrice(args.putWall)}`);
  if (walls.length) sentences.push(`Key magnets: ${walls.join(', ')}.`);

  sentences.push(args.copy.explain);

  return sentences.join(' ');
}

function pickNumber(...candidates: Array<number | null | undefined>): number | null {
  for (const c of candidates) {
    if (c != null && Number.isFinite(c)) return c;
  }
  return null;
}
