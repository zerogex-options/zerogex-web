'use client';

import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';

interface GEXSummaryData {
  net_gex: number;
  net_gex_at_spot?: number | null;
  gamma_flip?: number | null;
  spot_price?: number;
}

interface QuoteData {
  close: number;
  symbol?: string;
}

interface GexRegimeHeaderProps {
  gexSummary: GEXSummaryData | null | undefined;
  quoteData: QuoteData | null | undefined;
  symbol: string;
  marketContextSummary?: string;
  postureTag?: 'Aggressive' | 'Balanced' | 'Defensive';
  contextHorizon?: 'intraday' | 'swing';
  onContextHorizonChange?: (horizon: 'intraday' | 'swing') => void;
}

type Regime = 'positive' | 'negative' | 'neutral' | 'unresolved';

// Spot within this fraction of the flip is genuinely "at the flip" — a real
// regime-transition zone. ~0.25% of spot (≈ $1.85 on a $740 SPY). Anything
// outside the band is decisively above/below the flip: 11.95 pts (~1.6%)
// is below-flip, NOT "at the flip".
const AT_FLIP_BAND_PCT = 0.0025;

// Regime is defined purely by spot vs the gamma flip (zero-gamma) level —
// the industry-standard definition (SpotGamma / SqueezeMetrics). Above the
// flip dealers are net long gamma (vol-dampening, mean-reverting); below it
// they are net short gamma (vol-amplifying, trending). It is NOT gated on
// the sign of the chain-wide net-GEX total — doing so previously produced a
// false "At the Flip" whenever the two disagreed.
//
// 'unresolved' is reserved for "the backend couldn't resolve a flip this
// snapshot" (degraded chain / morning-open IV-spike artifact / etc).  It
// is NOT the same as 'neutral' (spot genuinely sitting in the at-flip
// band) — conflating them would have the scenario chip claim "At the Flip
// (neutral, transition)" whenever the flip is missing, which is exactly
// the misleading display the user reported.
function detectRegime(
  gammaFlip: number | null | undefined,
  spotPrice: number | undefined,
): Regime {
  if (gammaFlip == null) return 'unresolved';
  if (spotPrice == null || spotPrice <= 0) return 'unresolved';
  const rel = (spotPrice - gammaFlip) / spotPrice;
  if (Math.abs(rel) <= AT_FLIP_BAND_PCT) return 'neutral';
  return rel > 0 ? 'positive' : 'negative';
}

const regimeConfig: Record<Regime, { badge: string; label: string; color: string; bgColor: string; borderColor: string }> = {
  positive: {
    badge: '+ Gamma Regime',
    label: 'Positive GEX (pinned, low vol)',
    color: 'var(--color-bull)',
    bgColor: 'var(--color-bull-soft)',
    borderColor: 'var(--color-bull)',
  },
  negative: {
    badge: '- Gamma Regime',
    label: 'Negative GEX (trending, high vol)',
    color: 'var(--color-bear)',
    bgColor: 'var(--color-bear-soft)',
    borderColor: 'var(--color-bear)',
  },
  neutral: {
    badge: '~ Gamma Regime',
    label: 'At the Flip (neutral, transition)',
    color: 'var(--color-brand-primary)',
    bgColor: 'var(--color-warning-soft)',
    borderColor: 'var(--color-warning)',
  },
  unresolved: {
    badge: '? Gamma Regime',
    label: 'Flip unresolved this snapshot',
    color: 'var(--text-secondary)',
    bgColor: 'var(--color-surface-subtle)',
    borderColor: 'var(--color-border)',
  },
};

const postureConfig: Record<NonNullable<GexRegimeHeaderProps['postureTag']>, { color: string; bgColor: string; borderColor: string }> = {
  Aggressive: {
    color: 'var(--color-bear)',
    bgColor: 'var(--color-bear-soft)',
    borderColor: 'var(--color-bear)',
  },
  Balanced: {
    color: 'var(--color-brand-primary)',
    bgColor: 'var(--color-warning-soft)',
    borderColor: 'var(--color-warning)',
  },
  Defensive: {
    color: 'var(--color-bull)',
    bgColor: 'var(--color-bull-soft)',
    borderColor: 'var(--color-bull)',
  },
};

