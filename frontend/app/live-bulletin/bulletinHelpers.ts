// Pure data-shaping + copy-generation helpers for the admin social report
// card. Kept framework-free so the formatting rules (and the auto-generated
// headline/lead the operator can then tweak) are testable in isolation and
// shared between the live preview and the PNG export.

import { volIndexPricesSymbol } from '../../core/symbols.ts';
import { longGammaAtSpot, netGexAtSpotOrNull } from '../../core/gammaRegime.ts';
import { firstLevel } from '../../core/levelValue.ts';

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
  // Pin Strike — reachable 0DTE positive-gamma pin (distinct from wall/flip/max-pain).
  pin_strike?: number | null;
  pin_score?: number | null;
  pin_confidence?: number | null;
  pin_strike_reason?: string | null;
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
  /**
   * True when `spot` is a futures-implied projection (a cash index like SPX
   * outside the cash session) rather than a live cash print. Drives the
   * "futures-implied via ESZ26" indicator on the card so it never reads as a
   * live SPX quote. `spotSourceLabel` names the instrument it came from: the
   * CME contract when the quote carries one ("ESZ26"), the bare ticker
   * otherwise ("ES").
   */
  spotIsProjected?: boolean;
  spotSourceLabel?: string | null;
  /**
   * Net GEX resampled at the futures-implied open, read off the
   * `/api/gex/profile` spot-shift curve (see {@link sampleGexProfile}).
   * Supplied ONLY when `spot` is a projection: the summary's
   * `net_gex_at_spot` was evaluated at the frozen cash spot, which during an
   * overnight gap sits on the OPPOSITE side of the flip from the implied open
   * — so quoting it makes the auto-lead's "dealers are long/short gamma"
   * posture contradict the spot-vs-flip regime. When null (in-session, or the
   * profile is unavailable) the summary's `net_gex_at_spot` is used unchanged.
   */
  impliedNetGex?: number | null;
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
  pinStrike: number | null;
  netGex: number | null;
  putCallRatio: number | null;
  headline: string;
  lead: string;
  regimeBadge: string;
  regimeLabel: string;
  /** Null when VIX or spot is unavailable, in which case the card hides the band. */
  expectedRange: ExpectedRange | null;
  /** True when `spot` is a futures-implied projection (see ReportInputs). */
  spotIsProjected: boolean;
  /**
   * The instrument the spot was projected from — the CME contract when the
   * quote named one ("ESZ26"), otherwise the bare ticker ("ES"). Null when the
   * spot is a live cash print.
   */
  spotSourceLabel: string | null;
}

// Spot within this fraction of the flip is genuinely "at the flip": a real
// regime-transition zone, ~0.25% of spot. The one definition the Today's Read
// (dashboard and Dealer Positioning), the Live Bulletin and the free levels
// cards share, so they all agree on where the regime boundary sits.
const AT_FLIP_BAND_PCT = 0.0025;

/**
 * The dealer-gamma regime that Today's Read, the Live Bulletin and the free
 * levels cards all show. One function, so the three can't disagree.
 *
 * With a flip, it is where spot sits against it: inside the ±0.25% at-flip
 * band ('neutral') or on one side of it.
 *
 * With no flip, it is the sign of `netGexAtSpot`. The engine publishes no flip
 * when no zero crossing sits near enough to spot, as when spot is deep inside
 * one regime: the session a trader most wants the answer. `net_gex_at_spot` is
 * read off the same spot-shift curve as the flip, so its sign is the regime
 * with or without a crossing (core/gammaRegime). Zero reads long, as in
 * `longGammaAtSpot`, which drives the Key Levels chip and the chart's Dealer
 * Gamma @ Spot badge, so those and this read the same regime.
 *
 * Pass the at-spot value only, never the whole-chain `net_gex` total, which can
 * carry the opposite sign. The parameter is required so a new caller can't
 * drop it and bring "unresolved" back on a one-sided book.
 *
 * 'unresolved' only when there is neither a flip to place spot against nor a
 * dealer-gamma reading at spot.
 */
