import { asArray, asObject, getBool, getNumber, SignalTrend, toTrend } from '@/core/signalHelpers';

// The nine directional inputs feeding the bias, on the -100..+100 scale the
// backend serves (netGex is ±50, msi is 0-100). Mirrors the `inputs` block of
// the /api/signals/trade-bias contract.
export const BIAS_INPUT_KEYS = [
  'net_gex',
  'gex_gradient',
  'tape_flow',
  'vanna_charm',
  'odte_positioning',
  'positioning_trap',
  'trap_detection',
  'gamma_vwap',
  'msi',
] as const;

export type BiasInputKey = (typeof BIAS_INPUT_KEYS)[number];

// Structural inputs set the baseline posture (gamma / regime state); tactical
// inputs are the live read that can confirm — or, from Phase 3, override — it.
export const BIAS_INPUT_META: Record<
  BiasInputKey,
  { label: string; layer: 'structural' | 'tactical'; description: string }
> = {
  net_gex: {
    label: 'Gamma Regime',
    layer: 'structural',
    description: 'Sign of net dealer gamma — short γ amplifies moves, long γ pins them.',
  },
  gex_gradient: {
    label: 'GEX Gradient',
    layer: 'structural',
    description: 'Gamma asymmetry above vs below spot.',
  },
  msi: {
    label: 'Composite (MSI)',
    layer: 'structural',
    description: '0-100 regime strength — how likely trends are to run.',
  },
  positioning_trap: {
    label: 'Positioning Trap',
    layer: 'structural',
    description: 'Crowded positioning at risk of a squeeze or flush.',
  },
  trap_detection: {
    label: 'Trap Detection',
    layer: 'structural',
    description: 'Failed-breakout fade — strength/weakness that reverses.',
  },
  gamma_vwap: {
    label: 'Gamma / VWAP',
    layer: 'structural',
    description: 'Price vs the cluster of gamma + VWAP levels.',
  },
  tape_flow: {
    label: 'Tape Flow',
    layer: 'tactical',
    description: 'Directional lean of the live premium tape (calls vs puts).',
  },
  vanna_charm: {
    label: 'Vanna / Charm',
    layer: 'tactical',
    description: 'Dealer vanna + charm hedging tailwind or headwind.',
  },
  odte_positioning: {
    label: '0DTE Positioning',
    layer: 'tactical',
    description: 'Same-day flow tilt weighted by moneyness.',
  },
};

export interface BiasChecklistItem {
  label: string;
  passed: boolean;
}

export interface BiasWatchingItem {
  key: string;
  label: string;
  direction: SignalTrend;
}

export interface TradeBiasPayload {
  tenor: string;
  biasScore: number | null;
  direction: SignalTrend;
  directionRaw: string;
  state: string;
  confidence: number | null; // 0-100
  overrideActive: boolean;
  overrideReason: string | null;
  overruledPosture: string | null;
  gammaRegime: string | null;
  volatilityRegime: string | null;
  marketState: string;
  regimeLabel: string;
  regimeDesc: string;
  biasCode: string;
  biasLabel: string;
  setup: string;
  playbook: string[];
  expectedBehavior: string[];
  checklist: BiasChecklistItem[];
  convictionDriven: boolean;
  watching: BiasWatchingItem[];
  hasData: boolean;
  inputs: Record<BiasInputKey, number | null>;
  timestamp: string | null;
}

export interface TradeBiasHistoryRow {
  timestamp: string;
  biasScore: number;
  marketState: string;
  state: string;
  overrideActive: boolean;
}

function parseStringList(raw: unknown): string[] {
  return asArray(raw)
    .map((v) => (typeof v === 'string' ? v : null))
    .filter((v): v is string => v != null);
}

function parseChecklist(raw: unknown): BiasChecklistItem[] {
  return asArray(raw)
    .map((item) => {
      const obj = asObject(item);
      if (!obj || typeof obj.label !== 'string') return null;
      return { label: obj.label, passed: getBool(obj.passed) };
    })
    .filter((v): v is BiasChecklistItem => v != null);
}

