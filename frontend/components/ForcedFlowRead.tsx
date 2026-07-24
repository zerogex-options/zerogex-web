'use client';

import { Info } from 'lucide-react';
import { useMemo } from 'react';
import TooltipWrapper from './TooltipWrapper';
import { useChartTheme } from '@/hooks/useChartTheme';
import {
  useForcedFlowLevels,
  useForcedFlowCharmDecay,
  useForcedFlowBacktest,
  type ForcedFlowCharmDecayPoint,
} from '@/hooks/useApiData';

interface ForcedFlowReadProps {
  symbol?: string;
}

// --------------------------------------------------------------------------- //
// Formatters — local, matching the per-chart convention elsewhere in this dir
// (no shared money/price util in core/).
// --------------------------------------------------------------------------- //
function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return '--';
  if (value === 0) return '$0';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(value >= 1000 ? 0 : 2);
}

function formatSignedPrice(value: number): string {
  if (!Number.isFinite(value)) return '--';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function formatPct(frac: number): string {
  if (!Number.isFinite(frac)) return '--';
  return `${Math.round(frac * 100)}%`;
}

// Wall-clock string from the session-days-remaining horizon (a fraction of a
// 24h calendar day). Always intraday — the horizon is "to today's 16:00 ET".
function formatToClose(sessionDays: number): string {
  const mins = sessionDays * 24 * 60;
  if (mins < 1) return 'at the close';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m to close` : `${m}m to close`;
}

// Linear interpolation of a cumulative (monotonic-in-magnitude) curve at an
// arbitrary elapsed-time t, for "how much of the flow has landed by t".
function interpCumulative(curve: ForcedFlowCharmDecayPoint[], t: number): number {
  if (!curve.length) return 0;
  if (t <= curve[0].days_elapsed) return curve[0].flow;
  for (let i = 1; i < curve.length; i++) {
    if (t <= curve[i].days_elapsed) {
      const a = curve[i - 1];
      const b = curve[i];
      const span = b.days_elapsed - a.days_elapsed || 1;
      return a.flow + (b.flow - a.flow) * ((t - a.days_elapsed) / span);
    }
  }
  return curve[curve.length - 1].flow;
}

// --------------------------------------------------------------------------- //
// The Read — the verdict-first hero. One plain-language call, three state
// tiles, and a compact "remaining charm" sparkline, all off the live
// /forced-flow endpoints. Everything below it on the page is the evidence.
// --------------------------------------------------------------------------- //
export default function ForcedFlowRead({ symbol = 'SPY' }: ForcedFlowReadProps) {
  const chart = useChartTheme();
  const { data: levels, loading: levelsLoading, error: levelsError } = useForcedFlowLevels(symbol, 15000);
  const { data: charm } = useForcedFlowCharmDecay(symbol, 15000);
  const { data: backtest } = useForcedFlowBacktest(symbol);

  const spot = levels?.spot ?? null;
  const gammaFlip = levels?.gamma_flip ?? null;
  const magnet = levels?.zero_flow_level ?? null;

  const closeFlow = charm?.close_flow_usd ?? null;
  const sessionDays = charm?.session_days ?? null;
  // Memoized so its identity is stable across renders — it feeds the sparkline
  // and back-loading useMemo deps below.
  const curve = useMemo<ForcedFlowCharmDecayPoint[]>(() => charm?.curve ?? [], [charm]);

  // --- Regime: spot vs. the gamma flip. Below the flip dealers are short
  // gamma and amplify moves; above it they are long gamma and dampen them. ---
  const distToFlip = spot != null && gammaFlip != null ? spot - gammaFlip : null;
  const shortGamma = distToFlip != null ? distToFlip < 0 : null;

  // --- Into-close pressure: sign + magnitude, and how back-loaded it is. ---
  const hasFlow = closeFlow != null && Number.isFinite(closeFlow) && closeFlow !== 0 && (sessionDays ?? 0) > 0;
  const buying = hasFlow ? (closeFlow as number) > 0 : null;
  const fracFinalHour = useMemo(() => {
    if (!hasFlow || sessionDays == null || !curve.length) return null;
    const lastHourStart = Math.max(0, sessionDays - 1 / 24);
    const flowByThen = interpCumulative(curve, lastHourStart);
    const cf = closeFlow as number;
    if (cf === 0) return null;
    return Math.min(1, Math.max(0, (cf - flowByThen) / cf));
  }, [hasFlow, sessionDays, curve, closeFlow]);

  // --- Magnet distance. ---
  const magnetDist = spot != null && magnet != null ? magnet - spot : null;

  // Semantic colors: buy/sell own green/red; the magnet takes info-blue; the
  // regime takes amber (short γ = the "hot" amplifying regime) vs. info
  // (long γ = the dampening/pinning regime), deliberately NOT red/green so it
  // never reads as a buy/sell instruction.
  const flowColor = buying ? chart.bull : chart.bear;
  const regimeColor = shortGamma ? chart.warning : chart.info;
  const magnetColor = chart.info;

  const hasRegime = distToFlip != null;
  const hasMagnet = magnet != null && magnetDist != null;
  const ready = spot != null && (hasRegime || hasFlow || hasMagnet);

  // --- The compact remaining-charm sparkline (now → close). --------------- //
  const spark = useMemo(() => {
    if (!hasFlow || sessionDays == null || sessionDays <= 0 || curve.length < 2) return null;
    const W = 300;
    const H = 84;
    const padB = 2;
    const cf = closeFlow as number;
    const maxT = sessionDays;
    const x = (t: number) => (t / maxT) * W;
    // Normalize by close flow so the curve reads 0→1 regardless of sign.
    const y = (f: number) => H - padB - (f / cf) * (H - padB - 6);
    const pts = curve.map((p) => `${x(p.days_elapsed).toFixed(1)},${y(p.flow).toFixed(1)}`);
    const line = `M${pts.join(' L')}`;
    const base = H - padB;
    const area = `M0,${base} L${pts.join(' L')} L${x(maxT).toFixed(1)},${base} Z`;
    // Final-hour region (remaining < 1h), shaded stronger — "the late tape".
    const lastHourStart = Math.max(0, sessionDays - 1 / 24);
    const xLast = x(lastHourStart);
    const endX = x(maxT);
    const endY = y(cf);
    return { W, H, line, area, xLast, endX, endY, base };
  }, [hasFlow, sessionDays, curve, closeFlow]);

  // --- Honest track-record chip (the 0DTE-inclusive "full" definition, which
  // is what close_flow_usd measures). ------------------------------------- //
  const record = useMemo(() => {
    const bt = backtest?.full;
    if (!bt || bt.evaluated_sessions === 0) {
      return { tone: 'muted' as const, text: 'Forecast track record: collecting sessions…' };
    }
    const n = bt.evaluated_sessions;
    const hr = bt.hit_rate != null ? formatPct(bt.hit_rate) : '--';
    if (n < 30) {
      return { tone: 'warn' as const, text: `Forecast: ${hr} over ${n} sessions — collecting (${n}/30 to score)` };
    }
    if (bt.significant) {
      const base = bt.baseline_rate != null ? formatPct(bt.baseline_rate) : '--';
      return { tone: 'good' as const, text: `Forecast edge: ${hr} over ${n} sessions — beats the ${base} baseline` };
    }
    return { tone: 'warn' as const, text: `Forecast: ${hr} over ${n} sessions — not yet a proven edge` };
  }, [backtest]);

  const recordColor =
    record.tone === 'good' ? chart.bull : record.tone === 'warn' ? chart.warning : 'var(--text-muted)';

  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    border: `1px solid ${'var(--text-secondary)'}`,
  } as const;

  // --- Loading / empty states. ------------------------------------------- //
  if (levelsError && !levels) {
    return (
      <div className="rounded-2xl p-6" style={cardStyle}>
        <ReadHeader symbol={symbol} />
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {levelsError === 'No data available yet'
            ? `No forced-flow read for ${symbol} yet — waiting on the next snapshot.`
            : `Couldn’t load the read: ${levelsError}`}
        </div>
      </div>
    );
  }
  if (levelsLoading && !levels) {
    return (
      <div className="rounded-2xl p-6" style={cardStyle}>
        <ReadHeader symbol={symbol} />
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Reading the tape…</div>
      </div>
    );
  }
  if (!ready || spot == null) {
    return (
      <div className="rounded-2xl p-6" style={cardStyle}>
        <ReadHeader symbol={symbol} />
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          No actionable read right now — the market may be closed or the book too thin to price.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-6" style={cardStyle}>
      <div className="mb-3 flex items-baseline justify-between gap-2 flex-wrap">
        <ReadHeader symbol={symbol} />
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {symbol} <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{formatPrice(spot)}</span>
          {sessionDays != null && <span className="ml-2">· {formatToClose(sessionDays)}</span>}
        </span>
      </div>

      {/* THE VERDICT — one plain-language call. */}
      <p className="text-[15px] leading-relaxed mb-4" style={{ color: 'var(--text-primary)' }}>
        {hasRegime && (
          <>
            Dealers are{' '}
            <span className="font-bold" style={{ color: regimeColor }}>
              {shortGamma ? 'short gamma' : 'long gamma'}
            </span>{' '}
            — {symbol} sits{' '}
            <span className="font-mono font-semibold">{formatPrice(Math.abs(distToFlip as number))}</span>{' '}
            {(distToFlip as number) < 0 ? 'below' : 'above'} the{' '}
            <span className="font-mono font-semibold">{formatPrice(gammaFlip as number)}</span> flip, where they{' '}
            {shortGamma ? 'amplify' : 'dampen'} moves.{' '}
          </>
        )}
        {hasFlow && (
          <>
            Time decay alone still owes{' '}
            <span className="font-bold" style={{ color: flowColor }}>
              ≈ {buying ? 'buying' : 'selling'} {formatCompactUsd(Math.abs(closeFlow as number))}
            </span>{' '}
            into the 4:00 bell if spot holds.{' '}
          </>
        )}
        {hasMagnet && (
          <>
            The magnet — where dealers have nothing left to hedge — sits at{' '}
            <span className="font-bold font-mono" style={{ color: magnetColor }}>
              {formatPrice(magnet as number)}
            </span>{' '}
            ({formatSignedPrice(magnetDist as number)}).
          </>
        )}
      </p>

      {/* LEAN + honest track record. */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {hasRegime && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
            style={{ color: regimeColor, background: shortGamma ? chart.warningSoft : chart.infoSoft }}
          >
            Lean: {shortGamma ? 'with the move' : 'fade the extremes'}
          </span>
        )}
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
          style={{ color: recordColor, border: `1px dashed ${'var(--border-strong)'}` }}
        >
          {record.text}
        </span>
      </div>

      {/* THREE STATE TILES. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile
          label="Regime"
          pill={hasRegime ? (shortGamma ? 'Short γ' : 'Long γ') : '—'}
          pillColor={regimeColor}
          value={hasRegime ? formatSignedPrice(distToFlip as number) : '—'}
          valueColor="var(--text-primary)"
          sub={
            hasRegime
              ? shortGamma
                ? 'Below the gamma flip. Dealers amplify moves — breakouts run, dips aren’t bought.'
                : 'Above the gamma flip. Dealers dampen moves — extremes get faded, expect the pin.'
              : 'Gamma flip unavailable.'
          }
        />
        <Tile
          label="Into-close flow"
          pill={hasFlow ? (buying ? 'Buy' : 'Sell') : '—'}
          pillColor={hasFlow ? flowColor : 'var(--text-muted)'}
          value={hasFlow ? formatCompactUsd(closeFlow as number) : '—'}
          valueColor={hasFlow ? flowColor : 'var(--text-primary)'}
          sub={
            hasFlow
              ? `Charm-forced ${buying ? 'buying' : 'selling'} owed by 4:00 if spot holds.${
                  fracFinalHour != null ? ` ${formatPct(fracFinalHour)} of it lands in the final hour.` : ''
                }`
              : 'No time pressure into a bell right now.'
          }
        >
          {spark && (
            <div className="mt-3" style={{ overflowX: 'hidden' }}>
              <svg viewBox={`0 0 ${spark.W} ${spark.H}`} width="100%" height="48" preserveAspectRatio="none" aria-hidden="true">
                {/* Final-hour region — the late tape. */}
                <rect x={spark.xLast} y={0} width={spark.endX - spark.xLast} height={spark.H} fill={flowColor} opacity={0.08} />
                <path d={spark.area} fill={flowColor} opacity={0.14} />
                <path d={spark.line} fill="none" stroke={flowColor} strokeWidth={2} />
                <circle cx={spark.endX} cy={spark.endY} r={3} fill={flowColor} />
                <line x1={0} y1={spark.base} x2={spark.W} y2={spark.base} stroke="var(--border-default)" strokeWidth={1} />
              </svg>
              <div className="flex justify-between text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                <span>now</span>
                <span>final hour →</span>
              </div>
            </div>
          )}
        </Tile>
        <Tile
          label="Magnet · zero-flow"
          pill={hasMagnet ? ((magnetDist as number) >= 0 ? 'Above' : 'Below') : '—'}
          pillColor={magnetColor}
          value={hasMagnet ? formatPrice(magnet as number) : '—'}
          valueColor={magnetColor}
          sub={
            hasMagnet
              ? `${formatSignedPrice(magnetDist as number)} from spot. The price dealers have nothing left to hedge — it pulls the tape, hardest into the close.`
              : 'Zero-flow level unavailable in range.'
          }
        />
      </div>

      {levels?.timestamp && (
        <div className="mt-3 text-right text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Snapshot {new Date(levels.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function ReadHeader({ symbol }: { symbol: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <h3 className="zg-h3" style={{ color: 'var(--text-primary)' }}>
        The Read
      </h3>
      <TooltipWrapper
        text={`A plain-language read of where dealers are mechanically forced today, for ${symbol}. Regime: spot vs. the gamma flip — below it dealers amplify moves (lean with the move); above it they dampen them (fade extremes, expect the pin). Into-close flow: the dollars time-decay alone forces dealers to trade by 4pm if spot holds, and how much of it lands late. Magnet: the zero-flow price where dealers have nothing left to hedge. Everything below on this page is the evidence behind this read.`}
      >
        <Info size={14} />
      </TooltipWrapper>
    </div>
  );
}

function Tile({
  label,
  pill,
  pillColor,
  value,
  valueColor,
  sub,
  children,
}: {
  label: string;
  pill: string;
  pillColor: string;
  value: string;
  valueColor: string;
  sub: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col"
      style={{ background: 'var(--bg-main)', border: `1px solid ${'var(--border-default)'}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <span className="text-[10px] font-extrabold uppercase tracking-wide rounded px-1.5 py-0.5" style={{ color: pillColor, background: 'transparent', border: `1px solid ${pillColor}` }}>
          {pill}
        </span>
      </div>
      <div className="font-mono font-bold leading-none" style={{ fontSize: 26, color: valueColor }}>
        {value}
      </div>
      <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
        {sub}
      </div>
      {children}
    </div>
  );
}