export function detectRegime(
  gammaFlip: number | null | undefined,
  spot: number | null | undefined,
  netGexAtSpot: number | null | undefined,
): RegimeKey {
  if (
    gammaFlip != null &&
    Number.isFinite(gammaFlip) &&
    spot != null &&
    Number.isFinite(spot) &&
    spot > 0
  ) {
    const rel = (spot - gammaFlip) / spot;
    if (Math.abs(rel) <= AT_FLIP_BAND_PCT) return 'neutral';
    return rel > 0 ? 'positive' : 'negative';
  }
  const long = longGammaAtSpot(netGexAtSpotOrNull(netGexAtSpot), null, null);
  if (long == null) return 'unresolved';
  return long ? 'positive' : 'negative';
}

type RegimeCopy = { badge: string; label: string; short: string; explain: string };

const REGIME_COPY: Record<RegimeKey, RegimeCopy> = {
  positive: {
    badge: '+ GAMMA REGIME',
    label: 'Positive GEX · pinned, low vol',
    short: 'Dealers Long Gamma',
    explain:
      'Above the flip, dealers hedge against direction\u00a0- moves get sold into, ranges compress and dips tend to mean-revert.',
  },
  negative: {
    badge: '− GAMMA REGIME',
    label: 'Negative GEX · trending, high vol',
    short: 'Dealers Short Gamma',
    explain:
      'Below the flip, dealer hedging amplifies the tape\u00a0- moves accelerate, ranges expand and trends extend rather than fade.',
  },
  neutral: {
    badge: '~ GAMMA REGIME',
    label: 'At the flip · transition',
    short: 'Pinned At The Gamma Flip',
    explain:
      'Spot is sitting on the flip\u00a0- the sign of dealer hedging is unstable here and a small move tips the market into the next regime.',
  },
  // Neither a flip nor dealer gamma at spot (see detectRegime), so the snapshot
  // can't say which regime spot is in. Net GEX is missing too here, so the
  // auto-lead's posture sentence already calls the levels provisional; this
  // line says why the regime is blank rather than repeat it.
  unresolved: {
    badge: '? GAMMA REGIME',
    label: 'Regime unresolved this snapshot',
    short: 'Gamma Regime Unresolved',
    explain:
      'Without a gamma flip or a dealer-gamma reading at spot, this snapshot cannot say which regime spot is in.',
  },
};

// A positive / negative regime read off the sign of dealer gamma at spot,
// because no flip sits near spot (see detectRegime). Same badge and headline as
// with a flip; only the lines that place spot against a flip change, since the
// card has no flip to place it against. Nothing here says "provisional": a
// one-sided book with no nearby crossing is a finding, not a gap in the data.
const NO_FLIP_COPY: Record<'positive' | 'negative', Pick<RegimeCopy, 'label' | 'explain'>> = {
  positive: {
    label: 'Positive GEX · no flip near spot',
    explain:
      'Dealer hedging leans against direction here\u00a0- moves get sold into, ranges compress and dips tend to mean-revert.',
  },
  negative: {
    label: 'Negative GEX · no flip near spot',
    explain:
      'Dealer hedging amplifies the tape here\u00a0- moves accelerate, ranges expand and trends extend rather than fade.',
  },
};

/**
 * The regime's badge, label, headline phrase and mechanics line. Pass
 * `hasFlip: false` when the snapshot has no flip, so a positive / negative
 * regime (read off dealer gamma at spot) gets copy that doesn't mention one.
 */
export function regimeCopy(regime: RegimeKey, hasFlip = true): RegimeCopy {
  if (hasFlip || (regime !== 'positive' && regime !== 'negative')) return REGIME_COPY[regime];
  return { ...REGIME_COPY[regime], ...NO_FLIP_COPY[regime] };
}

