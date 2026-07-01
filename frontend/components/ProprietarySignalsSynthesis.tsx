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
import { REGIME_BANDS, classifyRegime } from '@/core/regime';
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
  const cardBg = 'var(--bg-card)';
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
}

// Band edges that match the backend's regime classifier
// (src/signals/scoring_engine.py:_regime_label). Kept here so the axis
// labels under the spectrum bar render in the same positions as the
// gauge on /signal-score.
const MSI_AXIS_TICKS = [0, 20, 40, 70, 100] as const;

function CompositeMsiCard({ score }: CompositeMsiCardProps) {
  const regime = classifyRegime(score);
  const color = regime.color;
  // Score is a 0–100 regime gauge with a 50 baseline (see
  // src/signals/scoring_engine.py). Spectrum position is a direct
  // pass-through of the score; the regime bands already shade the bar
  // so no centering math is needed.
  const safeScore = score != null && Number.isFinite(score)
    ? Math.max(0, Math.min(100, score))
    : null;
  const pct = safeScore ?? 50;

  return (
    <CardShell
      title="Composite MSI · Weighted Synthesis"
      tooltip="Market State Index: a single 0–100 regime gauge built from six option-structure components (net GEX sign, gamma anchor, P/C ratio, vol regime, smart-money flow, dealer delta pressure). 50 is neutral. ≥70 trend / expansion, 40–70 controlled trend, 20–40 chop / range, <20 high-risk reversal. A high MSI does NOT mean bullish — it means trends can run. Read direction from the Bias panel or individual signal scores."
    >
      <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div
          className="text-2xl sm:text-3xl md:text-4xl font-bold break-words"
          style={{ color, fontVariantNumeric: 'tabular-nums' }}
        >
          {safeScore != null ? safeScore.toFixed(1) : '—'}
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5" style={{ color }}>
            <span aria-hidden className="text-base sm:text-lg leading-none">{regime.glyph}</span>
            <div className="text-base sm:text-lg font-bold">
              {regime.label}
            </div>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
            Score · 0 to 100 · regime gauge
          </div>
        </div>
      </div>

      <div className="mt-1">
        <div className="relative">
          <div className="flex h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
            {REGIME_BANDS.map((band) => (
              <div
                key={band.regime.key}
                style={{
                  width: `${band.to - band.from}%`,
                  background: band.regime.color,
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
          {/* Neutral baseline at 50 */}
          <div
            className="absolute top-0 h-3 w-px bg-[var(--color-text-primary)] opacity-40"
            style={{ left: '50%' }}
            aria-hidden
          />
          {/* Current marker */}
          <div
            className="absolute -top-1 h-5 w-0.5 bg-[var(--color-text-primary)]"
            style={{
              left: spectrumIndicatorLeft(pct, 12, 2),
              transform: 'translateX(-50%)',
            }}
            aria-label={`Composite MSI ${safeScore != null ? safeScore.toFixed(1) : 'unavailable'}`}
          />
        </div>
        <div className="mt-2 relative h-3 text-[10px] text-[var(--color-text-secondary)]">
          {MSI_AXIS_TICKS.map((tick) => (
            <span
              key={tick}
              className="absolute"
              style={{
                left: `${tick}%`,
                transform:
                  tick === 0 ? 'translateX(0)' : tick === 100 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {tick}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1 text-[10px] text-center">
        {REGIME_BANDS.map((band) => (
          <div
            key={band.regime.key}
            className="rounded border border-[var(--color-border)] py-1 px-0.5"
            style={{
              background: regime.key === band.regime.key ? band.regime.softColor : 'transparent',
            }}
          >
            <div className="font-semibold leading-tight" style={{ color: band.regime.color }}>
              {band.regime.label}
            </div>
            <div className="text-[var(--color-text-secondary)]">{band.regime.rangeLabel}</div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-3 text-sm font-semibold" style={{ color }}>
        {regime.copy}
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
      title="Signal Breadth · Directional Vote"
      tooltip="Unweighted directional vote across the 11 signals whose sign IS bullish vs bearish: all 6 Basic, plus EOD Pressure, Squeeze Setup, Trap Detection, 0DTE Position Imbalance, and Gamma/VWAP Confluence. A signal counts as bullish when its score ≥ +15, bearish when ≤ −15, else neutral. Net = bullish − bearish. The other 3 advanced signals (Vol Expansion, Range Break Imminence, Market Pressure) are regime-readiness reads — their magnitude IS the signal, sign is incidental — so they live in the Regime Triggers panel below, not in this tally."
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

interface RegimeTrigger {
  key: string;
  label: string;
  // 0–100 readiness / imminence / loading; null when data is missing.
  magnitude: number | null;
  // Backend-provided playbook state label (e.g. "Break Watch", "Loaded").
  state: string | null;
  // Optional directional tag the backend attaches to the trigger; shown as
  // context only — these signals are not directional votes.
  direction: 'bullish' | 'bearish' | 'neutral' | null;
}

function extractDirection(raw: unknown): 'bullish' | 'bearish' | 'neutral' | null {
  if (typeof raw === 'string') {
    const v = raw.toLowerCase();
    if (v === 'bullish' || v === 'bearish' || v === 'neutral') return v;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw > 0) return 'bullish';
    if (raw < 0) return 'bearish';
    return 'neutral';
  }
  return null;
}

// vol_expansion has no backend-provided label; derive a state band from
// the `expansion` readiness (already 0–100). Thresholds match the
// `triggered` cutoff (|score| ≥ 0.25 with readiness floor 0.15 ⇒ ~25 as
// the lower band; full readiness saturates at 100).
function deriveVolExpansionState(expansion: number | null): string | null {
  if (expansion == null) return null;
  if (expansion >= 70) return 'Loaded';
  if (expansion >= 40) return 'Building';
  return 'Quiet';
}

function regimeStateColor(magnitude: number | null): string {
  if (magnitude == null) return 'var(--color-text-secondary)';
  if (magnitude >= 70) return 'var(--color-bull)';
  if (magnitude >= 40) return 'var(--color-warning)';
  return 'var(--color-text-secondary)';
}

interface RegimeTriggersCardProps {
  triggers: RegimeTrigger[];
}

function RegimeTriggersCard({ triggers }: RegimeTriggersCardProps) {
  return (
    <CardShell
      title="Regime Triggers · Readiness"
      tooltip="Three advanced signals whose magnitude — NOT sign — is the read. Each scores 0–100 readiness for a regime shift: Volatility Expansion measures whether the gamma backdrop is loaded for a directional move, Range Break Imminence measures how close chop is to resolving, Market Pressure measures coiled-spring loading. Use these to flip your playbook (e.g. Range Fade → Breakout Mode), not as bullish / bearish votes. A direction tag is shown for context where the backend supplies one — it's secondary to the magnitude."
    >
      <div className="space-y-3">
        {triggers.map((trigger) => {
          const pct = trigger.magnitude != null
            ? Math.max(0, Math.min(100, trigger.magnitude))
            : 0;
          const color = regimeStateColor(trigger.magnitude);
          return (
            <div key={trigger.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {trigger.label}
                </span>
                <span className="flex items-baseline gap-1.5">
                  {trigger.direction === 'bullish' && (
                    <TrendingUp size={11} style={{ color: 'var(--color-bull)' }} aria-label="bullish lean" />
                  )}
                  {trigger.direction === 'bearish' && (
                    <TrendingDown size={11} style={{ color: 'var(--color-bear)' }} aria-label="bearish lean" />
                  )}
                  <span
                    className="font-bold tabular-nums"
                    style={{ color, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {trigger.magnitude != null ? trigger.magnitude.toFixed(0) : '—'}
                  </span>
                  <span className="text-[10px]" style={{ color: colors.muted }}>/100</span>
                </span>
              </div>
              <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span style={{ color: colors.muted }}>
                  {trigger.state ?? (trigger.magnitude == null ? 'awaiting data' : '—')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

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

  // Only the directional / directional-structural advanced signals belong
  // in the breadth tally — their sign is a genuine bullish-vs-bearish vote.
  // The three regime-readiness advanced signals (vol_expansion,
  // range_break_imminence, market_pressure) are surfaced separately by
  // <RegimeTriggersCard> below because their magnitude is the signal and
  // the sign is incidental (e.g. vol_expansion = readiness × momentum).
  const advancedSignals = useMemo<SignalLite[]>(() => {
    const pick = (data: unknown): number | null => {
      const payload = asObject(data);
      return payload ? getNumber(payload.score) : null;
    };
    return [
      { key: 'eod_pressure', label: 'EOD Pressure', score: pick(eodPressure.data) },
      { key: 'squeeze_setup', label: 'Squeeze Setup', score: pick(squeeze.data) },
      { key: 'trap_detection', label: 'Trap Detection', score: pick(trapDetection.data) },
      { key: 'zero_dte_position_imbalance', label: '0DTE Position Imbalance', score: pick(zeroDte.data) },
      { key: 'gamma_vwap_confluence', label: 'Gamma/VWAP Confluence', score: pick(gammaVwap.data) },
    ];
  }, [
    eodPressure.data,
    squeeze.data,
    trapDetection.data,
    zeroDte.data,
    gammaVwap.data,
  ]);

  const regimeTriggers = useMemo<RegimeTrigger[]>(() => {
    const volCtx = asObject(volExpansion.data);
    const rbCtx = asObject(asObject(rangeBreak.data)?.context_values);
    const mpCtx = asObject(asObject(marketPressure.data)?.context_values);
    return [
      {
        key: 'vol_expansion',
        label: 'Volatility Expansion',
        // Top-level `expansion` field (see VolExpansionSignalResponse).
        magnitude: volCtx ? getNumber(volCtx.expansion) : null,
        state: deriveVolExpansionState(volCtx ? getNumber(volCtx.expansion) : null),
        direction: extractDirection(asObject(volExpansion.data)?.direction),
      },
      {
        key: 'range_break_imminence',
        label: 'Range Break Imminence',
        magnitude: rbCtx ? getNumber(rbCtx.imminence) : null,
        state: typeof rbCtx?.label === 'string' ? rbCtx.label : null,
        direction: extractDirection(rbCtx?.direction),
      },
      {
        key: 'market_pressure',
        label: 'Market Pressure',
        magnitude: mpCtx ? getNumber(mpCtx.loading) : null,
        state: typeof mpCtx?.label === 'string' ? mpCtx.label : null,
        direction: extractDirection(mpCtx?.direction_sign),
      },
    ];
  }, [volExpansion.data, rangeBreak.data, marketPressure.data]);

  return (
    // MSI sits on top at its natural height; the Breadth + Regime Triggers
    // pair shares the remaining height of the column (1fr). h-full lets the
    // grid stretch when the dashboard pairs this section with the Volatility
    // Monitor next door, so the two sections settle at matching heights.
    <div className="grid h-full grid-rows-[auto_1fr] gap-4">
      <CompositeMsiCard score={compositeScore} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
        <SignalBreadthCard basicSignals={basicSignals} advancedSignals={advancedSignals} />
        <RegimeTriggersCard triggers={regimeTriggers} />
      </div>
    </div>
  );
}
