'use client';

import { useMemo } from 'react';
import { CalendarClock, Gauge, Info, Pin, Timer, TrendingDown, TrendingUp } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useEodPressureSignal } from '@/hooks/useApiData';
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
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function boolFlag(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

function pressureLabel(score: number | null): string {
  if (score == null) return 'No reading';
  if (score >= 70) return 'Strong bullish close pressure';
  if (score >= 30) return 'Bullish close tilt';
  if (score <= -70) return 'Strong bearish close pressure';
  if (score <= -30) return 'Bearish close tilt';
  return 'Neutral close setup';
}

function formatSigned(value: number | null, digits = 2): string {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function formatPct(value: number | null, digits = 2): string {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(digits)}%`;
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function EodPressurePage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useEodPressureSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.eodPressureMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);

  const score = getNumber(payload.score);
  const direction = String(payload.direction ?? 'neutral').toLowerCase();
  const charmAtSpot = getNumber(payload.charm_at_spot);
  const pinTarget = getNumber(payload.pin_target);
  const pinDistancePct = getNumber(payload.pin_distance_pct);
  const timeRamp = getNumber(payload.time_ramp);
  const gammaRegime = String(payload.gamma_regime ?? 'neutral').toLowerCase();
  const calendarFlags = asObject(payload.calendar_flags) ?? {};
  const isOpex = boolFlag(calendarFlags.opex);
  const isQuadWitching = boolFlag(calendarFlags.quad_witching);

  const trend: 'bullish' | 'bearish' | 'neutral' = direction === 'bullish'
    ? 'bullish'
    : direction === 'bearish'
      ? 'bearish'
      : 'neutral';

  if (loading && !data) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <h1 className="text-3xl font-bold">EOD Pressure</h1>
        <TooltipWrapper
          text="Latest end-of-day pressure score from the unified signal engine. Combines charm-at-spot flow, gamma-gated pin gravity, and a calendar amplifier to forecast the final ~75 minutes of the cash session."
          placement="bottom"
        >
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
              EOD Pressure Score
              <TooltipWrapper text="Range is −100 to +100. Positive implies bullish close pressure; negative implies bearish close pressure." placement="bottom">
                <Info size={13} className="text-[var(--color-text-secondary)]" />
              </TooltipWrapper>
            </div>
            <div className="text-6xl font-black leading-none" style={{ color: trend === 'bullish' ? 'var(--color-bull)' : trend === 'bearish' ? 'var(--color-bear)' : 'var(--color-warning)' }}>
              {score != null ? score.toFixed(2) : '—'}
            </div>
            <div className="mt-2 text-lg font-semibold">{pressureLabel(score)}</div>
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              This signal is gated before <strong>14:30 ET</strong>. Outside the activation window, the API reports neutral (`score = 0`, `time_ramp = 0`).
            </p>
          </div>

          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] p-5 bg-[var(--color-surface-subtle)]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">Pressure Spectrum</div>
              <div className="text-xs text-[var(--color-text-secondary)]">Range: −100 to +100</div>
            </div>
            <div className="relative mt-4">
              <div className="h-4 rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, #d98572 25%, var(--color-warning) 50%, #75cfa1 75%, var(--color-bull) 100%)' }} />
              <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-30" style={{ left: '35%' }} />
              <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-30" style={{ left: '65%' }} />
              <div
                className="absolute -top-2 h-8 w-0.5 bg-[var(--color-text-primary)]"
                style={{
                  left: score != null ? `${Math.max(0, Math.min(100, (score + 100) / 2))}%` : '50%',
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

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                <div className="font-semibold text-[var(--color-bear)] flex items-center gap-1"><TrendingDown size={13} /> Bearish Close</div>
                <div className="text-[var(--color-text-secondary)] mt-1">Negative pressure into the bell.</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                <div className="font-semibold text-[var(--color-warning)] flex items-center gap-1"><Gauge size={13} /> Neutral</div>
                <div className="text-[var(--color-text-secondary)] mt-1">No strong late-session directional edge.</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                <div className="font-semibold text-[var(--color-bull)] flex items-center gap-1"><TrendingUp size={13} /> Bullish Close</div>
                <div className="text-[var(--color-text-secondary)] mt-1">Positive pressure into the close.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Component Breakdown</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Gauge size={16} /> Direction + Regime</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between"><span>Direction</span><span className="font-medium capitalize text-[var(--color-text-primary)]">{direction}</span></div>
              <div className="flex items-center justify-between"><span>Gamma Regime</span><span className="font-medium capitalize text-[var(--color-text-primary)]">{gammaRegime}</span></div>
              <div className="flex items-center justify-between"><span>Pin Distance %</span><span className="font-mono text-[var(--color-text-primary)]">{formatPct(pinDistancePct)}</span></div>
              <div className="flex items-center justify-between"><span>Time Ramp (0..1)</span><span className="font-mono text-[var(--color-text-primary)]">{timeRamp != null ? timeRamp.toFixed(3) : '—'}</span></div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Pin size={16} /> Pin + Charm Inputs</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between"><span>Charm @ Spot</span><span className="font-mono text-[var(--color-text-primary)]">{formatSigned(charmAtSpot, 3)}</span></div>
              <div className="flex items-center justify-between"><span>Pin Target</span><span className="font-mono text-[var(--color-text-primary)]">{formatCurrency(pinTarget)}</span></div>
              <div className="flex items-center justify-between"><span>OpEx Flag</span><span className="font-medium text-[var(--color-text-primary)]">{isOpex ? 'On' : 'Off'}</span></div>
              <div className="flex items-center justify-between"><span>Quad Witching Flag</span><span className="font-medium text-[var(--color-text-primary)]">{isQuadWitching ? 'On' : 'Off'}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><CalendarClock size={18} /> How This Signal Works</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2">Charm-at-Spot Flow</div>
            <p className="text-[var(--color-text-secondary)] text-xs">Signed charm exposure within ±1% of spot estimates the mechanical re-hedging pressure as time decay accelerates near the close.</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2">Gamma-Gated Pin Gravity</div>
            <p className="text-[var(--color-text-secondary)] text-xs">Distance to pin target (heavy-GEX strike or max-pain fallback) is interpreted through current gamma regime to map likely pull vs push dynamics.</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2">Time + Calendar Amplifier</div>
            <p className="text-[var(--color-text-secondary)] text-xs">`time_ramp` scales influence into the final session window, while OpEx / quad-witching flags amplify expected close pressure when active.</p>
          </div>
        </div>
        <div className="mt-4 text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
          <Timer size={14} /> Operational window: activates after 14:30 ET and ramps toward 1.0 by ~15:45 ET.
        </div>
      </section>
    </div>
  );
}