function parseWatching(raw: unknown): BiasWatchingItem[] {
  return asArray(raw)
    .map((item) => {
      const obj = asObject(item);
      if (!obj || typeof obj.label !== 'string') return null;
      return {
        key: typeof obj.key === 'string' ? obj.key : obj.label,
        label: obj.label,
        direction: toTrend(obj.direction),
      };
    })
    .filter((v): v is BiasWatchingItem => v != null);
}

function parseInputs(raw: unknown): Record<BiasInputKey, number | null> {
  const obj = asObject(raw) ?? {};
  const out = {} as Record<BiasInputKey, number | null>;
  for (const key of BIAS_INPUT_KEYS) out[key] = getNumber(obj[key]);
  return out;
}

export function parseBiasPayload(raw: unknown): TradeBiasPayload {
  const obj = asObject(raw) ?? {};
  const biasObj = asObject(obj.bias) ?? {};
  const regimeObj = asObject(obj.regime) ?? {};
  const overrideObj = asObject(obj.override) ?? {};
  const directionRaw = typeof obj.direction === 'string' ? obj.direction : String(biasObj.trend ?? '');

  return {
    tenor: typeof obj.tenor === 'string' ? obj.tenor : 'swing',
    biasScore: getNumber(obj.bias_score),
    direction: toTrend(directionRaw || biasObj.trend),
    directionRaw,
    state: typeof obj.state === 'string' ? obj.state : 'baseline',
    confidence: getNumber(obj.confidence),
    overrideActive: getBool(overrideObj.active),
    overrideReason: typeof overrideObj.reason === 'string' ? overrideObj.reason : null,
    overruledPosture:
      typeof overrideObj.overruled_posture === 'string' ? overrideObj.overruled_posture : null,
    gammaRegime: typeof regimeObj.gamma === 'string' ? regimeObj.gamma : null,
    volatilityRegime: typeof regimeObj.volatility === 'string' ? regimeObj.volatility : null,
    marketState: typeof obj.market_state === 'string' ? obj.market_state : 'UNKNOWN',
    regimeLabel: typeof obj.regime_label === 'string' ? obj.regime_label : '—',
    regimeDesc: typeof obj.regime_desc === 'string' ? obj.regime_desc : '',
    biasCode: typeof biasObj.code === 'string' ? biasObj.code : 'WAIT',
    biasLabel: typeof biasObj.label === 'string' ? biasObj.label : 'Neutral',
    setup: typeof obj.setup === 'string' ? obj.setup : '',
    playbook: parseStringList(obj.playbook),
    expectedBehavior: parseStringList(obj.expected_behavior),
    checklist: parseChecklist(obj.checklist),
    convictionDriven: getBool(obj.conviction_driven),
    watching: parseWatching(obj.watching),
    hasData: getBool(obj.has_data),
    inputs: parseInputs(obj.inputs),
    timestamp: typeof obj.timestamp === 'string' ? obj.timestamp : null,
  };
}

export function parseBiasHistory(raw: unknown): TradeBiasHistoryRow[] {
  const rows: TradeBiasHistoryRow[] = [];
  for (const item of asArray(raw)) {
    const obj = asObject(item);
    if (!obj) continue;
    const ts = obj.timestamp;
    const score = getNumber(obj.bias_score);
    if (typeof ts !== 'string' || score == null) continue;
    const overrideObj = asObject(obj.override) ?? {};
    rows.push({
      timestamp: ts,
      biasScore: score,
      marketState: typeof obj.market_state === 'string' ? obj.market_state : 'UNKNOWN',
      state: typeof obj.state === 'string' ? obj.state : 'baseline',
      overrideActive: getBool(overrideObj.active),
    });
  }
  // Server returns DESC (newest first); flip to ASC for plotting.
  rows.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return rows;
}
