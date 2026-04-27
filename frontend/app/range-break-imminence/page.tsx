'use client';

import { useMemo } from 'react';
import { ArrowLeftRight, Compass, Gauge, Layers, Radar, Radio } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useRangeBreakImminenceSignal } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import SignalScoreHero from '@/components/SignalScoreHero';
import SignalPageTitle from '@/components/SignalPageTitle';
import SignalHowItsBuilt from '@/components/SignalHowItsBuilt';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import {
  asObject,
  getNumber,
  parseScoreHistory,
  toTrend,
  trendColor,
  formatPct,
  formatPrice,
  formatGexCompact,
} from '@/core/signalHelpers';

const FADE_COLOR = 'var(--color-warning)';
const BULL_COLOR = 'var(--color-bull)';
const BEAR_COLOR = 'var(--color-bear)';

function bandFromImminence(imminence: number | null): { name: string; threshold: number } {
  if (imminence == null) return { name: '—', threshold: 0 };
  if (imminence >= 80) return { name: 'Breakout Mode', threshold: 80 };
  if (imminence >= 65) return { name: 'Break Watch', threshold: 65 };
  if (imminence >= 40) return { name: 'Weak Range', threshold: 40 };
  return { name: 'Range Fade', threshold: 0 };
}

export default function RangeBreakImminencePage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useRangeBreakImminenceSignal(
    symbol,
    PROPRIETARY_SIGNALS_REFRESH.rangeBreakImminenceMs,
  );

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const imminence = getNumber(payload.imminence);
  const bias = getNumber(payload.bias);
  const signalStr = String(payload.signal ?? 'neutral');
  const label = String(payload.label ?? bandFromImminence(imminence).name);
  const playbook = typeof payload.playbook === 'string' ? payload.playbook : '';
  const triggered = payload.triggered === true || (imminence != null && imminence >= 65);
  const directionRaw = String(payload.direction ?? 'neutral').toLowerCase();
  const trend = toTrend(payload.direction);
  const directionalColor = trendColor(trend);

  const ctx = useMemo(() => {
    const raw = asObject(payload.context_values) ?? {};
    const skew = asObject(raw.skew) ?? {};
    const dealer = asObject(raw.dealer) ?? {};
    const trap = asObject(raw.trap) ?? {};
    const compression = asObject(raw.compression) ?? {};
    const weights = asObject(raw.weights) ?? {};
    return {
      weights: {
        skew: getNumber(weights.skew) ?? 30,
        dealer: getNumber(weights.dealer) ?? 25,
        trap: getNumber(weights.trap) ?? 25,
        compression: getNumber(weights.compression) ?? 20,
      },
      skew: {
        signed: getNumber(skew.signed),
        magnitude: getNumber(skew.magnitude),
        spread: getNumber(skew.spread),
        deviation: getNumber(skew.deviation),
        otmPutIv: getNumber(skew.otm_put_iv),
        otmCallIv: getNumber(skew.otm_call_iv),
      },
      dealer: {
        signed: getNumber(dealer.signed),
        magnitude: getNumber(dealer.magnitude),
        dealerNetDelta: getNumber(dealer.dealer_net_delta),
      },
      trap: {
        side: String(trap.side ?? 'none'),
        signed: getNumber(trap.signed),
        magnitude: getNumber(trap.magnitude),
        rangeLow: getNumber(trap.range_low),
        rangeHigh: getNumber(trap.range_high),
        nearLowPct: getNumber(trap.near_low_pct),
        nearHighPct: getNumber(trap.near_high_pct),
        putFlowDelta: getNumber(trap.put_flow_delta),
        callFlowDelta: getNumber(trap.call_flow_delta),
      },
      compression: {
        ratio: getNumber(compression.ratio),
        magnitude: getNumber(compression.magnitude),
        longSigma: getNumber(compression.long_sigma),
        shortSigma: getNumber(compression.short_sigma),
      },
    };
  }, [payload]);

  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  // Card accent flips between "fade" (neutral/warning) and "follow" (bull/bear
  // directional) colors at the 65-imminence threshold.
  const accentColor = triggered ? directionalColor : FADE_COLOR;

  if (loading && !data) return <LoadingSpinner size="lg" />;

  const subScores: Array<{ key: string; label: string; magnitude: number | null; weight: number; signed: number | null; color: string }> = [
    { key: 'skew', label: 'Skew extreme', magnitude: ctx.skew.magnitude, weight: ctx.weights.skew, signed: ctx.skew.signed, color: '#6EA8FE' },
    { key: 'dealer', label: 'Dealer delta', magnitude: ctx.dealer.magnitude, weight: ctx.weights.dealer, signed: ctx.dealer.signed, color: '#C084FC' },
    { key: 'trap', label: 'Trap', magnitude: ctx.trap.magnitude, weight: ctx.weights.trap, signed: ctx.trap.signed, color: BEAR_COLOR },
    { key: 'compression', label: 'Compression', magnitude: ctx.compression.magnitude, weight: ctx.weights.compression, signed: null, color: BULL_COLOR },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <SignalPageTitle
        title="Range Break Imminence"
        icon={Radio}
        tooltip="Regime-switch detector between chop and breakout. Fuses IV skew (30%), dealer delta pressure (25%), trap detection (25%), and volatility compression (20%) into a 0–100 imminence score. Triggers at imminence ≥ 65. Standalone detector, not part of the MSI composite."
      />

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
          <div className="lg:col-span-2">
            <SignalScoreHero
              score={score}
              trend={trend}
              interpretation={label}
              history={history}
              badges={
                <>
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide"
                    style={{ background: `${accentColor}1f`, color: accentColor }}
                  >
                    {triggered && <span className="h-1.5 w-1.5 rounded-full" style={{ background: accentColor }} />}
                    {signalStr.replace(/_/g, ' ')}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-[var(--color-border)]">
                    Imminence
                    <span className="font-mono ml-1" style={{ color: accentColor }}>
                      {imminence != null ? imminence.toFixed(1) : '—'}
                    </span>
                  </span>
                </>
              }
              footnote={playbook ? <p className="leading-relaxed">{playbook}</p> : undefined}
            />
          </div>

          <div className="lg:col-span-3 h-full">
            <div
              className="rounded-xl border bg-[var(--color-surface-subtle)] p-5 flex flex-col h-full"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold flex items-center gap-2"><Layers size={14} /> Sub-score contributions</div>
                <div className="text-[11px] text-[var(--color-text-secondary)]">
                  Imminence = weighted sum of absolute sub-scores
                </div>
              </div>
              <div className="flex-1 flex flex-col">
                <SubScoreBars rows={subScores} />
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <MetricPill label="Score" value={score != null ? score.toFixed(1) : '—'} color={directionalColor} />
                <MetricPill label="Imminence" value={imminence != null ? imminence.toFixed(1) : '—'} color={accentColor} />
                <MetricPill label="Direction" value={directionRaw} color={directionalColor} capitalize />
                <MetricPill label="Bias" value={bias != null ? bias.toFixed(2) : '—'} color="var(--color-text-primary)" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Input Breakdown</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><ArrowLeftRight size={16} /> Skew <span className="text-[10px] text-[var(--color-text-secondary)]">{ctx.weights.skew}%</span></div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Signed" value={ctx.skew.signed != null ? ctx.skew.signed.toFixed(2) : '—'} />
              <Row label="Magnitude" value={ctx.skew.magnitude != null ? ctx.skew.magnitude.toFixed(1) : '—'} />
              <Row label="Spread" value={ctx.skew.spread != null ? ctx.skew.spread.toFixed(4) : '—'} />
              <Row label="Deviation" value={ctx.skew.deviation != null ? ctx.skew.deviation.toFixed(4) : '—'} />
              <Row label="OTM put IV" value={formatPct(ctx.skew.otmPutIv, 2, false)} />
              <Row label="OTM call IV" value={formatPct(ctx.skew.otmCallIv, 2, false)} />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Gauge size={16} /> Dealer <span className="text-[10px] text-[var(--color-text-secondary)]">{ctx.weights.dealer}%</span></div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Signed" value={ctx.dealer.signed != null ? ctx.dealer.signed.toFixed(2) : '—'} />
              <Row label="Magnitude" value={ctx.dealer.magnitude != null ? ctx.dealer.magnitude.toFixed(1) : '—'} />
              <Row label="Dealer net Δ" value={formatGexCompact(ctx.dealer.dealerNetDelta)} />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Radar size={16} /> Trap <span className="text-[10px] text-[var(--color-text-secondary)]">{ctx.weights.trap}%</span></div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Side" value={<span className="capitalize">{ctx.trap.side}</span>} />
              <Row label="Signed" value={ctx.trap.signed != null ? ctx.trap.signed.toFixed(2) : '—'} />
              <Row label="Magnitude" value={ctx.trap.magnitude != null ? ctx.trap.magnitude.toFixed(1) : '—'} />
              <Row label="Range high" value={formatPrice(ctx.trap.rangeHigh)} />
              <Row label="Range low" value={formatPrice(ctx.trap.rangeLow)} />
              <Row label="Near high" value={formatPct(ctx.trap.nearHighPct, 2, false)} />
              <Row label="Near low" value={formatPct(ctx.trap.nearLowPct, 2, false)} />
              <Row label="Put flow Δ" value={formatGexCompact(ctx.trap.putFlowDelta)} />
              <Row label="Call flow Δ" value={formatGexCompact(ctx.trap.callFlowDelta)} />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Compass size={16} /> Compression <span className="text-[10px] text-[var(--color-text-secondary)]">{ctx.weights.compression}%</span></div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Ratio (10/60)" value={ctx.compression.ratio != null ? ctx.compression.ratio.toFixed(3) : '—'} />
              <Row label="Magnitude" value={ctx.compression.magnitude != null ? ctx.compression.magnitude.toFixed(1) : '—'} />
              <Row label="Short σ" value={ctx.compression.shortSigma != null ? ctx.compression.shortSigma.toFixed(4) : '—'} />
              <Row label="Long σ" value={ctx.compression.longSigma != null ? ctx.compression.longSigma.toFixed(4) : '—'} />
            </div>
            <p className="mt-3 pt-2 border-t border-[var(--color-border)]/40 text-[11px] text-[var(--color-text-secondary)]">
              Directionless — adds magnitude only.
            </p>
          </div>
        </div>
      </section>

      <SignalHowItsBuilt
        caveat={
          <>
            <strong>Bands:</strong> 0–39 Range Fade · 40–64 Weak Range · 65–79 Break Watch · 80–100 Breakout Mode.
            Triggers at imminence ≥ 65 — stop blindly fading and prepare retest trades.
          </>
        }
      >
        <div>Four sub-signals are computed independently as 0–100 magnitudes with optional signed direction:
          IV skew (30%), dealer delta pressure (25%), trap detection (25%), volatility compression (20%, directionless).
        </div>
        <div><code>imminence = Σ (magnitude_i × weight_i) / 100</code> in 0–100.</div>
        <div><code>bias = Σ (signed_i × weight_i) / 100</code> in [−1, +1] — drives the directional <code>score</code>.</div>
        <div><code>score = imminence × bias</code> (sign carried by bias). Direction is derived from sign of bias.</div>
      </SignalHowItsBuilt>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-mono text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}