export default function GexRegimeHeader({
  gexSummary,
  quoteData,
  symbol,
  marketContextSummary,
  postureTag,
  contextHorizon,
  onContextHorizonChange,
}: GexRegimeHeaderProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = 'var(--text-primary)';
  const cardBg = 'var(--bg-card)';

  const gammaFlip = gexSummary?.gamma_flip ?? null;
  const spotPrice = quoteData?.close;
  const regime = detectRegime(gammaFlip, spotPrice);
  const config = regimeConfig[regime];

  const flipDistance = gammaFlip != null && spotPrice != null ? spotPrice - gammaFlip : null;
  const aboveFlip = flipDistance != null && flipDistance >= 0;

  return (
    <div
      className="rounded-2xl p-4 mb-6"
      style={{ backgroundColor: cardBg, border: `1px solid ${'var(--text-secondary)'}` }}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Left: Regime badge */}
        <div className="flex items-center gap-2">
          <div
            className="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap"
            style={{
              backgroundColor: config.bgColor,
              color: config.color,
              border: `1px solid ${config.borderColor}`,
            }}
          >
            {config.badge}
          </div>
          {postureTag && (
            <div
              className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap uppercase tracking-wide"
              style={{
                backgroundColor: postureConfig[postureTag].bgColor,
                color: postureConfig[postureTag].color,
                border: `1px solid ${postureConfig[postureTag].borderColor}`,
              }}
            >
              {postureTag}
            </div>
          )}
        </div>

        {/* Center: Gamma flip + price info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 text-sm">
          <span style={{ color: textColor }}>
            <span className="font-semibold">Gamma flip:</span>{' '}
            <span style={{ color: config.color, fontWeight: 700 }}>
              {gammaFlip != null ? `$${gammaFlip.toFixed(2)}` : '--'}
            </span>
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {symbol} last: <span style={{ color: textColor, fontWeight: 500 }}>{spotPrice != null ? `$${spotPrice.toFixed(2)}` : '--'}</span>
            {flipDistance != null && (
              <>
                {' — '}
                <span style={{ color: aboveFlip ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                  {Math.abs(flipDistance).toFixed(2)} pts {aboveFlip ? 'above' : 'below'} flip
                </span>
              </>
            )}
          </span>
        </div>

        {/* Right: Scenario label */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Scenario:</span>
          <div
            className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={{
              backgroundColor: config.bgColor,
              color: config.color,
              border: `1px solid ${config.borderColor}`,
            }}
          >
            {config.label}
          </div>
        </div>
      </div>
      {marketContextSummary && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-semibold text-sm" style={{ color: textColor }}>Market Context</span>
            <button
              onClick={() => onContextHorizonChange?.('intraday')}
              className="px-2.5 py-1 rounded-md text-[11px] font-semibold border"
              style={{
                borderColor: contextHorizon === 'intraday' ? 'var(--color-info)' : 'var(--color-border)',
                backgroundColor: contextHorizon === 'intraday' ? 'var(--color-info-soft)' : 'transparent',
                color: contextHorizon === 'intraday' ? textColor : 'var(--text-secondary)',
              }}
            >
              Intraday
            </button>
            <button
              onClick={() => onContextHorizonChange?.('swing')}
              className="px-2.5 py-1 rounded-md text-[11px] font-semibold border"
              style={{
                borderColor: contextHorizon === 'swing' ? 'var(--color-info)' : 'var(--color-border)',
                backgroundColor: contextHorizon === 'swing' ? 'var(--color-info-soft)' : 'transparent',
                color: contextHorizon === 'swing' ? textColor : 'var(--text-secondary)',
              }}
            >
              Swing
            </button>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {marketContextSummary}
          </p>
        </div>
      )}
    </div>
  );
}