// Alternate phrasings of each regime's mechanics so the closing line of the
// auto-lead isn't word-for-word identical every time the same regime shows up.
// The first choice is always the regime copy's own `explain` (the no-flip one
// when there is no flip), then these. This line lands right after the wall
// sentence, so it describes what dealer hedging does, never whether the walls
// hold: our study of 737 wall tests found the regime did not change how often
// walls broke (content/articles/how-often-do-gamma-walls-break.md).
const MECHANICS_ALTERNATES: Record<RegimeKey, string[]> = {
  positive: [
    'Dealers hedge against direction here, selling into rallies and buying into dips\u00a0- the net effect is range compression.',
    'Dealer hedging works against momentum here, leaning on pushes in either direction, and the tape leans mean-reverting.',
  ],
  negative: [
    'Dealer hedging runs with momentum here: a break has hedging behind it, dips can cascade, and intraday ranges widen out.',
    'Short-gamma hedging chases price here, so moves can feed on themselves and stretch the range.',
  ],
  neutral: [
    'With hedging flow indeterminate right at the flip, the first decisive break is likely to set the tone for the session.',
  ],
  unresolved: [],
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
// headline and lead paragraph. The operator can override the prose afterward;
// this just gives a sane, on-brand starting point keyed off the live numbers.
/** A market quote's optional index->future display-swap fields (attached by
 * /api/market/quote when INDEX_FUTURES_DISPLAY_ENABLED and the symbol is a
 * cash index outside the cash session). */
export interface FuturesSwapFields {
  display_source?: string | null;
  data_symbol?: string | null;
  futures_close?: number | null; // the future now (e.g. @ES)
  futures_reference_close?: number | null; // the future's own 16:00 print
  data_contract?: string | null; // the CME contract it resolves to, e.g. "ESZ26"
}

/**
 * Futures-implied cash-index spot for the card, mirroring the backend
 * `implied_index_spot`: `cashRefClose + (future_now − future_ref)`. The
 * index↔future basis at the close cancels, so this tracks the future's
 * overnight *move* applied to the cash close.
 *
 * Returns null (caller keeps the live/cash spot) when the quote isn't a
 * futures swap or any input is missing — so an ETF or an in-session cash
 * index is never projected.
 */
export function projectedIndexSpot(
  quote: FuturesSwapFields | null | undefined,
  cashRefClose: number | null | undefined,
): { spot: number; sourceLabel: string } | null {
  if (!quote || quote.display_source !== 'futures') return null;
  const now = quote.futures_close;
  const ref = quote.futures_reference_close;
  if (now == null || ref == null || cashRefClose == null) return null;
  if (!Number.isFinite(now) || !Number.isFinite(ref) || !Number.isFinite(cashRefClose)) return null;
  // Name the CONTRACT where the quote gives one. The card is screenshotted into
  // tweets and support replies, and "via ES" is the same ambiguity that started
  // the "your futures price is wrong" reports: it does not say which ES, and a
  // reader comparing against a platform still on the previous contract is a
  // quarter of cost-of-carry away. Falls back to the bare ticker for a cash
  // symbol, an older backend, or a cached response, exactly as before.
  return {
    spot: cashRefClose + (now - ref),
    sourceLabel:
      (quote.data_contract ?? '').trim() || (quote.data_symbol ?? '').trim() || 'futures',
  };
}

/**
 * Sample the spot-shift dealer dollar-gamma curve (`/api/gex/profile`) at an
 * arbitrary price — the frontend twin of the engine's `_net_gex_at_spot`.
 *
 * The curve is ascending by price and its value at the cash `spot_price` IS the
 * summary's `net_gex_at_spot`; its zero crossing is the `gamma_flip`. Sampling
 * it at the futures-implied open therefore yields the net GEX the book would
 * carry AT THAT open — which, unlike the frozen cash-spot figure, sits on the
 * same side of the flip as the projected spot (so the "long/short gamma"
 * posture can't contradict the regime badge).
 *
 * Piecewise-linear between grid points and clamped to the endpoints outside the
 * grid — identical to the engine, so the two agree exactly at the cash spot.
 * Returns null when the curve or price is unusable, so the caller falls back to
 * the summary's `net_gex_at_spot`.
 */
export function sampleGexProfile(
  profile: ReadonlyArray<{ price: number; gex: number }> | null | undefined,
  price: number | null | undefined,
): number | null {
  if (price == null || !Number.isFinite(price) || !profile) return null;
  const pts = profile.filter((p) => p && Number.isFinite(p.price) && Number.isFinite(p.gex));
  if (pts.length === 0) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (price <= first.price) return first.gex;
  if (price >= last.price) return last.gex;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (a.price <= price && price <= b.price) {
      if (b.price === a.price) return b.gex;
      return a.gex + ((b.gex - a.gex) * (price - a.price)) / (b.price - a.price);
    }
  }
  return last.gex;
}

