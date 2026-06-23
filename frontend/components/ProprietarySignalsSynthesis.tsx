'use client';

import { type ReactNode, useMemo } from 'react';
import { Info, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import {
  useBasicSignalsBundle,
  useEodPressureSignal,
  useGammaVwapConfluenceSignal,
  useMarketPressureSignal,
  useRangeBreakImminenceSignal,
  useSignalScore,
  useSqueezeSetupSignal,
  useTrapDetectionSignal,
  useVolExpansionSignal,
  useZeroDtePositionImbalanceSignal,
  type BasicSignalName,
} from '@/hooks/useApiData';
import { useTheme } from '@/core/ThemeContext';
import { useTimeframe } from '@/core/TimeframeContext';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import { getRegimeLabel } from '@/core/signalConstants';
import { asObject, getNumber } from '@/core/signalHelpers';
import { colors } from '@/core/colors';
import { spectrumIndicatorLeft } from '@/core/spectrumIndicator';
import TooltipWrapper from './TooltipWrapper';

// Score threshold under which a signal is treated as neutral for the breadth
// count. Matches the lower of the trigger thresholds used by the Basic and
// Advanced signal cards so a "bullish" or "bearish" vote here means the
// signal is at least flirting with its activation band.
const BREADTH_DIRECTIONAL_BAND = 15;

interface CardShellProps {
  title: string;
  tooltip: string;
  children: ReactNode;
}

function CardShell({ title, tooltip, children }: CardShellProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? colors.cardDark : colors.cardLight;
  const shadowBase = isDark
    ? '0 4px 12px var(--color-info-soft), 0 1px 3px var(--color-info-soft)'
    : '0 4px 12px var(--color-info-soft), 0 1px 3px var(--border-subtle)';
  const shadowHover = '0 8px 20px var(--color-info-soft), 0 2px 6px var(--color-info-soft)';

  return (
    <div
      className="h-full p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] flex flex-col"
      style={{
        backgroundColor: cardBg,
        border: `1px solid ${colors.muted}`,
        boxShadow: shadowBase,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = shadowHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = shadowBase; }}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-xs font-semibold tracking-wider uppercase" style={{ color: colors.muted }}>
          {title}
        </h3>
        <TooltipWrapper text={tooltip}>
          <Info size={14} />
        </TooltipWrapper>
      </div>
      {children}
    </div>
  );
}

function tilt(score: number | null): 'bullish' | 'bearish' | 'neutral' {
  if (score == null) return 'neutral';
  if (score > 0) return 'bullish';
  if (score < 0) return 'bearish';
  return 'neutral';
}

function tiltColor(t: 'bullish' | 'bearish' | 'neutral'): string {
  if (t === 'bullish') return 'var(--color-bull)';
  if (t === 'bearish') return 'var(--color-bear)';
  return 'var(--color-warning)';
}

function renderTiltIcon(t: 'bullish' | 'bearish' | 'neutral', color: string) {
  if (t === 'bullish') return <TrendingUp size={16} style={{ color }} />;
  if (t === 'bearish') return <TrendingDown size={16} style={{ color }} />;
  return <Minus size={16} style={{ color }} />;
}

interface CompositeMsiCardProps {
  score: number | null;
  triggerThreshold: number;
}

function CompositeMsiCard({ score, triggerThreshold }: CompositeMsiCardProps) {
  const t = tilt(score);
  const color = tiltColor(t);
  const regime = score != null ? getRegimeLabel(score) : 'Awaiting signal data';
  const direction = score == null ? 'Awaiting' : score > 0 ? 'Bullish' : score < 0 ? 'Bearish' : 'Neutral';
  // Spectrum position (0–100) — maps the −100/+100 score to a percentage along
  // the gradient bar so the marker sits proportionally between extremes.
  const pct = score != null ? Math.max(0, Math.min(100, (score + 100) / 2)) : 50;
  const triggerPct = Math.max(1, Math.min(99, ((triggerThreshold + 100) / 200) * 100));

  return (
    <CardShell
      title="Composite MSI · Weighted Synthesis"
      tooltip="UnifiedSignalEngine composite score on a −100 to +100 scale — the weighted synthesis of every Basic and Advanced signal feeding the engine. Sign is direction (positive = bullish); magnitude is conviction. The horizontal spectrum maps to the same action bands the engine uses to gate trades."
    >
      <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div className="text-2xl sm:text-3xl md:text-4xl font-bold break-words" style={{ color }}>
          {score != null ? `${score >= 0 ? '+' : ''}${score.toFixed(1)}` : '—'}
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5">
            {renderTiltIcon(t, color)}
            <div className="text-base sm:text-lg font-bold" style={{ color }}>
              {direction.toUpperCase()}
            </div>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
            Score · −100 to +100
          </div>
        </div>
      </div>

      <div className="mt-1">
        <div className="relative">
          <div
            className="h-3 rounded-full"
            style={{
              background:
                'linear-gradient(90deg, var(--color-bear) 0%, #d98572 21%, var(--color-warning) 50%, #75cfa1 79%, var(--color-bull) 100%)',
            }}
          />
          {/* Trigger threshold ticks */}
          <div
            className="absolute top-0 h-3 w-px bg-[var(--color-text-primary)] opacity-40"
            style={{ left: `${triggerPct}%` }}
          />
          <div
            className="absolute top-0 h-3 w-px bg-[var(--color-text-primary)] opacity-40"
            style={{ left: `${100 - triggerPct}%` }}
          />
          {/* Current marker */}
          <div
            className="absolute -top-1 h-5 w-0.5 bg-[var(--color-text-primary)]"
            style={{
              left: spectrumIndicatorLeft(pct, 12, 2),
              transform: 'translateX(-50%)',
            }}
            aria-label={`Composite MSI ${score != null ? score.toFixed(1) : 'unavailable'}`}
          />
        </div>
        <div className="mt-2 grid grid-cols-5 text-[10px] text-[var(--color-text-secondary)]">
          <span className="text-left">−100</span>
          <span className="text-center">−{triggerThreshold}</span>
          <span className="text-center">0</span>
          <span className="text-center">+{triggerThreshold}</span>
          <span className="text-right">+100</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1 text-[10px] text-center">
        <div className="rounded border border-[var(--color-border)] py-1 px-0.5">
          <div className="font-semibold" style={{ color: 'var(--color-bear)' }}>Full</div>
          <div className="text-[var(--color-text-secondary)]">Puts</div>
        </div>
        <div className="rounded border border-[var(--color-border)] py-1 px-0.5">
          <div className="font-semibold" style={{ color: 'var(--color-bear)', opacity: 0.7 }}>Scalp</div>
          <div className="text-[var(--color-text-secondary)]">Puts</div>
        </div>
        <div className="rounded border border-[var(--color-border)] py-1 px-0.5">
          <div className="font-semibold" style={{ color: 'var(--color-warning)' }}>No</div>
          <div className="text-[var(--color-text-secondary)]">Edge</div>
        </div>
        <div className="rounded border border-[var(--color-border)] py-1 px-0.5">
          <div className="font-semibold" style={{ color: 'var(--color-bull)', opacity: 0.7 }}>Scalp</div>
          <div className="text-[var(--color-text-secondary)]">Calls</div>
        </div>
        <div className="rounded border border-[var(--color-border)] py-1 px-0.5">
          <div className="font-semibold" style={{ color: 'var(--color-bull)' }}>Full</div>
          <div className="text-[var(--color-text-secondary)]">Calls</div>
        </div>
      </div>

      <div className="mt-auto pt-3 text-sm font-semibold" style={{ color }}>
        {regime}
      </div>
    </CardShell>
  );
}

interface SignalLite {
  key: string;
  label: string;
  score: number | null;
}

interface SignalBreadthCardProps {
  basicSignals: SignalLite[];
  advancedSignals: SignalLite[];
}

function SignalBreadthCard({ basicSignals, advancedSignals }: SignalBreadthCardProps) {
  const all = useMemo(() => [...basicSignals, ...advancedSignals], [basicSignals, advancedSignals]);

  const { bullish, bearish, neutral, missing, topBull, topBear } = useMemo(() => {
    let bullish = 0;
    let bearish = 0;
    let neutral = 0;
    let missing = 0;
    let topBull: SignalLite | null = null;
    let topBear: SignalLite | null = null;
    for (const s of all) {
      if (s.score == null) { missing += 1; continue; }
      if (s.score >= BREADTH_DIRECTIONAL_BAND) {
        bullish += 1;
        if (!topBull || s.score > (topBull.score ?? -Infinity)) topBull = s;
      } else if (s.score <= -BREADTH_DIRECTIONAL_BAND) {
        bearish += 1;
        if (!topBear || s.score < (topBear.score ?? Infinity)) topBear = s;
      } else {
        neutral += 1;
      }
    }
    return { bullish, bearish, neutral, missing, topBull, topBear };
  }, [all]);

  const counted = bullish + bearish + neutral;
  const active = bullish + bearish;
  const total = all.length;
  const net = bullish - bearish;
  const t: 'bullish' | 'bearish' | 'neutral' = net > 0 ? 'bullish' : net < 0 ? 'bearish' : 'neutral';
  const color = tiltColor(t);

  const bullPct = counted > 0 ? (bullish / counted) * 100 : 0;
  const bearPct = counted > 0 ? (bearish / counted) * 100 : 0;
  const neutralPct = counted > 0 ? (neutral / counted) * 100 : 100;

  const allMissing = missing === total;

  return (
    <CardShell
      title="Signal Breadth · Basic + Advanced"
      tooltip="Unweighted directional vote across all 6 Basic and 8 Advanced signals. A signal counts as bullish when its score ≥ +15, bearish when ≤ −15, otherwise neutral. Net = bullish − bearish. Read alongside the Composite MSI: high MSI with broad breadth = consensus; high MSI with narrow breadth = the engine is leaning on a few loud signals."
    >
      <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div className="text-2xl sm:text-3xl md:text-4xl font-bold break-words" style={{ color }}>
          {allMissing ? '—' : `${net >= 0 ? '+' : ''}${net}`}
          <span className="text-xs sm:text-sm font-semibold ml-2 tracking-wide" style={{ color: colors.muted }}>
            NET
          </span>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5">
            {renderTiltIcon(t, color)}
            <div className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {active}
              <span className="text-sm font-semibold" style={{ color: colors.muted }}>/{total}</span>
            </div>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
            Active · across signals
          </div>
        </div>
      </div>

      <div className="flex h-3 w-full rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
        {bullPct > 0 && <div style={{ width: `${bullPct}%`, background: 'var(--color-bull)' }} />}
        {neutralPct > 0 && <div style={{ width: `${neutralPct}%`, background: 'var(--color-warning)', opacity: 0.7 }} />}
        {bearPct > 0 && <div style={{ width: `${bearPct}%`, background: 'var(--color-bear)' }} />}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-bull)' }} />
          <span style={{ color: 'var(--color-text-primary)' }} className="font-semibold">{bullish}</span>
          <span style={{ color: colors.muted }}>Bullish</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-warning)' }} />
          <span style={{ color: 'var(--color-text-primary)' }} className="font-semibold">{neutral}</span>
          <span style={{ color: colors.muted }}>Neutral</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-bear)' }} />
          <span style={{ color: 'var(--color-text-primary)' }} className="font-semibold">{bearish}</span>
          <span style={{ color: colors.muted }}>Bearish</span>
        </div>
      </div>

      <div className="mt-4 space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span style={{ color: colors.muted }}>Top bull</span>
          <span className="font-semibold truncate" style={{ color: topBull ? 'var(--color-bull)' : colors.muted }}>
            {topBull
              ? `${topBull.label} +${topBull.score!.toFixed(1)}`
              : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span style={{ color: colors.muted }}>Top bear</span>
          <span className="font-semibold truncate" style={{ color: topBear ? 'var(--color-bear)' : colors.muted }}>
            {topBear
              ? `${topBear.label} ${topBear.score!.toFixed(1)}`
              : '—'}
          </span>
        </div>
      </div>

      <div className="mt-auto pt-3 flex items-center justify-between text-[11px]" style={{ color: colors.muted }}>
        <span>{basicSignals.length} Basic</span>
        <span>·</span>
        <span>{advancedSignals.length} Advanced</span>
        {missing > 0 && (
          <>
            <span>·</span>
            <span>{missing} pending</span>
          </>
        )}
      </div>
    </CardShell>
  );
}

