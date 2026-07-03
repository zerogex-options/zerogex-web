'use client';

/**
 * BotDetailPanel — the drilldown modal for one bot.
 *
 * Rendered via createPortal so the modal escapes the parent grid and can
 * dim the whole viewport. Contents, in reading order:
 *   1. Hero: display name, tier, tagline, description.
 *   2. Metric grid: NAV, peak NAV, hit rate, ML size multiplier.
 *   3. Cumulative return curve (indexed to 100 = starting NAV).
 *   4. Daily P&L bar chart + drawdown line, stacked.
 *   5. Recent trades table (scrollable).
 *   6. ML calibration state.
 */

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApiData } from '@/hooks/useApiData';
import EmptyState from './EmptyState';
import { botColor, botColorSoft } from './palette';
import { fmtDate, fmtDateTime, fmtMoney, fmtPct, fmtRatio, fmtSignedMoney, fmtSignedPct } from './format';
import type {
  BotDetailResponse,
  BotTradesResponse,
  EquityCurveResponse,
} from './types';

interface Props {
  botId: string;
  paletteIndex: number;
  onClose: () => void;
}

interface EquityChartPoint {
  session_date: string;
  return_pct: number;
  ending_nav: number;
  realized_pnl: number;
}

interface DrawdownChartPoint {
  session_date: string;
  realized_pnl: number;
  drawdown_pct: number;
}

