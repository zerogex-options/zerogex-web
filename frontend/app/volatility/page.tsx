'use client';

import PageShell from '@/components/layout/PageShell';
import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApiData } from '@/hooks/useApiData';
import { useMarketHistorical } from '@/hooks/useMarketHistorical';
import { useTimeframe } from '@/core/TimeframeContext';
import TooltipWrapper from '@/components/TooltipWrapper';
import MobileScrollableChart from '@/components/MobileScrollableChart';

// ---- /api/gex/vol_surface response (per-strike call & put IV, ATM term structure) ----
interface IvPoint { strike?: number | null; call_iv?: number | null; put_iv?: number | null; }
interface SurfaceEntry { dte?: number | null; expiration?: string; ivs?: IvPoint[]; }
interface AtmTermPoint { dte?: number | null; atm_iv?: number | null; }
interface VolSurfaceResponse {
  symbol?: string;
  surface?: SurfaceEntry[];
  atm_term_structure?: AtmTermPoint[];
}

const TRADING_DAYS = 252;

// Chain IVs come back as fractions (0.14 = 14%). Guard against a feed that
// sends whole percents (14) by scaling anything clearly > 1 down. Returns a
// fraction, or null.
function ivFraction(v: number | null | undefined): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1 ? n / 100 : n;
}
const toPct = (frac: number | null): number | null => (frac == null ? null : frac * 100);

interface SkewRow { strike: number; callIv: number | null; putIv: number | null; }
interface RvRow { date: string; rv10: number | null; rv20: number | null; }

// Rolling annualized realized vol (%) from daily closes: stdev of daily log
// returns over `window` sessions, × √252, × 100. Keeps the last 60 points.
function realizedVolSeries(bars: { timestamp: string; close?: number; price?: number }[]): RvRow[] {
  const closes = bars
    .map((b) => ({ t: b.timestamp, c: Number(b.close ?? b.price) }))
    .filter((x) => Number.isFinite(x.c) && x.c > 0);
  if (closes.length < 12) return [];
  const rets: { t: string; r: number }[] = [];
  for (let i = 1; i < closes.length; i++) {
    rets.push({ t: closes[i].t, r: Math.log(closes[i].c / closes[i - 1].c) });
  }
  const roll = (end: number, win: number): number | null => {
    if (end + 1 < win) return null;
    const slice = rets.slice(end - win + 1, end + 1).map((x) => x.r);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (slice.length - 1);
    return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS) * 100;
  };
  const out: RvRow[] = [];
  for (let i = 0; i < rets.length; i++) {
    const rv10 = roll(i, 10);
    const rv20 = roll(i, 20);
    if (rv10 == null && rv20 == null) continue;
    const d = new Date(rets[i].t);
    const date = Number.isNaN(d.getTime())
      ? rets[i].t
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    out.push({ date, rv10, rv20 });
  }
  return out.slice(-60);
}

const fmtPct = (v: unknown): string => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : '--';
};