const BASIC_SIGNAL_LABELS: Record<BasicSignalName, string> = {
  tape_flow_bias: 'Tape Flow Bias',
  skew_delta: 'Skew Delta',
  vanna_charm_flow: 'Vanna/Charm Flow',
  dealer_delta_pressure: 'Dealer Δ Pressure',
  gex_gradient: 'GEX Gradient',
  positioning_trap: 'Positioning Trap',
};

export default function ProprietarySignalsSynthesis() {
  const { symbol } = useTimeframe();

  const { data: scoreData } = useSignalScore(symbol, PROPRIETARY_SIGNALS_REFRESH.compositeScoreMs);
  const { data: basicBundleData } = useBasicSignalsBundle(symbol, PROPRIETARY_SIGNALS_REFRESH.basicBundleMs);
  const volExpansion = useVolExpansionSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.volExpansionMs);
  const eodPressure = useEodPressureSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.eodPressureMs);
  const squeeze = useSqueezeSetupSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.squeezeSetupMs);
  const trapDetection = useTrapDetectionSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.trapDetectionMs);
  const zeroDte = useZeroDtePositionImbalanceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.zeroDteImbalanceMs);
  const gammaVwap = useGammaVwapConfluenceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.gammaVwapConfluenceMs);
  const rangeBreak = useRangeBreakImminenceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.rangeBreakImminenceMs);
  const marketPressure = useMarketPressureSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.marketPressureMs);

  const compositeScore = useMemo(() => {
    const raw = scoreData?.composite_score ?? scoreData?.score;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  }, [scoreData]);
  const triggerThreshold = useMemo(() => {
    const t = scoreData?.trigger_threshold;
    return typeof t === 'number' && Number.isFinite(t) ? Math.round(t) : 58;
  }, [scoreData]);

  const basicSignals = useMemo<SignalLite[]>(() => {
    const signals = asObject(asObject(basicBundleData)?.signals) ?? {};
    return (Object.keys(BASIC_SIGNAL_LABELS) as BasicSignalName[]).map((key) => {
      const payload = asObject(signals[key]);
      return {
        key,
        label: BASIC_SIGNAL_LABELS[key],
        score: payload ? getNumber(payload.score) : null,
      };
    });
  }, [basicBundleData]);

  const advancedSignals = useMemo<SignalLite[]>(() => {
    const pick = (data: unknown): number | null => {
      const payload = asObject(data);
      return payload ? getNumber(payload.score) : null;
    };
    return [
      { key: 'vol_expansion', label: 'Volatility Expansion', score: pick(volExpansion.data) },
      { key: 'eod_pressure', label: 'EOD Pressure', score: pick(eodPressure.data) },
      { key: 'squeeze_setup', label: 'Squeeze Setup', score: pick(squeeze.data) },
      { key: 'trap_detection', label: 'Trap Detection', score: pick(trapDetection.data) },
      { key: 'zero_dte_position_imbalance', label: '0DTE Position Imbalance', score: pick(zeroDte.data) },
      { key: 'gamma_vwap_confluence', label: 'Gamma/VWAP Confluence', score: pick(gammaVwap.data) },
      { key: 'range_break_imminence', label: 'Range Break Imminence', score: pick(rangeBreak.data) },
      { key: 'market_pressure', label: 'Market Pressure', score: pick(marketPressure.data) },
    ];
  }, [
    volExpansion.data,
    eodPressure.data,
    squeeze.data,
    trapDetection.data,
    zeroDte.data,
    gammaVwap.data,
    rangeBreak.data,
    marketPressure.data,
  ]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
      <CompositeMsiCard score={compositeScore} triggerThreshold={triggerThreshold} />
      <SignalBreadthCard basicSignals={basicSignals} advancedSignals={advancedSignals} />
    </div>
  );
}