export default function BotDetailPanel({ botId, paletteIndex, onClose }: Props) {
  const color = botColor(botId, paletteIndex);

  const detail = useApiData<BotDetailResponse>(`/api/tradeworkz/bots/${botId}`, {
    refreshInterval: 30_000,
  });
  const equity = useApiData<EquityCurveResponse>(
    `/api/tradeworkz/bots/${botId}/equity-curve?days=180`,
    { refreshInterval: 60_000 },
  );
  const trades = useApiData<BotTradesResponse>(
    `/api/tradeworkz/bots/${botId}/trades?limit=50`,
    { refreshInterval: 30_000 },
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    // Lock body scroll while modal is up.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const equityPoints: EquityChartPoint[] = useMemo(() => {
    const raw = equity.data?.points ?? [];
    if (raw.length === 0) return [];
    const base = raw[0].starting_nav || raw[0].ending_nav || 1;
    return raw.map((p) => ({
      session_date: p.session_date,
      ending_nav: p.ending_nav,
      realized_pnl: p.realized_pnl,
      return_pct: base > 0 ? (p.ending_nav / base - 1) * 100 : 0,
    }));
  }, [equity.data]);

  const drawdownPoints: DrawdownChartPoint[] = useMemo(() => {
    let peak = -Infinity;
    return equityPoints.map((p) => {
      peak = Math.max(peak, p.ending_nav);
      const dd = peak > 0 ? (p.ending_nav / peak - 1) * 100 : 0;
      return {
        session_date: p.session_date,
        realized_pnl: p.realized_pnl,
        drawdown_pct: dd,
      };
    });
  }, [equityPoints]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-3 md:p-6 overflow-y-auto"
      onClick={onClose}
      style={{
        backgroundColor: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="relative w-full max-w-5xl rounded-2xl my-8"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
        }}
      >
        <div
          className="h-1 rounded-t-2xl"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1.5 hover:bg-[var(--color-surface-subtle)] z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
        </button>

        <div className="p-6">
          {detail.error && !detail.data ? (
            <EmptyState title="Could not load bot" description={detail.error} />
          ) : (
            <>
              <header className="mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                    {detail.data?.display_name ?? 'Loading…'}
                  </h2>
                  {detail.data ? (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest"
                      style={{ backgroundColor: botColorSoft(botId, paletteIndex), color }}
                    >
                      {detail.data.tier}
                    </span>
                  ) : null}
                  {detail.data ? (
                    <span className="text-[11px] text-[var(--color-text-secondary)]">
                      strategy: <span className="font-mono">{detail.data.strategy_class}</span>
                    </span>
                  ) : null}
                </div>
                {detail.data?.tagline ? (
                  <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                    {detail.data.tagline}
                  </p>
                ) : null}
                {detail.data?.description ? (
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2 max-w-3xl">
                    {detail.data.description}
                  </p>
                ) : null}
              </header>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <MiniStat label="Current NAV" value={fmtMoney(detail.data?.capital.current)} />
                <MiniStat label="Peak NAV" value={fmtMoney(detail.data?.capital.peak)} />
                <MiniStat
                  label="Hit Rate"
                  value={fmtPct((detail.data?.ml_state?.hit_rate as number | null) ?? null, 1)}
                />
                <MiniStat
                  label="ML Size Mult."
                  value={
                    detail.data?.ml_state?.size_multiplier != null
                      ? fmtRatio(Number(detail.data.ml_state.size_multiplier))
                      : '1.00'
                  }
                />
              </div>

              <SectionHeading>Cumulative Return</SectionHeading>
              <ChartFrame>
                {equityPoints.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={equityPoints} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <defs>
                        <linearGradient id={`nav-${botId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                      <XAxis
                        dataKey="session_date"
                        tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                        tickFormatter={fmtDate}
                        interval="preserveStartEnd"
                        minTickGap={40}
                        stroke="var(--color-border)"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                        tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
                        stroke="var(--color-border)"
                        width={48}
                      />
                      <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="3 3" />
                      <Tooltip
                        cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }}
                        content={<EquityTooltip color={color} />}
                      />
                      <Area
                        type="monotone"
                        dataKey="return_pct"
                        stroke={color}
                        strokeWidth={2}
                        fill={`url(#nav-${botId})`}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart label="Cumulative return chart needs at least two closed sessions." />
                )}
              </ChartFrame>

              <SectionHeading>Daily P&amp;L and Drawdown</SectionHeading>
              <ChartFrame>
                {drawdownPoints.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={drawdownPoints} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                      <XAxis
                        dataKey="session_date"
                        tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                        tickFormatter={fmtDate}
                        interval="preserveStartEnd"
                        minTickGap={40}
                        stroke="var(--color-border)"
                      />
                      <YAxis
                        yAxisId="pnl"
                        tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                        tickFormatter={(v: number) => fmtMoney(v)}
                        stroke="var(--color-border)"
                        width={64}
                      />
                      <YAxis
                        yAxisId="dd"
                        orientation="right"
                        tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                        tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                        stroke="var(--color-border)"
                        width={40}
                      />
                      <ReferenceLine y={0} yAxisId="pnl" stroke="var(--color-border)" />
                      <Tooltip content={<DrawdownTooltip color={color} />} />
                      <Bar
                        yAxisId="pnl"
                        dataKey="realized_pnl"
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={false}
                      >
                        {drawdownPoints.map((p, i) => (
                          <Cell
                            key={i}
                            fill={p.realized_pnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)'}
                            opacity={0.85}
                          />
                        ))}
                      </Bar>
                      <Line
                        yAxisId="dd"
                        dataKey="drawdown_pct"
                        stroke={color}
                        strokeWidth={1.75}
                        dot={false}
                        type="monotone"
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart label="Waiting for daily P&L data." />
                )}
              </ChartFrame>

              <SectionHeading>Recent Trades</SectionHeading>
              <div
                className="rounded-xl overflow-hidden mb-6"
                style={{
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div className="overflow-x-auto max-h-72">
                  {trades.data && trades.data.trades.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead
                        className="sticky top-0"
                        style={{ backgroundColor: 'var(--color-surface)' }}
                      >
                        <tr>
                          <TradeTh>Closed</TradeTh>
                          <TradeTh>Dir</TradeTh>
                          <TradeTh>Type</TradeTh>
                          <TradeTh align="right">Qty</TradeTh>
                          <TradeTh align="right">P&amp;L</TradeTh>
                          <TradeTh align="right">%</TradeTh>
                          <TradeTh>Reason</TradeTh>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.data.trades.map((t) => (
                          <tr key={t.id} className="border-t border-[var(--color-border)]/40">
                            <td className="px-3 py-1.5 text-[var(--color-text-primary)] whitespace-nowrap">
                              {fmtDateTime(t.closed_at)}
                            </td>
                            <td className="px-3 py-1.5">
                              <span
                                className="uppercase text-[10px] px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor:
                                    t.direction === 'bullish'
                                      ? 'var(--color-bull-soft)'
                                      : 'var(--color-bear-soft)',
                                  color:
                                    t.direction === 'bullish'
                                      ? 'var(--color-bull)'
                                      : 'var(--color-bear)',
                                }}
                              >
                                {t.direction === 'bullish' ? 'LONG' : 'SHORT'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 font-mono text-[10px] text-[var(--color-text-secondary)]">
                              {t.strategy_type}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{t.quantity}</td>
                            <td
                              className="px-3 py-1.5 text-right tabular-nums font-medium"
                              style={{
                                color:
                                  t.realized_pnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
                              }}
                            >
                              {fmtSignedMoney(t.realized_pnl)}
                            </td>
                            <td
                              className="px-3 py-1.5 text-right tabular-nums"
                              style={{
                                color: t.pnl_percent >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
                              }}
                            >
                              {fmtSignedPct(t.pnl_percent, 1)}
                            </td>
                            <td className="px-3 py-1.5 text-[10px] text-[var(--color-text-secondary)]">
                              {t.close_reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-6 text-center">
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        No closed trades yet. Trades appear here as the bot exits positions.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <SectionHeading>ML Calibration</SectionHeading>
              <div
                className="p-4 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-3 text-xs"
                style={{
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <MiniStat
                  label="Confidence Base"
                  value={fmtPct(
                    (detail.data?.ml_state?.confidence_base as number | null) ?? null,
                    1,
                  )}
                />
                <MiniStat
                  label="Trigger Threshold"
                  value={fmtPct(
                    (detail.data?.ml_state?.confidence_threshold as number | null) ?? null,
                    1,
                  )}
                />
                <MiniStat
                  label="Win Rate (30d)"
                  value={fmtPct(
                    (detail.data?.ml_state?.last_win_rate_30d as number | null) ?? null,
                    1,
                  )}
                />
                <MiniStat
                  label="Profit Factor"
                  value={
                    detail.data?.ml_state?.last_profit_factor != null
                      ? fmtRatio(Number(detail.data.ml_state.last_profit_factor))
                      : '—'
                  }
                />
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-2">
                Bot self-calibrates after each closed trade via a per-bot online logistic-regression
                classifier. Confidence base and sizing multiplier are recomputed from the trailing{' '}
                {(detail.data?.params?.calibration_lookback_days as number | undefined) ?? 60}-day trade log.
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 mt-6 first:mt-0">
      {children}
    </h3>
  );
}

function ChartFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="p-3 rounded-xl mb-2"
      style={{
        backgroundColor: 'var(--color-surface-subtle)',
        border: '1px solid var(--color-border)',
      }}
    >
      {children}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-xs text-[var(--color-text-secondary)]">
      {label}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">
        {label}
      </div>
      <div className="text-sm font-medium text-[var(--color-text-primary)] tabular-nums">
        {value}
      </div>
    </div>
  );
}

function TradeTh({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-3 py-2 text-${align} font-semibold text-[var(--color-text-secondary)]`}
    >
      {children}
    </th>
  );
}

interface EquityTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ value: number | null; payload: EquityChartPoint }>;
  color: string;
}

function EquityTooltip({ active, payload, label, color }: EquityTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div
      className="p-3 rounded-xl text-xs"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      }}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5">
        {fmtDate(String(label))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 items-baseline">
        <span className="text-[var(--color-text-secondary)]">Return</span>
        <span
          className="text-right tabular-nums font-medium"
          style={{ color: p.return_pct >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}
        >
          {fmtSignedPct(p.return_pct / 100, 2)}
        </span>
        <span className="text-[var(--color-text-secondary)]">NAV</span>
        <span className="text-right tabular-nums" style={{ color }}>
          {fmtMoney(p.ending_nav)}
        </span>
        <span className="text-[var(--color-text-secondary)]">Realized</span>
        <span
          className="text-right tabular-nums"
          style={{ color: p.realized_pnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}
        >
          {fmtSignedMoney(p.realized_pnl)}
        </span>
      </div>
    </div>
  );
}

interface DrawdownTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ value: number | null; payload: DrawdownChartPoint; dataKey: string }>;
  color: string;
}

function DrawdownTooltip({ active, payload, label, color }: DrawdownTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div
      className="p-3 rounded-xl text-xs"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      }}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5">
        {fmtDate(String(label))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 items-baseline">
        <span className="text-[var(--color-text-secondary)]">Realized P&amp;L</span>
        <span
          className="text-right tabular-nums font-medium"
          style={{ color: p.realized_pnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}
        >
          {fmtSignedMoney(p.realized_pnl)}
        </span>
        <span className="text-[var(--color-text-secondary)]">Drawdown</span>
        <span className="text-right tabular-nums" style={{ color }}>
          {fmtSignedPct(p.drawdown_pct / 100, 2)}
        </span>
      </div>
    </div>
  );
}
