'use client';

import { useMemo } from 'react';
import { ArrowDown, ArrowUp, Minus, ShieldCheck, Zap } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useVolExpansionSignal } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import TooltipWrapper from '@/components/TooltipWrapper';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';

type GenericObject = Record<string, unknown>;

function asObject(value: unknown): GenericObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as GenericObject;
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function interpretation(score: number | null) {
  if (score == null) return 'No reading';
  if (score >= 70) return 'Bullish expansion primed';
  if (score >= 30) return 'Amplification potential';
  if (score <= -70) return 'Bearish expansion active';
  if (score <= -30) return 'Downside amplification';
  return 'Neutral — suppressed';
}

function formatGex(value: number | null) {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${value < 0 ? '-' : ''}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${value < 0 ? '-' : ''}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${value < 0 ? '-' : ''}$${(abs / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export default function VolatilityExpansionPage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useVolExpansionSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.volExpansionMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);

  const compositeScore = getNumber(payload.score ?? payload.composite_score ?? payload.normalized_score);
  const expansionScore = getNumber(payload.expansion);
  const directionScore = getNumber(payload.direction_score);
  const direction = String(payload.direction ?? payload.expected_direction ?? 'neutral').toLowerCase();

  const ctx = useMemo(() => {
    const cv = asObject(payload.context_values) ?? {};
    return {
      net_gex: getNumber(cv.net_gex),
      momentum: getNumber(cv.momentum),
      gex_regime: String(cv.gex_regime ?? '—'),
      vol_pressure: getNumber(cv.vol_pressure),
      pct_change_5bar: getNumber(cv.pct_change_5bar),
    };
  }, [payload]);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  const trend: 'bullish' | 'bearish' | 'neutral' = direction === 'up' || direction === 'bullish'
    ? 'bullish'
    : direction === 'down' || direction === 'bearish'
      ? 'bearish'
      : 'neutral';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <h1 className="text-3xl font-bold">Volatility Expansion</h1>
        <TooltipWrapper text="Whether the current market structure is loaded for a volatile directional move, and which direction that move would go." placement="bottom">
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {/* Score + Spectrum */}
      <div className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
              Expansion Regime Score
              <TooltipWrapper text="If net GEX ≥ 0, score = 0 (dealers suppress vol). In negative GEX, score reflects vol pressure × momentum direction." placement="bottom">
                <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
              </TooltipWrapper>
            </div>
            <div className="text-6xl font-black leading-none" style={{ color: trend === 'bullish' ? 'var(--color-bull)' : trend === 'bearish' ? 'var(--color-bear)' : 'var(--color-warning)' }}>
              {compositeScore != null ? compositeScore.toFixed(2) : '—'}
            </div>
            <div className="mt-2 text-lg font-semibold">{interpretation(compositeScore)}</div>
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              If net GEX is zero or positive, the score is immediately 0 — dealers suppress volatility. In negative GEX, vol pressure scales with |net_gex| and momentum direction determines the sign. This score tells you the amplification environment, not the trade direction.
            </p>
          </div>

          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] p-5 bg-[var(--color-surface-subtle)]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">Score Spectrum</div>
              <div className="text-xs text-[var(--color-text-secondary)]">Range: −100 to +100</div>
            </div>

            <div className="relative mt-4">
              <div
                className="h-4 rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, var(--color-bear) 0%, #d98572 25%, var(--color-warning) 50%, #75cfa1 75%, var(--color-bull) 100%)',
                }}
              />
              <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-40" style={{ left: '15%' }} />
              <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-40" style={{ left: '85%' }} />
              <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-25" style={{ left: '35%' }} />
              <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-25" style={{ left: '65%' }} />
              <div
                className="absolute -top-2 h-8 w-0.5 bg-[var(--color-text-primary)]"
                style={{
                  left: compositeScore != null
                    ? `${Math.max(0, Math.min(100, (compositeScore + 100) / 2))}%`
                    : '50%',
                  transform: 'translateX(-50%)',
                }}
              />
            </div>

            <div className="mt-3 grid grid-cols-5 text-[11px] text-[var(--color-text-secondary)]">
              <span className="text-left">−100</span>
              <span className="text-center">−30</span>
              <span className="text-center">0</span>
              <span className="text-center">+30</span>
              <span className="text-right">+100</span>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
              <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                <div className="font-semibold text-[var(--color-bear)]">Bearish Expansion</div>
                <div className="text-[var(--color-text-secondary)] mt-1">−100 to −70: dealers forced to sell into drop.</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                <div className="font-semibold text-[var(--color-bear)] opacity-70">Downside Pressure</div>
                <div className="text-[var(--color-text-secondary)] mt-1">−70 to −30: feedback loop on the downside.</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                <div className="font-semibold text-[var(--color-warning)]">Neutral</div>
                <div className="text-[var(--color-text-secondary)] mt-1">−30 to +30: vol suppressed or neutralized.</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                <div className="font-semibold text-[var(--color-bull)] opacity-70">Amplification</div>
                <div className="text-[var(--color-text-secondary)] mt-1">+30 to +70: meaningful amplification potential.</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                <div className="font-semibold text-[var(--color-bull)]">Bullish Expansion</div>
                <div className="text-[var(--color-text-secondary)] mt-1">+70 to +100: primed for bullish vol expansion.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Scores: Expansion + Direction */}
      <section className="zg-feature-shell mt-8 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expansion (0–100) */}
          <div className="rounded-xl border border-[var(--color-border)] p-5 bg-[var(--color-surface-subtle)]">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-semibold flex items-center gap-2">
                Expansion
                <TooltipWrapper text="Should I care about a vol move? Measures how primed the environment is for a larger-than-normal move, regardless of direction." placement="bottom">
                  <span className="text-[var(--color-text-secondary)] cursor-help text-xs">ⓘ</span>
                </TooltipWrapper>
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">0 to 100</div>
            </div>
            <div className="text-3xl font-black mt-1" style={{
              color: expansionScore != null
                ? (expansionScore >= 70 ? 'var(--color-bull)' : expansionScore >= 30 ? 'var(--color-warning)' : 'var(--color-text-secondary)')
                : 'var(--color-text-primary)',
            }}>
              {expansionScore != null ? expansionScore.toFixed(1) : '—'}
              <span className="text-sm font-medium text-[var(--color-text-secondary)] ml-2">
                {expansionScore != null
                  ? (expansionScore >= 70 ? 'Primed' : expansionScore >= 30 ? 'Building' : 'Suppressed')
                  : ''}
              </span>
            </div>
            <div className="relative mt-4">
              <div className="h-3 rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-text-secondary) 0%, var(--color-warning) 50%, var(--color-bull) 100%)' }} />
              <div className="absolute top-0 h-3 w-px bg-[var(--color-text-primary)] opacity-30" style={{ left: '30%' }} />
              <div className="absolute top-0 h-3 w-px bg-[var(--color-text-primary)] opacity-30" style={{ left: '70%' }} />
              <div
                className="absolute -top-1.5 h-6 w-0.5 bg-[var(--color-text-primary)]"
                style={{
                  left: expansionScore != null ? `${Math.max(0, Math.min(100, expansionScore))}%` : '0%',
                  transform: 'translateX(-50%)',
                }}
              />
            </div>
            <div className="mt-2 grid grid-cols-3 text-[10px] text-[var(--color-text-secondary)]">
              <span className="text-left">0</span>
              <span className="text-center">50</span>
              <span className="text-right">100</span>
            </div>
          </div>

          {/* Direction (-100 to +100) */}
          <div className="rounded-xl border border-[var(--color-border)] p-5 bg-[var(--color-surface-subtle)]">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-semibold flex items-center gap-2">
                Direction
                <TooltipWrapper text="Which way would the move go? Positive = bullish bias, negative = bearish bias, near zero = no directional lean." placement="bottom">
                  <span className="text-[var(--color-text-secondary)] cursor-help text-xs">ⓘ</span>
                </TooltipWrapper>
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">−100 to +100</div>
            </div>
            <div className="text-3xl font-black mt-1" style={{
              color: directionScore != null
                ? (directionScore > 10 ? 'var(--color-bull)' : directionScore < -10 ? 'var(--color-bear)' : 'var(--color-warning)')
                : 'var(--color-text-primary)',
            }}>
              {directionScore != null ? `${directionScore >= 0 ? '+' : ''}${directionScore.toFixed(1)}` : '—'}
              <span className="text-sm font-medium text-[var(--color-text-secondary)] ml-2">
                {directionScore != null
                  ? (directionScore > 10 ? 'Bullish' : directionScore < -10 ? 'Bearish' : 'Neutral')
                  : ''}
              </span>
            </div>
            <div className="relative mt-4">
              <div className="h-3 rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, var(--color-warning) 50%, var(--color-bull) 100%)' }} />
              <div className="absolute top-0 h-3 w-px bg-[var(--color-text-primary)] opacity-30" style={{ left: '25%' }} />
              <div className="absolute top-0 h-3 w-px bg-[var(--color-text-primary)] opacity-30" style={{ left: '75%' }} />
              <div
                className="absolute -top-1.5 h-6 w-0.5 bg-[var(--color-text-primary)]"
                style={{
                  left: directionScore != null ? `${Math.max(0, Math.min(100, (directionScore + 100) / 2))}%` : '50%',
                  transform: 'translateX(-50%)',
                }}
              />
            </div>
            <div className="mt-2 grid grid-cols-3 text-[10px] text-[var(--color-text-secondary)]">
              <span className="text-left">−100</span>
              <span className="text-center">0</span>
              <span className="text-right">+100</span>
            </div>
          </div>
        </div>
      </section>

      {/* Context Breakdown */}
      <section className="zg-feature-shell mt-8 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="text-sm font-semibold mb-2">How It&apos;s Calculated</div>
            <div className="text-xs text-[var(--color-text-secondary)] space-y-2.5 mt-3">
              <div><strong className="text-[var(--color-text-primary)]">1. GEX regime gate</strong> — If net GEX ≥ 0 → score = 0. Positive GEX means dealers suppress vol.</div>
              <div><strong className="text-[var(--color-text-primary)]">2. Vol pressure</strong> — min(1.0, |net_gex| / $300M). How loaded the gun is.</div>
              <div><strong className="text-[var(--color-text-primary)]">3. Momentum</strong> — 5-bar % change normalized against 0.5% threshold, clamped [−1, +1].</div>
              <div><strong className="text-[var(--color-text-primary)]">4. Blend</strong> — Flat/rising price → +vol_pressure. Falling price → shifts toward −vol_pressure.</div>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
              Use alongside the composite score — composite tells you <strong>whether</strong> to trade, vol expansion tells you <strong>how explosive</strong> the follow-through could be.
            </div>
          </div>

          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="text-sm font-semibold mb-3">Context Breakdown</div>
            <div className="grid grid-cols-[minmax(130px,1.2fr)_1fr_minmax(120px,1fr)] gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] pb-2 border-b border-[var(--color-border)]">
              <span>Metric</span>
              <span className="text-right">Value</span>
              <span className="text-center">Status</span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {/* Net GEX */}
              <div className="grid grid-cols-[minmax(130px,1.2fr)_1fr_minmax(120px,1fr)] gap-2 text-sm py-2.5 items-center">
                <span className="font-medium">Net GEX</span>
                <span className="text-right font-mono text-[var(--color-text-secondary)]">{formatGex(ctx.net_gex)}</span>
                <span className="flex items-center justify-center">
                  {ctx.net_gex != null ? (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                      ctx.net_gex > 0
                        ? 'bg-[rgba(27,196,125,0.12)] text-[var(--color-bull)]'
                        : ctx.net_gex < 0
                          ? 'bg-[rgba(255,77,90,0.12)] text-[var(--color-bear)]'
                          : 'bg-[rgba(255,166,0,0.12)] text-[var(--color-warning)]'
                    }`}>
                      {ctx.net_gex > 0 ? <ShieldCheck size={13} /> : ctx.net_gex < 0 ? <Zap size={13} /> : <Minus size={13} />}
                      {ctx.net_gex > 0 ? 'Suppression' : ctx.net_gex < 0 ? 'Amplification' : 'Flat'}
                    </span>
                  ) : <span className="text-xs text-[var(--color-text-secondary)]">—</span>}
                </span>
              </div>

              {/* GEX Regime */}
              <div className="grid grid-cols-[minmax(130px,1.2fr)_1fr_minmax(120px,1fr)] gap-2 text-sm py-2.5 items-center">
                <span className="font-medium">GEX Regime</span>
                <span className="text-right font-mono text-[var(--color-text-secondary)] capitalize">{ctx.gex_regime}</span>
                <span className="flex items-center justify-center">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                    ctx.gex_regime === 'positive'
                      ? 'bg-[rgba(27,196,125,0.12)] text-[var(--color-bull)]'
                      : ctx.gex_regime === 'negative'
                        ? 'bg-[rgba(255,77,90,0.12)] text-[var(--color-bear)]'
                        : 'bg-[rgba(255,166,0,0.12)] text-[var(--color-warning)]'
                  }`}>
                    {ctx.gex_regime === 'positive' ? <ShieldCheck size={13} /> : ctx.gex_regime === 'negative' ? <Zap size={13} /> : <Minus size={13} />}
                    {ctx.gex_regime === 'positive' ? 'Dealers dampen' : ctx.gex_regime === 'negative' ? 'Dealers amplify' : 'Unknown'}
                  </span>
                </span>
              </div>

              {/* Vol Pressure */}
              <div className="grid grid-cols-[minmax(130px,1.2fr)_1fr_minmax(120px,1fr)] gap-2 text-sm py-2.5 items-center">
                <span className="font-medium">Vol Pressure</span>
                <span className="text-right font-mono text-[var(--color-text-secondary)]">{ctx.vol_pressure != null ? ctx.vol_pressure.toFixed(2) : '—'}</span>
                <span className="flex items-center justify-center">
                  {ctx.vol_pressure != null ? (
                    <div className="flex items-center gap-2 w-full max-w-[110px]">
                      <div className="relative flex-1 h-2 rounded-full bg-[var(--color-border)]">
                        <div
                          className="absolute top-0 left-0 h-2 rounded-full"
                          style={{
                            width: `${Math.max(0, Math.min(100, ctx.vol_pressure * 100))}%`,
                            background: ctx.vol_pressure >= 0.7
                              ? 'var(--color-bear)'
                              : ctx.vol_pressure >= 0.4
                                ? 'var(--color-warning)'
                                : 'var(--color-bull)',
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--color-text-secondary)] w-8 text-right">{(ctx.vol_pressure * 100).toFixed(0)}%</span>
                    </div>
                  ) : <span className="text-xs text-[var(--color-text-secondary)]">—</span>}
                </span>
              </div>

              {/* Momentum */}
              <div className="grid grid-cols-[minmax(130px,1.2fr)_1fr_minmax(120px,1fr)] gap-2 text-sm py-2.5 items-center">
                <span className="font-medium">Momentum</span>
                <span className="text-right font-mono" style={{ color: ctx.momentum != null ? (ctx.momentum > 0 ? 'var(--color-bull)' : ctx.momentum < 0 ? 'var(--color-bear)' : 'var(--color-text-secondary)') : 'var(--color-text-secondary)' }}>
                  {ctx.momentum != null ? `${ctx.momentum >= 0 ? '+' : ''}${ctx.momentum.toFixed(4)}` : '—'}
                </span>
                <span className="flex items-center justify-center">
                  {ctx.momentum != null ? (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                      ctx.momentum > 0.01 ? 'text-[var(--color-bull)]' : ctx.momentum < -0.01 ? 'text-[var(--color-bear)]' : 'text-[var(--color-text-secondary)]'
                    }`}>
                      {ctx.momentum > 0.01 ? <ArrowUp size={14} /> : ctx.momentum < -0.01 ? <ArrowDown size={14} /> : <Minus size={14} />}
                      {ctx.momentum > 0.01 ? 'Bullish' : ctx.momentum < -0.01 ? 'Bearish' : 'Flat'}
                    </span>
                  ) : <span className="text-xs text-[var(--color-text-secondary)]">—</span>}
                </span>
              </div>

              {/* 5-Bar % Change */}
              <div className="grid grid-cols-[minmax(130px,1.2fr)_1fr_minmax(120px,1fr)] gap-2 text-sm py-2.5 items-center">
                <span className="font-medium">5-Bar % Change</span>
                <span className="text-right font-mono" style={{ color: ctx.pct_change_5bar != null ? (ctx.pct_change_5bar > 0 ? 'var(--color-bull)' : ctx.pct_change_5bar < 0 ? 'var(--color-bear)' : 'var(--color-text-secondary)') : 'var(--color-text-secondary)' }}>
                  {ctx.pct_change_5bar != null ? `${ctx.pct_change_5bar >= 0 ? '+' : ''}${(ctx.pct_change_5bar * 100).toFixed(3)}%` : '—'}
                </span>
                <span className="flex items-center justify-center">
                  {ctx.pct_change_5bar != null ? (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                      ctx.pct_change_5bar > 0.001 ? 'text-[var(--color-bull)]' : ctx.pct_change_5bar < -0.001 ? 'text-[var(--color-bear)]' : 'text-[var(--color-text-secondary)]'
                    }`}>
                      {ctx.pct_change_5bar > 0.001 ? <ArrowUp size={14} /> : ctx.pct_change_5bar < -0.001 ? <ArrowDown size={14} /> : <Minus size={14} />}
                      {Math.abs(ctx.pct_change_5bar) >= 0.005 ? 'Strong' : Math.abs(ctx.pct_change_5bar) >= 0.001 ? 'Moderate' : 'Negligible'}
                    </span>
                  ) : <span className="text-xs text-[var(--color-text-secondary)]">—</span>}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