export default function VolatilityPage() {
  const { symbol } = useTimeframe();
  const axisStroke = 'var(--color-text-secondary)';
  const textColor = 'var(--text-primary)';

  const { data: vsData, loading: vsLoading, error: vsError } = useApiData<VolSurfaceResponse>(
    `/api/gex/vol_surface?symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}`,
    { refreshInterval: 30000 },
  );
  const { rows: dailyBars } = useMarketHistorical(symbol, '1day');

  const tenors = useMemo(
    () =>
      (vsData?.surface ?? [])
        .map((e) => Number(e.dte))
        .filter((d) => Number.isFinite(d))
        .sort((a, b) => a - b),
    [vsData],
  );
  const [selectedDte, setSelectedDte] = useState<number | null>(null);
  const activeDte = selectedDte != null && tenors.includes(selectedDte) ? selectedDte : (tenors[0] ?? null);

  const skew = useMemo<SkewRow[]>(() => {
    const entry = (vsData?.surface ?? []).find((e) => Number(e.dte) === activeDte);
    if (!entry?.ivs) return [];
    return entry.ivs
      .map((p) => ({
        strike: Number(p.strike),
        callIv: toPct(ivFraction(p.call_iv)),
        putIv: toPct(ivFraction(p.put_iv)),
      }))
      .filter((p) => Number.isFinite(p.strike) && (p.callIv != null || p.putIv != null))
      .sort((a, b) => a.strike - b.strike);
  }, [vsData, activeDte]);

  // Current chain implied-vol reference: ATM IV nearest 30 DTE.
  const impliedAtm = useMemo(() => {
    const ts = (vsData?.atm_term_structure ?? []).filter((p) => Number.isFinite(Number(p.dte)));
    if (ts.length === 0) return null;
    let best = ts[0];
    let bestDist = Math.abs(Number(ts[0].dte) - 30);
    for (const p of ts) {
      const dist = Math.abs(Number(p.dte) - 30);
      if (dist < bestDist) { best = p; bestDist = dist; }
    }
    const iv = toPct(ivFraction(best.atm_iv));
    return iv != null ? { dte: Number(best.dte), iv } : null;
  }, [vsData]);

  const rv = useMemo(() => realizedVolSeries(dailyBars), [dailyBars]);

  // ATM skew read (put − call IV near the money) for the active tenor's callout.
  // vol_surface returns strikes centered on spot, so the median strike ≈ ATM.
  const atmSkew = useMemo(() => {
    if (skew.length === 0) return null;
    const mid = skew[Math.floor(skew.length / 2)];
    if (mid.callIv == null || mid.putIv == null) return null;
    return mid.putIv - mid.callIv;
  }, [skew]);

  const cardStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' } as const;

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-2">Volatility</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
        Put vs. call implied-volatility skew across strikes, and realized volatility against the chain&apos;s current implied vol — for {symbol}.
      </p>

      {/* Panel A — Put vs Call IV skew */}
      <section className="mb-8 rounded-2xl p-6" style={cardStyle}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h3 className="zg-h3" style={{ color: textColor }}>Put vs Call IV — Skew</h3>
          <TooltipWrapper text="Implied volatility of calls vs puts at each strike for the selected expiration. Puts trading above calls (a downside skew) is the market pricing more fear of a drop; calls above puts is upside / right-tail demand.">
            <Info size={14} />
          </TooltipWrapper>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {tenors.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDte(d)}
                className="px-2.5 py-1 text-xs rounded border"
                style={
                  d === activeDte
                    ? { borderColor: 'var(--color-info)', background: 'var(--color-info-soft)', color: textColor }
                    : { borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }
                }
              >
                {d}DTE
              </button>
            ))}
          </div>
        </div>

        {atmSkew != null && (
          <div className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            ATM skew (put − call IV):{' '}
            <span style={{ color: atmSkew >= 0 ? 'var(--color-bear)' : 'var(--color-bull)', fontWeight: 600 }}>
              {atmSkew >= 0 ? '+' : ''}{atmSkew.toFixed(1)} pts
            </span>{' '}
            — {atmSkew >= 0 ? 'downside fear priced richer' : 'upside demand priced richer'}
          </div>
        )}

        {vsError ? (
          <div className="h-[320px] flex items-center justify-center text-sm text-[var(--color-bear)]">{vsError}</div>
        ) : vsLoading && skew.length === 0 ? (
          <div className="h-[320px] flex items-center justify-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading vol surface…</div>
        ) : skew.length === 0 ? (
          <div className="h-[320px] flex items-center justify-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>No IV data available for this expiration.</div>
        ) : (
          <MobileScrollableChart>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={skew} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--color-grid-line)" />
                <XAxis dataKey="strike" type="number" domain={['dataMin', 'dataMax']} stroke={axisStroke} tick={{ fontSize: 10, fill: axisStroke }} tickMargin={8} />
                <YAxis stroke={axisStroke} tick={{ fontSize: 10, fill: axisStroke }} width={48} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', borderRadius: 8, color: 'var(--color-chart-tooltip-text)' }}
                  formatter={(value, name) => [fmtPct(value), String(name)]}
                  labelFormatter={(l) => `Strike ${l}`}
                />
                <Legend />
                <Line type="monotone" dataKey="callIv" name="Call IV" stroke="var(--color-bull)" strokeWidth={2.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="putIv" name="Put IV" stroke="var(--color-bear)" strokeWidth={2.5} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </MobileScrollableChart>
        )}
      </section>

      {/* Panel B — Realized vs Implied */}
      <section className="mb-8 rounded-2xl p-6" style={cardStyle}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h3 className="zg-h3" style={{ color: textColor }}>Realized vs Implied Volatility</h3>
          <TooltipWrapper text="Realized volatility is the annualized standard deviation of daily log returns over a rolling 10- and 20-session window. The dashed line is the chain's current at-the-money implied vol (~30D). Realized running below implied = options are 'expensive' (net-seller friendly); realized above implied = 'cheap' (net-buyer friendly).">
            <Info size={14} />
          </TooltipWrapper>
          {impliedAtm != null && (
            <span className="ml-auto text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Implied ATM (~{impliedAtm.dte}D): <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>{impliedAtm.iv.toFixed(1)}%</span>
            </span>
          )}
        </div>

        {rv.length === 0 ? (
          <div className="h-[320px] flex items-center justify-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading realized-vol history…</div>
        ) : (
          <MobileScrollableChart>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={rv} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--color-grid-line)" />
                <XAxis dataKey="date" stroke={axisStroke} tick={{ fontSize: 10, fill: axisStroke }} tickMargin={8} minTickGap={24} />
                <YAxis stroke={axisStroke} tick={{ fontSize: 10, fill: axisStroke }} width={48} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', borderRadius: 8, color: 'var(--color-chart-tooltip-text)' }}
                  formatter={(value, name) => [fmtPct(value), String(name)]}
                />
                <Legend />
                {impliedAtm != null && (
                  <ReferenceLine
                    y={impliedAtm.iv}
                    stroke="var(--color-gold)"
                    strokeDasharray="6 4"
                    strokeWidth={2}
                    label={{ value: `Implied ~${impliedAtm.dte}D`, position: 'insideTopRight', fill: 'var(--color-gold)', fontSize: 10 }}
                  />
                )}
                <Line type="monotone" dataKey="rv10" name="Realized 10D" stroke="var(--regime-trend)" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="rv20" name="Realized 20D" stroke="var(--regime-reversal)" strokeWidth={2.5} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </MobileScrollableChart>
        )}
        <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
          Realized vol is computed from daily closes; the implied reference is the chain&apos;s current ~30-day ATM IV. A full historical implied-vol line is a small backend follow-up — the daily ATM-IV series already exists in the database.
        </p>
      </section>
    </PageShell>
  );
}
