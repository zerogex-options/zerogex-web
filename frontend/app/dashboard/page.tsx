/**
 * Main Dashboard Page
 * Overview of key metrics with real-time data
 */

'use client';

import { useGEXSummary, useMarketQuote, useSignalScore } from '@/hooks/useApiData';
import { STRENGTH_HIGH, STRENGTH_MEDIUM, TRIGGER_THRESHOLD_DEFAULT, NEUTRAL_BOUNDARY, getRegimeLabel, getStrengthLabel } from '@/core/signalConstants';
import MetricCard from '@/components/MetricCard';
import PriceDistanceMetricCard from '@/components/PriceDistanceMetricCard';
import { LoadingCard } from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { useTheme } from '@/core/ThemeContext';
import UnderlyingCandlesChart from '@/components/UnderlyingCandlesChart';
import VolatilityCard from '@/components/VolatilityCard';
import { useTimeframe } from '@/core/TimeframeContext';

export default function DashboardPage() {
  const { theme } = useTheme();
  const { symbol } = useTimeframe();
  
  // Fetch data with different refresh intervals
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: scoreData } = useSignalScore(symbol, 10000);

  // Show loading state only on initial load
  if (gexLoading && !gexData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Error Messages */}
      {gexError && (
        <div className="mb-4">
          <ErrorMessage message={gexError} onRetry={refetchGex} />
        </div>
      )}

      {/* Market Overview */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Market Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
          <MetricCard
            title={`${symbol} Price`}
            value={quoteData ? `$${quoteData.close.toFixed(2)}` : '--'}
            subtitle={quoteData ? `Vol: ${(((quoteData.volume ?? 0) / 1000000)).toFixed(1)}M` : ''}
            tooltip={`Current ${symbol} closing price from the real-time quote feed.`}
            theme={theme}
            trend="neutral"
          />
          <MetricCard
            title="Net GEX"
            value={gexData ? `$${(gexData.net_gex / 1000000).toFixed(1)}M` : '--'}
            trend={gexData && gexData.net_gex > 0 ? 'bullish' : 'bearish'}
            tooltip="Net Gamma Exposure across all strikes. Calculation: Sum of all call gamma minus put gamma, scaled by notional value. Positive GEX means dealers are net short gamma (bullish - creates resistance to price movement). Negative GEX means dealers are net long gamma (bearish - amplifies price swings)."
            theme={theme}
          />
          <PriceDistanceMetricCard
            title="Gamma Flip"
            level={gexData?.gamma_flip}
            spotPrice={quoteData?.close}
            tooltip="Price where aggregate net gamma changes sign. The card also shows the live dollar and percent distance from the current underlying so you can quickly judge whether spot is above or below the flip."
            theme={theme}
          />
          <PriceDistanceMetricCard
            title="Max Pain"
            level={gexData?.max_pain}
            spotPrice={quoteData?.close}
            tooltip="Estimated strike where option-holder payout is minimized at expiry. The card also shows the live dollar and percent distance from the current underlying so you can gauge how far spot is from the options pin."
            theme={theme}
          />
        </div>
      </section>


      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Signal Score</h2>
        <div className="zg-feature-shell p-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
              <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Current Market Feel</div>
              {(() => {
                const compositeScore = scoreData?.composite_score ?? scoreData?.score;
                const hasScore = typeof compositeScore === 'number';
                const absScore = hasScore ? Math.abs(compositeScore!) : 0;
                const strength = hasScore ? getStrengthLabel(absScore) : null;
                const directionLabel = hasScore ? getRegimeLabel(compositeScore!) : 'Awaiting signal data';

                return (
                  <>
                    <div
                      className="text-6xl font-black leading-none"
                      style={{
                        color: hasScore
                          ? (compositeScore! > 0 ? 'var(--color-bull)' : compositeScore! < 0 ? 'var(--color-bear)' : 'var(--color-warning)')
                          : 'var(--color-text-primary)',
                      }}
                    >
                      {hasScore ? compositeScore!.toFixed(2) : '--'}
                    </div>
                    <div className="mt-2 text-lg font-semibold">{directionLabel}</div>
                    {hasScore && strength && (
                      <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full" style={{
                        background: strength === 'high' ? 'rgba(27,196,125,0.15)' : strength === 'medium' ? 'rgba(255,166,0,0.15)' : 'rgba(255,77,90,0.15)',
                        color: strength === 'high' ? 'var(--color-bull)' : strength === 'medium' ? 'var(--color-warning)' : 'var(--color-bear)',
                      }}>
                        {strength === 'high' ? 'High Conviction' : strength === 'medium' ? 'Medium Conviction' : 'Low Conviction'}
                        {' · '}|score| = {absScore.toFixed(2)}
                      </div>
                    )}
                  </>
                );
              })()}
              <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
                Composite score from the UnifiedSignalEngine (−1.0 to +1.0). Weighted sum of 6 components: GEX regime, vol expansion, smart money, exhaustion, gamma flip, and put/call ratio. Sign encodes direction; magnitude encodes conviction.
              </p>
            </div>

            <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] p-5 bg-[var(--color-surface-subtle)]">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold">Score Spectrum</div>
                <div className="text-xs text-[var(--color-text-secondary)]">Range: −1.0 to +1.0</div>
              </div>

              {/* Spectrum bar with zone markers */}
              <div className="relative mt-4">
                <div
                  className="h-4 rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, var(--color-bear) 0%, #d98572 21%, var(--color-warning) 50%, #75cfa1 79%, var(--color-bull) 100%)',
                  }}
                />
                {/* Trigger threshold markers at ±0.58 */}
                <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-40" style={{ left: '21%' }} />
                <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-40" style={{ left: '79%' }} />
                {/* Neutral boundary markers at ±0.35 */}
                <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-25" style={{ left: '32.5%' }} />
                <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-25" style={{ left: '67.5%' }} />
                {/* Current score indicator */}
                <div
                  className="absolute -top-2 h-8 w-0.5 bg-[var(--color-text-primary)]"
                  style={{
                    left:
                      typeof (scoreData?.composite_score ?? scoreData?.score) === 'number'
                        ? `${Math.max(0, Math.min(100, (((scoreData?.composite_score ?? scoreData?.score)! + 1) / 2) * 100))}%`
                        : '50%',
                    transform: 'translateX(-50%)',
                  }}
                />
              </div>

              <div className="mt-3 grid grid-cols-5 text-[11px] text-[var(--color-text-secondary)]">
                <span className="text-left">−1.0</span>
                <span className="text-center">−0.58</span>
                <span className="text-center">0</span>
                <span className="text-center">+0.58</span>
                <span className="text-right">+1.0</span>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                  <div className="font-semibold text-[var(--color-bear)]">Strong Bear</div>
                  <div className="text-[var(--color-text-secondary)] mt-1">−1.0 to −0.58: open bearish trades.</div>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                  <div className="font-semibold text-[var(--color-bear)] opacity-70">Weak Bear</div>
                  <div className="text-[var(--color-text-secondary)] mt-1">−0.58 to −0.35: hold, don&apos;t add.</div>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                  <div className="font-semibold text-[var(--color-warning)]">Neutral</div>
                  <div className="text-[var(--color-text-secondary)] mt-1">−0.35 to +0.35: no edge, cut size.</div>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                  <div className="font-semibold text-[var(--color-bull)] opacity-70">Weak Bull</div>
                  <div className="text-[var(--color-text-secondary)] mt-1">+0.35 to +0.58: hold, don&apos;t add.</div>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                  <div className="font-semibold text-[var(--color-bull)]">Strong Bull</div>
                  <div className="text-[var(--color-text-secondary)] mt-1">+0.58 to +1.0: open bullish trades.</div>
                </div>
              </div>

              {/* Component breakdown with mini spectrum bars */}
              <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
                <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] mb-2">Signal Components</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  {(() => {
                    const COMPONENT_LABELS: Record<string, string> = {
                      gex_regime: 'GEX Regime',
                      vol_expansion: 'Vol Expansion',
                      smart_money: 'Smart Money',
                      exhaustion: 'Exhaustion',
                      gamma_flip: 'Gamma Flip',
                      put_call_ratio: 'Put/Call Ratio',
                    };
                    const fallbackComponents: { name: string; weight: number; score?: number }[] = [
                      { name: 'GEX Regime', weight: 0.22 },
                      { name: 'Vol Expansion', weight: 0.20 },
                      { name: 'Smart Money', weight: 0.16 },
                      { name: 'Exhaustion', weight: 0.15 },
                      { name: 'Gamma Flip', weight: 0.15 },
                      { name: 'Put/Call Ratio', weight: 0.12 },
                    ];

                    // Normalize components: API may return an array or a dict keyed by snake_case name
                    let components = fallbackComponents;
                    const raw = scoreData?.components;
                    if (Array.isArray(raw) && raw.length > 0) {
                      components = raw.map((c) => ({ name: c.name, weight: c.weight, score: c.score }));
                    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
                      const dict = raw as Record<string, { score?: number; weight?: number }>;
                      components = Object.entries(dict).map(([key, val]) => ({
                        name: COMPONENT_LABELS[key] ?? key,
                        weight: val.weight ?? 0,
                        score: val.score,
                      }));
                    }

                    return components.map((comp) => {
                      const hasScore = 'score' in comp && typeof comp.score === 'number';
                      const score = hasScore ? (comp as { score: number }).score : null;
                      // Map score from -1..+1 to 0..100% for the indicator position
                      const pct = score != null ? Math.max(0, Math.min(100, ((score + 1) / 2) * 100)) : null;
                      const barColor =
                        score != null
                          ? score > 0.1
                            ? 'var(--color-bull)'
                            : score < -0.1
                              ? 'var(--color-bear)'
                              : 'var(--color-warning)'
                          : undefined;

                      return (
                        <div key={comp.name} className="flex items-center gap-2">
                          <div className="flex-shrink-0 w-[120px] text-[11px] text-[var(--color-text-secondary)] truncate">
                            {comp.name} <span className="opacity-60">({Math.round(comp.weight * 100)}%)</span>
                          </div>
                          <div className="relative flex-1 h-2 rounded-full overflow-hidden" style={{
                            background:
                              'linear-gradient(90deg, var(--color-bear) 0%, var(--color-warning) 50%, var(--color-bull) 100%)',
                            opacity: hasScore ? 1 : 0.25,
                          }}>
                            {pct != null && (
                              <div
                                className="absolute top-[-1px] h-[10px] w-[6px] rounded-sm"
                                style={{
                                  left: `${pct}%`,
                                  transform: 'translateX(-50%)',
                                  backgroundColor: barColor,
                                  boxShadow: `0 0 3px ${barColor}`,
                                }}
                              />
                            )}
                          </div>
                          <div className="flex-shrink-0 w-[36px] text-right text-[11px] font-mono" style={{ color: barColor ?? 'var(--color-text-secondary)' }}>
                            {score != null ? (score >= 0 ? '+' : '') + score.toFixed(2) : '—'}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Volatility Monitor */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Volatility Monitor</h2>
        <VolatilityCard />
      </section>

      <section className="mb-8">
        <UnderlyingCandlesChart />
      </section>

      {/* GEX Metrics */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Gamma Exposure</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Call GEX"
            value={gexData ? `$${(gexData.total_call_gex / 1000000).toFixed(1)}M` : '--'}
            trend="neutral"
            tooltip="Total gamma exposure from call options. Calculation: Sum of (gamma × open interest × contract multiplier × spot price²) for all call strikes. Higher values indicate strong call positioning, which creates upside resistance as dealers hedge by selling into rallies."
            theme={theme}
          />
          <MetricCard
            title="Put GEX"
            value={gexData ? `$${(gexData.total_put_gex / 1000000).toFixed(1)}M` : '--'}
            trend="neutral"
            tooltip="Total gamma exposure from put options. Calculation: Sum of (gamma × open interest × contract multiplier × spot price²) for all put strikes. Higher values indicate strong put positioning, which creates downside support as dealers hedge by buying into selloffs."
            theme={theme}
          />
        </div>
      </section>

      {/* Options Sentiment */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Options Sentiment</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Put/Call Ratio"
            value={gexData?.put_call_ratio ? gexData.put_call_ratio.toFixed(2) : '--'}
            trend={gexData && (gexData.put_call_ratio ?? 0) > 1 ? 'bearish' : 'bullish'}
            tooltip="Ratio of put option volume to call option volume. Calculation: Total put volume divided by total call volume over the last hour. Values > 1.0 indicate more put buying (bearish sentiment). Values < 1.0 indicate more call buying (bullish sentiment). Extreme readings can signal reversals."
            theme={theme}
          />
        </div>
      </section>

      {/* Support/Resistance Levels */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Key Levels</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Call Wall (Resistance)"
            value={gexData?.call_wall ? `$${gexData.call_wall.toFixed(2)}` : 'N/A'}
            subtitle={
              gexData?.call_wall && quoteData?.close
                ? `${((gexData.call_wall - quoteData.close) / quoteData.close * 100) >= 0 ? '+' : ''}${((gexData.call_wall - quoteData.close) / quoteData.close * 100).toFixed(1)}% from spot`
                : 'Heavy call open interest'
            }
            tooltip="Strike with the highest concentration of call open interest, acting as resistance. Calculation: Strike with maximum total call OI weighted by gamma. As price approaches this level, dealers must sell shares to hedge their short gamma exposure, creating selling pressure. Price often struggles to break through this level."
            theme={theme}
            trend="bearish"
          />
          <MetricCard
            title="Put Wall (Support)"
            value={gexData?.put_wall ? `$${gexData.put_wall.toFixed(2)}` : 'N/A'}
            subtitle={
              gexData?.put_wall && quoteData?.close
                ? `${((gexData.put_wall - quoteData.close) / quoteData.close * 100) >= 0 ? '+' : ''}${((gexData.put_wall - quoteData.close) / quoteData.close * 100).toFixed(1)}% from spot`
                : 'Heavy put open interest'
            }
            tooltip="Strike with the highest concentration of put open interest, acting as support. Calculation: Strike with maximum total put OI weighted by gamma. As price approaches this level, dealers must buy shares to hedge their short gamma exposure, creating buying pressure. Price often bounces off this level."
            theme={theme}
            trend="bullish"
          />
        </div>
      </section>

      {/* Data Freshness */}
      {gexData && (
        <div className="text-right text-sm text-[var(--text-muted)]">
          Last updated: {new Date(gexData.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
