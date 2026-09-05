// The band copy describes MEASURED forward travel and deliberately stops there.
//
// research/msi_regime_excursion in zerogex-oa scored every persisted reading from
// 2026-06-29 to 2026-09-03 against the price action that followed it, at 5 / 15 /
// 30 / 60 minutes and rest-of-session, against the unconditional base rate. Two
// things came out of it that these strings have to respect:
//
//  1. The ORDER is right. Mean forward range rises monotonically across the four
//     bands on every instrument at every horizon. No inversion anywhere.
//  2. The EFFECT IS SMALL — a rank correlation of roughly 0.15 to 0.24, with
//     trend_expansion around 1.20x the base rate and the bottom band around 0.85x.
//     That supports a description, not an instruction.
//
// So the copy no longer tells anyone what to do ("favor trades in", "fade
// extremes", "trade with reduced size"). It reports what the band has preceded.
//
// The bottom band was previously labelled "High-Risk Reversal" with the copy
// "Mean-reversion only — extreme move risk elevated". It is in fact the band with
// the LEAST forward travel (~0.85x the base rate on both SPX and ES, at every
// horizon), so both the name and the copy pointed the opposite way to the data.
// Its reversal claim was never measured at all. Renamed to "Compression", which
// is what it demonstrably is. The RegimeKey is unchanged: it is a database CHECK
// constraint value and gates seventeen playbook patterns.
//
// No magnitude is quoted in the copy on purpose. The effect size differs per
// instrument, and NDX/NQ are known to be unreliable until the
// dealer_delta_pressure normalizer is fixed (see
// docs/design/msi-regime-excursion.md §5). Quote numbers once that lands and the
// study is re-run.
export type RegimeKey = 'trend_expansion' | 'controlled_trend' | 'chop_range' | 'high_risk_reversal';

export interface RegimeInfo {
  key: RegimeKey;
  label: string;
  color: string;
  softColor: string;
  copy: string;
  glyph: '◆' | '●' | '■' | '◇';
  rangeLabel: string;
}

export const REGIME_NEUTRAL_FALLBACK: RegimeInfo = {
  key: 'chop_range',
  label: 'No data',
  color: 'var(--color-text-secondary)',
  softColor: 'transparent',
  copy: 'Awaiting first reading.',
  glyph: '●',
  rangeLabel: '—',
};

export const REGIMES: Record<RegimeKey, RegimeInfo> = {
  trend_expansion: {
    key: 'trend_expansion',
    label: 'Trend / Expansion',
    color: 'var(--regime-trend)',
    softColor: 'color-mix(in srgb, var(--regime-trend) 16%, transparent)',
    copy: 'Widest forward travel of the four bands, historically.',
    glyph: '◆',
    rangeLabel: '≥ 70',
  },
  controlled_trend: {
    key: 'controlled_trend',
    label: 'Controlled Trend',
    color: 'var(--regime-controlled)',
    softColor: 'color-mix(in srgb, var(--regime-controlled) 16%, transparent)',
    copy: 'Above-average forward travel, historically.',
    glyph: '●',
    rangeLabel: '40 – 70',
  },
  chop_range: {
    key: 'chop_range',
    label: 'Chop / Range',
    color: 'var(--regime-chop)',
    softColor: 'color-mix(in srgb, var(--regime-chop) 16%, transparent)',
    copy: 'Below-average forward travel, historically.',
    glyph: '■',
    rangeLabel: '20 – 40',
  },
  high_risk_reversal: {
    key: 'high_risk_reversal',
    label: 'Compression',
    color: 'var(--regime-reversal)',
    softColor: 'color-mix(in srgb, var(--regime-reversal) 16%, transparent)',
    copy: 'Narrowest forward travel of the four bands, historically.',
    glyph: '◇',
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
