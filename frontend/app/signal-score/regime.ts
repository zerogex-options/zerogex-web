export type RegimeKey = 'trend_expansion' | 'controlled_trend' | 'chop_range' | 'high_risk_reversal';

export interface RegimeInfo {
  key: RegimeKey;
  label: string;
  color: string;
  copy: string;
  glyph: '▲' | '▼' | '●' | '■';
  rangeLabel: string;
}

export const REGIME_NEUTRAL_FALLBACK: RegimeInfo = {
  key: 'chop_range',
  label: 'No data',
  color: '#6B7280',
  copy: 'Awaiting first reading.',
  glyph: '●',
  rangeLabel: '—',
};

export const REGIMES: Record<RegimeKey, RegimeInfo> = {
  trend_expansion: {
    key: 'trend_expansion',
    label: 'Trend / Expansion',
    color: '#16A34A',
    copy: 'Strong directional regime — favor trades in the prevailing bias.',
    glyph: '▲',
    rangeLabel: '≥ 70',
  },
  controlled_trend: {
    key: 'controlled_trend',
    label: 'Controlled Trend',
    color: '#65A30D',
    copy: 'Moderate directional edge — trade with reduced size.',
    glyph: '●',
    rangeLabel: '40 – 70',
  },
  chop_range: {
    key: 'chop_range',
    label: 'Chop / Range',
    color: '#D97706',
    copy: 'Range-bound — fade extremes, avoid trend trades.',
    glyph: '■',
    rangeLabel: '20 – 40',
  },
  high_risk_reversal: {
    key: 'high_risk_reversal',
    label: 'High-Risk Reversal',
    color: '#DC2626',
    copy: 'Mean-reversion only — extreme move risk elevated.',
    glyph: '▼',
    rangeLabel: '< 20',
  },
};

export function classifyRegime(score: number | null | undefined): RegimeInfo {
  if (score == null || !Number.isFinite(score)) return REGIME_NEUTRAL_FALLBACK;
  if (score >= 70) return REGIMES.trend_expansion;
  if (score >= 40) return REGIMES.controlled_trend;
  if (score >= 20) return REGIMES.chop_range;
  return REGIMES.high_risk_reversal;
}

export const REGIME_BANDS: ReadonlyArray<{ from: number; to: number; regime: RegimeInfo }> = [
  { from: 0, to: 20, regime: REGIMES.high_risk_reversal },
  { from: 20, to: 40, regime: REGIMES.chop_range },
  { from: 40, to: 70, regime: REGIMES.controlled_trend },
  { from: 70, to: 100, regime: REGIMES.trend_expansion },
];
