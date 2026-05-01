import { asObject, getNumber } from '@/core/signalHelpers';

export const COMPONENT_KEYS = [
  'net_gex_sign',
  'gamma_anchor',
  'put_call_ratio',
  'volatility_regime',
  'order_flow_imbalance',
  'dealer_delta_pressure',
] as const;

export type ComponentKey = (typeof COMPONENT_KEYS)[number];

export interface GammaAnchorContext {
  flipDistance: number | null;
  localGamma: number | null;
  priceVsMaxGamma: number | null;
  weights: { flipDistance: number; localGamma: number; priceVsMaxGamma: number };
}

export interface ComponentEntry {
  key: ComponentKey;
  maxPoints: number;
  contribution: number | null;
  score: number | null;
  context?: GammaAnchorContext | null;
}

export interface CompositePayload {
  composite: number | null;
  components: ComponentEntry[];
}

export interface CompositeHistoryRow {
  timestamp: string;
  composite: number;
  components: ComponentEntry[];
}

const DEFAULT_BLEND = { flipDistance: 0.45, localGamma: 0.35, priceVsMaxGamma: 0.20 };

export function parseComponent(key: ComponentKey, raw: unknown): ComponentEntry {
  const obj = asObject(raw) ?? {};
  let context: GammaAnchorContext | null | undefined;
  if (key === 'gamma_anchor') {
    const ctx = asObject(obj.context);
    if (ctx) {
      const weights = asObject(ctx.blend_weights) ?? {};
      context = {
        flipDistance: getNumber(ctx.flip_distance_subscore),
        localGamma: getNumber(ctx.local_gamma_subscore),
        priceVsMaxGamma: getNumber(ctx.price_vs_max_gamma_subscore),
        weights: {
          flipDistance: getNumber(weights.flip_distance) ?? DEFAULT_BLEND.flipDistance,
          localGamma: getNumber(weights.local_gamma) ?? DEFAULT_BLEND.localGamma,
          priceVsMaxGamma: getNumber(weights.price_vs_max_gamma) ?? DEFAULT_BLEND.priceVsMaxGamma,
        },
      };
    } else {
      context = null;
    }
  }
  return {
    key,
    maxPoints: getNumber(obj.max_points) ?? 0,
    contribution: getNumber(obj.contribution),
    score: getNumber(obj.score),
    context,
  };
}

export function parseComponents(raw: unknown): ComponentEntry[] {
  const obj = asObject(raw) ?? {};
  return COMPONENT_KEYS.map((key) => parseComponent(key, obj[key]));
}

export function parsePayload(raw: unknown): CompositePayload {
  const obj = asObject(raw) ?? {};
  return {
    composite: getNumber(obj.composite_score),
    components: parseComponents(obj.components),
  };
}

export function parseHistory(raw: unknown): CompositeHistoryRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: CompositeHistoryRow[] = [];
  for (const item of raw) {
    const obj = asObject(item);
    if (!obj) continue;
    const ts = obj.timestamp;
    const score = getNumber(obj.composite_score);
    if (typeof ts !== 'string' || score == null) continue;
    rows.push({
      timestamp: ts,
      composite: score,
      components: parseComponents(obj.components),
    });
  }
  // Server returns DESC (newest first); flip to ASC for plotting / lookups.
  rows.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return rows;
}

// Each component returns a raw score in [-1, +1]. By the MSI's convention
// (see scoring_engine.py): +1 pushes the composite toward the trending /
// expansion regime; -1 pushes it toward chop / pinning / high-risk reversal.
// The MSI is a regime gauge, not a directional (bull/bear) gauge — except
// for order_flow_imbalance, which is the one truly directional input.
const COMPONENT_LABELS: Record<ComponentKey, { title: string; description: string; positive: string; negative: string }> = {
  net_gex_sign: {
    title: 'Net GEX Sign',
    description: 'Sign of dealer aggregate gamma — does the book pin price (long γ) or amplify it (short γ)?',
    positive: 'Net GEX < 0 → dealers short gamma, hedges amplify moves → trends can run.',
    negative: 'Net GEX > 0 → dealers long gamma, hedges damp moves → pinning / mean reversion.',
  },
  gamma_anchor: {
    title: 'Gamma Anchor',
    description: 'Blended proximity to gamma flip, local gamma density, and max-gamma strike.',
    positive: 'Price is "free" — flip near, thin local gamma, far from max-gamma → expect movement.',
    negative: 'Price is "anchored" — far from flip, dense local gamma, at max-gamma → expect chop / pinning.',
  },
  put_call_ratio: {
    title: 'Put/Call Ratio',
    description: 'OI-weighted put-to-call tilt as a structural-fragility proxy.',
    positive: 'High PCR → fear-hedged book → larger moves possible.',
    negative: 'Low PCR → call-heavy / complacent → setup leans to mean-reversion.',
  },
  volatility_regime: {
    title: 'Volatility Regime',
    description: 'VIX (or realized σ fallback) vs the 20-vol pivot.',
    positive: 'VIX > 20 → live vol regime, trends extend.',
    negative: 'VIX < 20 → calm tape, trends die into chop.',
  },
  order_flow_imbalance: {
    title: 'Order Flow Imbalance',
    description: 'Smart-money call vs put premium imbalance — the only directional component.',
    positive: 'Smart-money calls dominate → bullish lead, MSI shifts toward expansion.',
    negative: 'Smart-money puts dominate → bearish lead, MSI shifts toward reversal.',
  },
  dealer_delta_pressure: {
    title: 'Dealer Delta Pressure',
    description: 'Dealer net delta forced-hedge direction. Leads gamma intraday.',
    positive: 'Dealers short delta → must buy rallies → bullish hedge tailwind.',
    negative: 'Dealers long delta → must sell rallies → bearish hedge headwind.',
  },
};

export function getComponentLabel(key: ComponentKey) {
  return COMPONENT_LABELS[key];
}