export function buildReportModel(inputs: ReportInputs): ReportModel {
  const { symbol, summary } = inputs;
  const spot = pickNumber(inputs.spot, summary?.spot_price);
  const gammaFlip = pickNumber(summary?.gamma_flip);
  const callWall = pickNumber(summary?.call_wall);
  const putWall = pickNumber(summary?.put_wall);
  const maxPain = pickNumber(summary?.max_pain);
  const pinStrike = pickNumber(summary?.pin_strike);
  // Net GEX evaluated AT THE DISPLAYED SPOT — never the chain-wide total (which
  // can carry the opposite sign when far-OTM strikes dominate the tail). This is
  // the value every other Net-GEX surface on the site shows (dashboard,
  // gamma-exposure, greeks-gex, the free gamma-levels cards), and its sign
  // agrees with the spot-vs-flip regime — so the auto-lead's "dealers are
  // long/short gamma" can never contradict the regime badge or the metric card.
  //
  // When `spot` is a futures-implied open, `impliedNetGex` (resampled at that
  // price off the gex-profile curve) takes precedence over the summary's
  // `net_gex_at_spot`, which was frozen at the cash spot on the far side of the
  // flip — see ReportInputs.impliedNetGex.
  //
  // With no flip, this value IS the regime (detectRegime), so it is coerced the
  // way the free levels cards coerce theirs (netGexAtSpotOrNull, via
  // firstLevel): a served "-1.03e9" string reads as a number on both, and
  // Today's Read can't call a regime the card beside it doesn't.
  const netGex = firstLevel(inputs.impliedNetGex, summary?.net_gex_at_spot);
  const putCallRatio = pickNumber(summary?.put_call_ratio);

  const priorClose = pickNumber(inputs.priorClose);
  const changeAbs = spot != null && priorClose != null ? spot - priorClose : null;
  const changePct =
    spot != null && priorClose != null && priorClose !== 0
      ? ((spot - priorClose) / priorClose) * 100
      : null;

  // With no flip the regime is the sign of `netGex`, the same at-spot figure
  // the card prints and the auto-lead's posture sentence reads, so the badge,
  // the Net GEX stat and "dealers are long/short gamma" tell one story. During
  // a futures-implied open that is the figure resampled at the implied open.
  const regime = detectRegime(gammaFlip, spot, netGex);
  const copy = regimeCopy(regime, gammaFlip != null);
  const flipDistance = spot != null && gammaFlip != null ? spot - gammaFlip : null;

  // No range for a single stock: VIX / VXN measure the market, not the name,
  // and would price NVDA's range at about half what its options imply.
  const expectedRange = buildExpectedRange({
    spot,
    vix: volIndexPricesSymbol(symbol) ? pickNumber(inputs.vix) : null,
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
    explain: copy.explain,
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
    pinStrike,
    netGex,
    putCallRatio,
    headline,
    lead,
    regimeBadge: copy.badge,
    regimeLabel: copy.label,
    expectedRange,
    spotIsProjected: inputs.spotIsProjected === true && spot != null,
    spotSourceLabel: inputs.spotSourceLabel ?? null,
  };
}

// 1σ implied expected-move band: σ% = (VIX/100)·√(days/252); the ±1σ band
// brackets roughly 68% of outcomes under the usual lognormal approximation.
// `context` describes how the dealer call/put walls sit relative to that band —
// the gamma-aware half of the prediction.
// Exported so the Gamma Chart's on-chart Expected Range overlay is drawn from
// the exact same math as the Live Bulletin card — the two never disagree.
export function buildExpectedRange(args: {
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

/**
 * The ±1σ move implied for one session, in price units: the half-width of the
 * Daily Expected Range, read off {@link buildExpectedRange} so the two can
 * never disagree. The far-pin rule (core/pinStrike pinDistance) measures in
 * these units whichever horizon the overlay is showing.
 *
 * `volIndexLevel` is the VIX (or VXN) reading in points. Null when spot or the
 * reading is missing or non-positive.
 */
export function dailyExpectedMove(
  spot: number | null | undefined,
  volIndexLevel: number | null | undefined,
): number | null {
  const range = buildExpectedRange({
    spot: spot != null && Number.isFinite(spot) ? spot : null,
    vix: volIndexLevel != null && Number.isFinite(volIndexLevel) ? volIndexLevel : null,
    // Labels only; the move is the same whichever index it is named after.
    volIndex: 'VIX',
    horizon: 'daily',
    callWall: null,
    putWall: null,
  });
  return range ? range.moveAbs : null;
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
    return 'Both dealer walls sit inside the 1σ range\u00a0- a textbook pin setup, with the walls as the magnets price gravitates toward.';
  }
  if (callIn === false && putIn === false) {
    return 'Both walls sit outside the 1σ range\u00a0- reaching either would take a larger-than-implied move.';
  }
  if (callIn === false && putIn === true) {
    return 'The put wall sits inside the 1σ range but the call wall is beyond it\u00a0- upside needs a bigger-than-implied move to reach resistance.';
  }
  if (callIn === true && putIn === false) {
    return 'The call wall sits inside the 1σ range but the put wall is beyond it\u00a0- downside support is further than one implied move away.';
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
  /** The regime copy's mechanics line: the no-flip one when there is no flip. */
  explain: string;
}): string {
  const { spot, netGex, flipDistance, gammaFlip, callWall, putWall, regime, explain } = args;
  // Seed from structural levels only (not raw spot) so the wording is stable
  // intraday but distinct across symbols/conditions.
  const seed = hashSeed(netGex == null ? 0 : Math.round(netGex / 1e8), gammaFlip, callWall, putWall);

  const sentences = [
    describePosture(regime, netGex, seed),
    gammaFlip == null
      ? describeNoFlip(regime, seed + 7)
      : describeFlipPosition({ spot, flipDistance, gammaFlip, regime, seed: seed + 7 }),
    describeMagnets({ spot, callWall, putWall, seed: seed + 13 }),
    pick([explain, ...MECHANICS_ALTERNATES[regime]], seed + 23),
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
        'Net GEX is unresolved in this snapshot\u00a0- read the levels below as provisional.',
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
        `Dealer gamma is long at ${amt}\u00a0- ${adj} cushion that tends to compress the range.`,
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
      `Dealers are short ${amt} of gamma\u00a0- ${adj} short book that amplifies moves instead of muting them.`,
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
        `Spot is sitting essentially on the ${flipP} gamma flip\u00a0- the knife's edge between regimes.`,
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

// The sentence that stands in for the flip position when there is no flip: the
// regime came off the sign of dealer gamma at spot (detectRegime), so say that
// plainly, and that no flip sits near spot, rather than go quiet about the
// missing level or call the read provisional.
function describeNoFlip(regime: RegimeKey, seed: number): string | null {
  if (regime !== 'positive' && regime !== 'negative') return null;
  const side = regime === 'positive' ? 'long-gamma' : 'short-gamma';
  return pick(
    [
      `No gamma flip sits near spot this snapshot: price is in ${side} territory, with no nearby level where that turns.`,
      `There is no flip close enough to spot to publish, so the ${side} read comes from the sign of dealer gamma at spot.`,
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
        `Resistance maps to the ${fmtPrice(callWall)} call wall and support to the ${fmtPrice(putWall)} put wall\u00a0- a ${corridor}-pt band, and the ${nearName} (${nearPrice}) is closest.`,
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
