import type { FlowSeriesPoint } from '@/hooks/useFlowSeries';

/**
 * Direction overlay for the Composite Score / MSI.
 *
 * The MSI is banded as a *regime* gauge (0–100): high = wider forward travel,
 * low = narrower.
 *
 * It is NOT directionless, and this comment used to claim it was. Two of the six
 * components feeding the composite are documented in the backend as directional
 * reads rather than as reads on how far price travels —
 * `order_flow_imbalance` ("call premium dominates (bullish model output)") and
 * `dealer_delta_pressure` ("dealers are net short delta → bullish for price") —
 * and they enter the sum signed. Holding the entire options structure fixed and
 * varying only the direction of flow moves the composite about 39 points and
 * across three regime bands. Measured against the production scoring engine; see
 * research/msi_regime_excursion/structural.py in zerogex-oa.
 *
 * The practical consequence for anyone reading this file: a hard DOWN move can
 * push the score into the low bands, whose copy describes narrow travel. So the
 * directional read below is layered on a scale that already carries some
 * direction of its own, and the two are not independent.
 *
 * This helper layers a directional read on top for the gauge color only, by
 * combining:
 *
 *   1. the underlying's recent intraday trend (up / down / flat), and
 *   2. the regime's continuation-vs-reversal lean (score above 50 → the
 *      current move is likely to continue; below 50 → reversal is likely).
 *
 * The implied next move — and therefore the color — is:
 *
 *   | Underlying trend | Score      | Implied move | Color   |
 *   |------------------|------------|--------------|---------|
 *   | Up               | High (>50) | Up           | bull 🟢 |
 *   | Up               | Low  (<50) | Down         | bear 🔴 |
 *   | Down             | High (>50) | Down         | bear 🔴 |
 *   | Down             | Low  (<50) | Up           | bull 🟢 |
 *
 * When the underlying is flat, the score is near neutral, or no price data is
 * available, there is no directional implication and the tone is `neutral`.
 */

// Window over which the underlying trend is measured.
const TREND_LOOKBACK_MS = 30 * 60 * 1000; // 30 minutes
// Moves smaller than this over the window read as "flat" (no trend).
const FLAT_PCT = 0.0005; // 0.05%
// Score within this band of 50 carries no continuation/reversal lean.
const SCORE_NEUTRAL_BAND = 3;
const NEUTRAL_SCORE = 50;

export type ImpliedTone = 'bull' | 'bear' | 'neutral';

export interface ImpliedDirection {
  tone: ImpliedTone;
  /** +1 bullish, -1 bearish, 0 neutral. */
  sign: -1 | 0 | 1;
  /** CSS color for the gauge number / needle / label. */
  color: string;
  /** Short label, e.g. "Bullish". */
  label: string;
  /** One-line rationale, e.g. "uptrend at reversal risk". */
  detail: string;
  /** Underlying trend label: "Up" | "Down" | "Flat" | "Unknown". */
  trendLabel: string;
}

/**
 * Signed percentage change of the underlying over the trend window, derived
 * from the flow-series `underlying_price` column. Returns `null` when there
 * isn't enough price data to measure a trend.
 */
export function underlyingTrendPct(rows: FlowSeriesPoint[] | null | undefined): number | null {
  if (!rows || rows.length === 0) return null;

  // Latest bar carrying a real price.
  let last: { ms: number; price: number } | null = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const price = rows[i].underlying_price;
    const ms = Date.parse(rows[i].timestamp);
    if (price != null && Number.isFinite(price) && Number.isFinite(ms)) {
      last = { ms, price };
      break;
    }
  }
  if (!last) return null;

  // Reference bar ~lookback earlier: the most recent priced bar at or before
  // the cutoff. If the session is younger than the lookback, fall back to the
  // earliest priced bar so we still get a since-open read.
  const cutoff = last.ms - TREND_LOOKBACK_MS;
  let ref: { ms: number; price: number } | null = null;
  let earliest: { ms: number; price: number } | null = null;
  for (const row of rows) {
    const price = row.underlying_price;
    const ms = Date.parse(row.timestamp);
    if (price == null || !Number.isFinite(price) || !Number.isFinite(ms)) continue;
    if (earliest == null) earliest = { ms, price };
    if (ms <= cutoff) ref = { ms, price };
  }

  const base = ref ?? earliest;
  if (!base || base.price === 0 || base.ms === last.ms) return null;
  return (last.price - base.price) / base.price;
}

/**
 * Resolve the implied-direction color/label for a given composite score and
 * underlying trend. Pure — safe to call in render / useMemo.
 */
export function impliedDirection(
  score: number | null | undefined,
  trendPct: number | null,
): ImpliedDirection {
  const neutral = (detail: string, trendLabel: string): ImpliedDirection => ({
    tone: 'neutral',
    sign: 0,
    color: 'var(--color-text-primary)',
    label: 'Neutral',
    detail,
    trendLabel,
  });

  if (score == null || !Number.isFinite(score)) return neutral('no score yet', 'Unknown');
  if (trendPct == null) return neutral('underlying trend unavailable', 'Unknown');

  const trendDir = trendPct > FLAT_PCT ? 1 : trendPct < -FLAT_PCT ? -1 : 0;
  const trendLabel = trendDir > 0 ? 'Up' : trendDir < 0 ? 'Down' : 'Flat';
  if (trendDir === 0) return neutral('underlying is flat', trendLabel);

  const scoreOffset = score - NEUTRAL_SCORE;
  if (Math.abs(scoreOffset) < SCORE_NEUTRAL_BAND) return neutral('regime near neutral', trendLabel);

  // Score above 50 → the current move is likely to continue; below → reversal.
  const continues = scoreOffset > 0;
  const impliedUp = trendDir > 0 ? continues : !continues;

  const trendWord = trendDir > 0 ? 'uptrend' : 'downtrend';
  const regimeWord = continues ? 'likely to continue' : 'at reversal risk';
  const detail = `${trendWord} ${regimeWord}`;

  return impliedUp
    ? { tone: 'bull', sign: 1, color: 'var(--color-bull)', label: 'Bullish', detail, trendLabel }
    : { tone: 'bear', sign: -1, color: 'var(--color-bear)', label: 'Bearish', detail, trendLabel };
}
