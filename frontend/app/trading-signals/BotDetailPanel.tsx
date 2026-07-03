'use client';

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApiData } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import type {
  BotDetailResponse,
  BotTradesResponse,
  EquityCurveResponse,
} from './types';

interface Props {
  botId: string;
  onClose: () => void;
}

function fmtMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' ET';
}

export default function BotDetailPanel({ botId, onClose }: Props) {
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
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const equityPoints = useMemo(() => {
    return (equity.data?.points ?? []).map((p) => ({
      ts: p.session_date,
      nav: p.ending_nav,
      realized: p.realized_pnl,
    }));
  }, [equity.data]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
    >
      <div
        className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1.5 hover:bg-[var(--color-surface-subtle)]"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {detail.loading && !detail.data ? (
          <LoadingSpinner />
        ) : detail.error && !detail.data ? (
          <ErrorMessage message={detail.error} onRetry={detail.refetch} />
        ) : detail.data ? (
          <>
            <header className="mb-6">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  {detail.data.display_name}
                </h2>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest"
                  style={{
                    backgroundColor: 'var(--color-info-soft)',
                    color: 'var(--color-info)',
                  }}
                >
                  {detail.data.tier}
                </span>
                <span className="text-[11px] text-[var(--color-text-secondary)]">
                  strategy: <span className="font-mono">{detail.data.strategy_class}</span>
                </span>
              </div>
              {detail.data.tagline ? (
                <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                  {detail.data.tagline}
                </p>
              ) : null}
              {detail.data.description ? (
                <p className="text-xs text-[var(--color-text-secondary)] mt-2 max-w-3xl">
                  {detail.data.description}
                </p>
              ) : null}
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <MiniStat label="Current NAV" value={fmtMoney(detail.data.capital.current)} />
              <MiniStat label="Peak NAV" value={fmtMoney(detail.data.capital.peak)} />
              <MiniStat
                label="Hit Rate"
                value={fmtPct((detail.data.ml_state?.hit_rate as number | null) ?? null, 1)}
              />
              <MiniStat
                label="ML Size Mult."
                value={
                  detail.data.ml_state?.size_multiplier != null
                    ? (Number(detail.data.ml_state.size_multiplier)).toFixed(2)
                    : '1.00'
                }
              />
            </div>

            <section className="mb-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 uppercase tracking-wider">
                Equity Curve
              </h3>
              <div
                className="h-64 p-3 rounded-xl"
                style={{
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {equityPoints.length >= 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={equityPoints}>
                      <defs>
                        <linearGradient id={`nav-${botId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-info)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="var(--color-info)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="ts" tick={{ fontSize: 10 }} stroke="var(--color-text-secondary)" />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        stroke="var(--color-text-secondary)"
                        tickFormatter={(v: number) => fmtMoney(v)}
                        width={70}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(value) => fmtMoney(Number(value))}
                      />
                      <Area
                        type="monotone"
                        dataKey="nav"
                        stroke="var(--color-info)"
                        strokeWidth={2}
                        fill={`url(#nav-${botId})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-[var(--color-text-secondary)]">
                    Waiting for the first sessions of data…
                  </div>
                )}
              </div>
            </section>

            <section className="mb-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 uppercase tracking-wider">
                Recent Trades
              </h3>
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[var(--color-surface)]">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)]">
                          Closed
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)]">
                          Dir
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)]">
                          Type
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)]">
                          Qty
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)]">
                          P&amp;L
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)]">
                          %
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)]">
                          Reason
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(trades.data?.trades ?? []).map((t) => (
                        <tr
                          key={t.id}
                          className="border-t border-[var(--color-border)]/40"
                        >
                          <td className="px-3 py-1.5 text-[var(--color-text-primary)]">
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
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {t.quantity}
                          </td>
                          <td
                            className="px-3 py-1.5 text-right tabular-nums font-medium"
                            style={{
                              color: t.realized_pnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
                            }}
                          >
                            {fmtMoney(t.realized_pnl)}
                          </td>
                          <td
                            className="px-3 py-1.5 text-right tabular-nums"
                            style={{
                              color: t.pnl_percent >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
                            }}
                          >
                            {fmtPct(t.pnl_percent, 1)}
                          </td>
                          <td className="px-3 py-1.5 text-[10px] text-[var(--color-text-secondary)]">
                            {t.close_reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 uppercase tracking-wider">
                ML Calibration
              </h3>
              <div
                className="p-4 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-3 text-xs"
                style={{
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <MiniStat
                  label="Confidence Base"
                  value={fmtPct((detail.data.ml_state?.confidence_base as number) ?? null, 1)}
                />
                <MiniStat
                  label="Trigger Threshold"
                  value={fmtPct((detail.data.ml_state?.confidence_threshold as number) ?? null, 1)}
                />
                <MiniStat
                  label="Win Rate (30d)"
                  value={fmtPct(
                    (detail.data.ml_state?.last_win_rate_30d as number | null) ?? null,
                    1,
                  )}
                />
                <MiniStat
                  label="Profit Factor"
                  value={
                    detail.data.ml_state?.last_profit_factor != null
                      ? Number(detail.data.ml_state.last_profit_factor).toFixed(2)
                      : '—'
                  }
                />
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-2">
                Bot self-calibrates after each closed trade via a per-bot
                online logistic-regression classifier. Confidence base and
                sizing multiplier are recomputed nightly from the trailing{' '}
                {(detail.data.params?.calibration_lookback_days as number) ?? 60}-day trade log.
              </p>
            </section>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
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