function MetricPill({ label, value, color, capitalize }: { label: string; value: string; color: string; capitalize?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">{label}</div>
      <div className={`text-lg font-black leading-tight ${capitalize ? 'capitalize' : ''}`} style={{ color }}>
        {value}
      </div>
    </div>
  );
}

interface SubScoreRow {
  key: string;
  label: string;
  magnitude: number | null;
  weight: number;
  signed: number | null;
  color: string;
}

function SubScoreBars({ rows }: { rows: SubScoreRow[] }) {
  return (
    <div className="flex flex-col gap-4 h-full justify-around">
      {rows.map((row) => {
        const mag = row.magnitude ?? 0;
        const magClamped = Math.max(0, Math.min(100, mag));
        const contribution = (magClamped * row.weight) / 100;
        const signLabel =
          row.signed == null
            ? ''
            : row.signed > 0
              ? ' ↑'
              : row.signed < 0
                ? ' ↓'
                : '';
        return (
          <div key={row.key}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-2 text-[var(--color-text-primary)] font-semibold">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
                {row.label}
                <span className="text-[10px] font-normal text-[var(--color-text-secondary)]">{row.weight}%</span>
              </span>
              <span className="text-[var(--color-text-secondary)] font-mono">
                {row.magnitude != null ? `${row.magnitude.toFixed(1)}${signLabel}` : '—'}
                <span className="ml-2 text-[10px]">contrib {contribution.toFixed(1)}</span>
              </span>
            </div>
            <div className="h-3 rounded-full bg-[var(--color-surface)] overflow-hidden border border-[var(--color-border)]/40">
              <div
                className="h-full transition-all"
                style={{ width: `${magClamped}%`, background: row.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
