'use client';

import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';

interface GEXSummaryData {
  net_gex: number;
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
}

type Regime = 'positive' | 'negative' | 'neutral';

function detectRegime(
  netGex: number | undefined,
  gammaFlip: number | null | undefined,
  spotPrice: number | undefined,
): Regime {
  if (netGex == null || gammaFlip == null || spotPrice == null) return 'neutral';
  if (spotPrice > gammaFlip && netGex > 0) return 'positive';
  if (spotPrice < gammaFlip && netGex < 0) return 'negative';
  return 'neutral';
}

const regimeConfig: Record<Regime, { badge: string; label: string; color: string; bgColor: string; borderColor: string }> = {
  positive: {
    badge: '+ Gamma Regime',
    label: 'Positive GEX (pinned, low vol)',
    color: colors.bullish,
    bgColor: 'var(--color-bull-soft)',
    borderColor: 'var(--color-bull)',
  },
  negative: {
    badge: '- Gamma Regime',
    label: 'Negative GEX (trending, high vol)',
    color: colors.bearish,
    bgColor: 'var(--color-bear-soft)',
    borderColor: 'var(--color-bear)',
  },
  neutral: {
    badge: '~ Gamma Regime',
    label: 'At the Flip (neutral, transition)',
    color: colors.primary,
    bgColor: 'var(--color-warning-soft)',
    borderColor: 'var(--color-warning)',
  },
};

export default function GexRegimeHeader({ gexSummary, quoteData, symbol }: GexRegimeHeaderProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? colors.light : colors.dark;
  const cardBg = isDark ? colors.cardDark : colors.cardLight;

  const gammaFlip = gexSummary?.gamma_flip ?? null;
  const spotPrice = quoteData?.close;
  const regime = detectRegime(gexSummary?.net_gex, gammaFlip, spotPrice);
  const config = regimeConfig[regime];

  const flipDistance = gammaFlip != null && spotPrice != null ? spotPrice - gammaFlip : null;
  const aboveFlip = flipDistance != null && flipDistance >= 0;

  return (
    <div
      className="rounded-2xl p-4 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
      style={{ backgroundColor: cardBg, border: `1px solid ${colors.muted}` }}
    >
      {/* Left: Regime badge */}
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

      {/* Center: Gamma flip + price info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 text-sm">
        <span style={{ color: textColor }}>
          <span className="font-semibold">Gamma flip:</span>{' '}
          <span style={{ color: config.color, fontWeight: 700 }}>
            {gammaFlip != null ? `$${gammaFlip.toFixed(2)}` : '--'}
          </span>
        </span>
        <span style={{ color: colors.muted }}>
          {symbol} last: <span style={{ color: textColor, fontWeight: 500 }}>{spotPrice != null ? `$${spotPrice.toFixed(2)}` : '--'}</span>
          {flipDistance != null && (
            <>
              {' — '}
              <span style={{ color: aboveFlip ? colors.bullish : colors.bearish }}>
                {Math.abs(flipDistance).toFixed(2)} pts {aboveFlip ? 'above' : 'below'} flip
              </span>
            </>
          )}
        </span>
      </div>

      {/* Right: Scenario label */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: colors.muted }}>Scenario:</span>
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
  );
}
