'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { backtestAPI } from '@/core/api/endpoints';
import type { BacktestEquityPoint, SharedBacktestRun } from '../../types';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

const EquityChart = dynamic(() => import('../../EquityChart'), { ssr: false });
const MonteCarloChart = dynamic(() => import('../../MonteCarloChart'), { ssr: false });

// ---- local formatters (kept self-contained for the public page) ----------
function fmtPct(v: number | null | undefined, d = 2): string {
  return v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(d)}%`;
}
function fmtCurrency(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v)
    ? '—'
    : v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
function fmtNum(v: number | null | undefined, d = 2): string {
  return v == null || !Number.isFinite(v) ? '—' : v.toFixed(d);
}
function pnlColor(v: number | null | undefined): string {
  if (v == null) return 'var(--color-text-primary)';
  if (v > 0) return 'var(--color-bull)';
  if (v < 0) return 'var(--color-bear)';
  return 'var(--color-text-secondary)';
}

function Tile({ label, value, color, hint }: { label: string; value: string; color?: string; hint?: string }) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)' }}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">{label}</div>
      <div
        className="mt-1 text-lg font-bold font-mono"
        style={{ color: color ?? 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">{hint}</div> : null}
    </div>
  );
}

function regimeLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  kind: 'gamma' | 'msi',
  regime: string,
): string {
  if (kind === 'gamma') {
    if (regime === 'positive') return t('regimePositive');
    if (regime === 'negative') return t('regimeNegative');
    if (regime === 'flat') return t('regimeFlat');
    return t('regimeUnknown');
  }
  return regime === 'unknown' ? t('regimeUnknown') : regime.replace(/_/g, ' ');
}

export default function SharedBacktestReport() {
  const t = usePageT(dict);
  const params = useParams();
  const token = String(params?.token ?? '');
  const [run, setRun] = useState<SharedBacktestRun | null>(null);
  const [equity, setEquity] = useState<BacktestEquityPoint[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([backtestAPI.getSharedRun(token), backtestAPI.getSharedEquity(token).catch(() => [])])
      .then(([r, eq]) => {
        if (cancelled) return;
        setRun(r);
        setEquity(eq);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === 'loading') {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-[var(--color-text-secondary)]">
        {t('loading')}
      </div>
    );
  }
  if (state === 'error' || !run) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">{t('reportNotFoundTitle')}</h1>
        <p className="text-[var(--color-text-secondary)]">
          {t('reportNotFoundBody')}
        </p>
        <Link href="/pricing" className="mt-6 inline-block text-[var(--color-accent)] underline">
          {t('exploreLink')}
        </Link>
      </div>
    );
  }

  const s = run.summary;
  const mc = s.monte_carlo;
  const bench = s.benchmark;
  const gamma = s.by_regime?.gamma ?? [];
  const msi = s.by_regime?.msi ?? [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)] font-semibold">
          ZeroGEX · {t('backtestReportLabel')}
        </span>
      </div>
      <h1 className="text-2xl md:text-3xl font-bold" style={{ textWrap: 'balance' }}>
        {run.strategy_label}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        {run.underlying} · {run.start_date} → {run.end_date} · {t('summarySuffix')}
      </p>

      {/* Headline stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <Tile label={t('totalReturn')} value={fmtPct(s.total_return_pct)} color={pnlColor(s.total_return_pct)} />
        <Tile label={t('winRate')} value={s.win_rate != null ? fmtPct(s.win_rate * 100, 0) : '—'} />
        <Tile label={t('profitFactor')} value={fmtNum(s.profit_factor)} />
        <Tile label={t('maxDrawdown')} value={fmtPct(s.max_drawdown_pct)} color="var(--color-bear)" />
        <Tile label="Sharpe" value={fmtNum(s.sharpe)} />
        <Tile label="Sortino" value={fmtNum(s.sortino)} />
        <Tile label={t('expectancyPerTrade')} value={fmtCurrency(s.expectancy)} color={pnlColor(s.expectancy)} />
        <Tile label={t('numTrades')} value={String(s.n_trades)} />
      </section>

      {/* Benchmark */}
      {bench ? (
        <div
          className="mt-4 rounded-lg border p-3 text-sm flex flex-wrap items-center gap-x-6 gap-y-1"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span className="text-[var(--color-text-secondary)]">{t('vsBuyHold')}</span>
          <span>
            {t('strategyLabel')}{' '}
            <b className="font-mono" style={{ color: pnlColor(s.total_return_pct) }}>
              {fmtPct(s.total_return_pct)}
            </b>
          </span>
          <span>
            {t('buyHoldLabel', { underlying: bench.underlying })}{' '}
            <b className="font-mono" style={{ color: pnlColor(bench.buy_hold_return_pct) }}>
              {fmtPct(bench.buy_hold_return_pct)}
            </b>
          </span>
        </div>
      ) : null}

      {/* Equity curve */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold mb-2">{t('equityCurveHeading')}</h2>
        <EquityChart equity={equity} startingCapital={run.capital ?? 25000} />
      </section>

      {/* Monte Carlo */}
      {mc ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-1">{t('monteCarloHeading')}</h2>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3">
            {t('monteCarloSubtitle', { iterations: mc.iterations.toLocaleString() })}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Tile label={t('probProfitable')} value={fmtPct(mc.prob_profit * 100, 0)} />
            <Tile
              label={t('riskOfRuin')}
              value={fmtPct(mc.risk_of_ruin_50pct * 100, 1)}
              color={mc.risk_of_ruin_50pct > 0 ? 'var(--color-bear)' : undefined}
              hint={t('riskOfRuinHint')}
            />
            <Tile label={t('medianReturn')} value={fmtPct(mc.terminal_return_pct.p50)} color={pnlColor(mc.terminal_return_pct.p50)} />
            <Tile label={t('rangeLabel')} value={`${fmtPct(mc.terminal_return_pct.p5)} … ${fmtPct(mc.terminal_return_pct.p95)}`} />
          </div>
          <MonteCarloChart cone={mc.cone} startingCapital={run.capital ?? 25000} />
        </section>
      ) : null}

      {/* Regime split */}
      {gamma.length > 0 || msi.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-1">{t('byRegimeHeading')}</h2>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3">
            {t('byRegimeSubtitle')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(
              [
                ['gamma', t('gammaRegimeTitle'), gamma],
                ['msi', t('msiRegimeTitle'), msi],
              ] as const
            ).map(([kind, title, rows]) =>
              rows.length ? (
                <div key={kind}>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)] mb-2">
                    {title}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr
                        className="text-[var(--color-text-secondary)] text-left border-b"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <th className="py-1.5 pr-3 font-medium">{t('regimeCol')}</th>
                        <th className="py-1.5 pr-3 font-medium text-right">{t('tradesCol')}</th>
                        <th className="py-1.5 pr-3 font-medium text-right">{t('winPctCol')}</th>
                        <th className="py-1.5 font-medium text-right">{t('netPnlCol')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.regime} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                          <td className="py-1.5 pr-3">{regimeLabel(t, kind, r.regime)}</td>
                          <td className="py-1.5 pr-3 text-right font-mono">{r.n}</td>
                          <td className="py-1.5 pr-3 text-right font-mono">
                            {r.win_rate != null ? fmtPct(r.win_rate * 100, 0) : '—'}
                          </td>
                          <td className="py-1.5 text-right font-mono" style={{ color: pnlColor(r.net_pnl) }}>
                            {fmtCurrency(r.net_pnl)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null,
            )}
          </div>
        </section>
      ) : null}

      {/* CTA + disclaimer */}
      <section
        className="mt-10 rounded-xl border p-6 text-center"
        style={{
          borderColor: 'var(--color-accent)',
          background:
            'radial-gradient(120% 140% at 0 0, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent 60%)',
        }}
      >
        <h2 className="text-xl font-bold">{t('ctaHeading')}</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {t('ctaBody')}
        </p>
        <Link
          href="/pricing?trial=1&plan=pro"
          className="mt-4 inline-flex items-center rounded-md px-5 py-2.5 text-sm font-semibold"
          style={{ background: 'var(--color-accent)', color: 'var(--color-bg, #000)' }}
        >
          {t('ctaButton')}
        </Link>
      </section>

      <p className="mt-6 text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
        {t('disclaimer')}
      </p>
    </div>
  );
}
