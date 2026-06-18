// Pure data-shaping + copy-generation helpers for the admin social report
// card. Kept framework-free so the formatting rules (and the auto-generated
// headline/lead the operator can then tweak) are testable in isolation and
// shared between the live preview and the PNG export.

export type RegimeKey = 'positive' | 'negative' | 'neutral' | 'unresolved';

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
  };
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
