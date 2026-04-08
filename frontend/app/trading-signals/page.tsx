'use client';

import { useMemo } from 'react';
import { Activity, ArrowDown, ArrowUp, Brain, Gauge, ShieldCheck, Sparkles } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTradesLive } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import { useTheme } from '@/core/ThemeContext';

type TradeRow = Record<string, unknown>;

function toRows(data: unknown): TradeRow[] {
  if (Array.isArray(data)) return data as TradeRow[];
  if (data && typeof data === 'object') {
    const values = Object.values(data as Record<string, unknown>);
    const firstArray = values.find((value) => Array.isArray(value));
    if (Array.isArray(firstArray)) return firstArray as TradeRow[];
  }
  return [];
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getString(value: unknown): string {
  if (value == null) return '—';
  return String(value);
}

function formatMoney(value: number | null) {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPnl(value: number | null) {
  if (value == null) return '—';
  const formatted = formatMoney(value);
  if (value > 0) return `+${formatted}`;
  return formatted;
}

function formatOpenedAt(value: unknown): string {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return getString(value);
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' '
    + parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/New_York' })
    + ' ET';
}


export default function TradingSignalsPage() {
  const { symbol } = useTimeframe();
  const { theme } = useTheme();
  const { data, loading, error, refetch } = useTradesLive(symbol, 5000);

  const rows = useMemo(() => toRows(data), [data]);

  const analytics = useMemo(() => {
    const netPremium = rows.reduce((sum, row) => sum + (getNumber(row.net_premium ?? row.premium ?? row.total_pnl) ?? 0), 0);
    const netVolume = rows.reduce((sum, row) => sum + (getNumber(row.net_volume ?? row.flow ?? row.quantity_initial ?? row.quantity_open) ?? 0), 0);
    const bullishCount = rows.filter((row) => getString(row.flow_bias ?? row.trade_side ?? row.direction).toLowerCase().includes('bull')).length;
    const bearishCount = rows.filter((row) => getString(row.flow_bias ?? row.trade_side ?? row.direction).toLowerCase().includes('bear')).length;

    return { netPremium, netVolume, bullishCount, bearishCount };
  }, [rows]);

  if (loading && !data) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Trade Ideas</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        All trades are hypothetical — the engine observes live market data but does not connect to a broker. Everything is recorded as if executed at mid-mark with no slippage or commissions.
      </p>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Live Signals" value={rows.length} tooltip="Current number of live rows feeding the model." theme="dark" />
        <MetricCard
          title="Net Premium"
          value={formatMoney(analytics.netPremium)}
          trend={analytics.netPremium > 0 ? 'bullish' : analytics.netPremium < 0 ? 'bearish' : 'neutral'}
          tooltip="Aggregate premium pressure across live signal rows."
          theme="dark"
          icon={<Sparkles size={16} />}
        />
        <MetricCard
          title="Net Flow"
          value={Math.round(analytics.netVolume).toLocaleString()}
          trend={analytics.netVolume > 0 ? 'bullish' : analytics.netVolume < 0 ? 'bearish' : 'neutral'}
          tooltip="Net signed flow from live trade rows."
          theme="dark"
          icon={<Activity size={16} />}
        />
        <MetricCard
          title="Bull vs Bear"
          value={`${analytics.bullishCount}/${analytics.bearishCount}`}
          tooltip="Row count split between bullish and bearish directional tags."
          theme="dark"
          icon={<Gauge size={16} />}
        />
      </section>

      <section className="zg-feature-shell overflow-x-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Live Trade Stream</h2>
          <div className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1"><ShieldCheck size={14} /> Updated every few seconds</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[var(--color-border)]">
              <th className="py-2 pr-3">Symbol</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Expiry</th>
              <th className="py-2 pr-3">Strike</th>
              <th className="py-2 pr-3">Opened At</th>
              <th className="py-2 pr-3 text-right">Contracts Open</th>
              <th className="py-2 pr-3 text-right">Realized PnL</th>
              <th className="py-2 pr-3 text-right">Unrealized PnL</th>
              <th className="py-2 pr-3 text-right">Entry Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 60).map((row, idx) => {
              const direction = getString(row.direction).toLowerCase();
              const isBullish = direction.includes('bull');
              const isBearish = direction.includes('bear');
              const scoreColor = isBullish ? 'var(--color-bull)' : isBearish ? 'var(--color-bear)' : 'var(--color-text-primary)';
              const entryScore = getNumber(row.score_at_entry);
              const realizedPnl = getNumber(row.realized_pnl);
              const unrealizedPnl = getNumber(row.unrealized_pnl);
              const optionType = getString(row.option_type);
              const strike = getNumber(row.strike);

              return (
                <tr key={idx} className="border-b border-[var(--color-border)]/45">
                  <td className="py-2 pr-3 font-medium">{getString(row.underlying)}</td>
                  <td className="py-2 pr-3">{optionType === 'C' ? 'Call' : optionType === 'P' ? 'Put' : optionType}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{getString(row.expiration)}</td>
                  <td className="py-2 pr-3">{strike != null ? `$${strike.toFixed(2)}` : '—'}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatOpenedAt(row.opened_at)}</td>
                  <td className="py-2 pr-3 text-right">{getString(row.quantity_open)}</td>
                  <td className="py-2 pr-3 text-right" style={{ color: realizedPnl != null ? (realizedPnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)') : undefined }}>
                    {formatPnl(realizedPnl)}
                  </td>
                  <td className="py-2 pr-3 text-right" style={{ color: unrealizedPnl != null ? (unrealizedPnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)') : undefined }}>
                    {formatPnl(unrealizedPnl)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <span className="inline-flex items-center gap-1" style={{ color: scoreColor }}>
                      {isBullish && <ArrowUp size={14} />}
                      {isBearish && <ArrowDown size={14} />}
                      {entryScore != null ? entryScore.toFixed(4) : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-[var(--color-text-secondary)]">
                  No live trade rows available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* UnifiedSignalEngine Reference */}
      <section className="zg-feature-shell mb-8 p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><Gauge size={20} /> Signal Engine Reference</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          The composite score (−100 to +100) is the weighted sum of 7 components. Positive = net bullish, negative = net bearish. The normalized score (absolute value, 0–100) represents conviction strength and drives position sizing.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <div className="font-semibold mb-3">Signal Components</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                  <th className="pb-1.5">Component</th>
                  <th className="pb-1.5">Weight</th>
                  <th className="pb-1.5">Driver</th>
                </tr>
              </thead>
              <tbody className="text-[var(--color-text-secondary)]">
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">GEX Regime</td><td>18%</td><td>+GEX = suppression (+1), −GEX = amplification (−1)</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Smart Money</td><td>16%</td><td>Premium-weighted call vs put from large/unusual orders</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Vol Expansion</td><td>16%</td><td>Dealer feedback loop amplification readiness</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Opportunity Quality</td><td>16%</td><td>Risk/reward quality of available options structures</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Gamma Flip</td><td>12%</td><td>Above flip = +1, below = −1, ±0.3% = 0</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Exhaustion</td><td>12%</td><td>Countertrend signal at RSI/momentum extremes</td></tr>
                <tr><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Put/Call Ratio</td><td>10%</td><td>PCR ≤ 0.8 = bullish (+1), ≥ 1.2 = bearish (−1)</td></tr>
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <div className="font-semibold mb-3">Composite Score Zones</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                  <th className="pb-1.5">Range</th>
                  <th className="pb-1.5">Action</th>
                </tr>
              </thead>
              <tbody className="text-[var(--color-text-secondary)]">
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5"><span className="text-[var(--color-bull)] font-medium">+80 to +100</span></td><td>High conviction — strong alignment</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5"><span className="text-[var(--color-bull)] opacity-70 font-medium">+58 to +80</span></td><td>Tradeable bullish signal</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5"><span className="text-[var(--color-warning)] font-medium">−30 to +30</span></td><td>Near-neutral — no trade</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5"><span className="text-[var(--color-bear)] opacity-70 font-medium">−80 to −58</span></td><td>Tradeable bearish signal</td></tr>
                <tr><td className="py-1.5"><span className="text-[var(--color-bear)] font-medium">−100 to −80</span></td><td>High conviction — strong alignment</td></tr>
              </tbody>
            </table>
            <div className="mt-3 pt-2 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)]">
              <strong>Dynamic trigger:</strong> baseline 58; raised to 72 when IV rank &gt; 0.70, lowered to 52 when IV rank &lt; 0.25.
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <div className="font-semibold mb-3">Conviction & Strength</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                  <th className="pb-1.5">|Score|</th>
                  <th className="pb-1.5">Strength</th>
                  <th className="pb-1.5">Meaning</th>
                </tr>
              </thead>
              <tbody className="text-[var(--color-text-secondary)]">
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">≥ 80</td><td className="text-[var(--color-bull)]">High</td><td>Strong alignment across most components</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">58 – 80</td><td className="text-[var(--color-warning)]">Medium</td><td>Above trigger, multiple components agree</td></tr>
                <tr><td className="py-1.5 font-medium text-[var(--color-text-primary)]">&lt; 58</td><td className="text-[var(--color-bear)]">Low</td><td>Below trigger or mixed signals</td></tr>
              </tbody>
            </table>
            <div className="mt-3 pt-2 border-t border-[var(--color-border)]">
              <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">In Practice</div>
              <ul className="text-[11px] text-[var(--color-text-secondary)] space-y-1">
                <li>• <strong>85+</strong>: Rare high-conviction — position sizing at ~85% of optimizer max.</li>
                <li>• <strong>65–85</strong>: Clean — open position sized proportionally to score.</li>
                <li>• <strong>58–65</strong>: Marginal — needs +EV structure from optimizer.</li>
                <li>• <strong>30–58</strong>: Below trigger — mixed signals, no trade.</li>
                <li>• <strong>&lt; 30</strong>: Near-neutral — components cancel out, no trade.</li>
                <li>• <strong>Direction reversal</strong>: Close existing, open opposite if conditions pass.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Trade Execution Reference */}
      <section className="zg-feature-shell mb-8 p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><Brain size={20} /> Trade Execution Logic</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          All five conditions must be true simultaneously to open a position. There are no fixed stop-losses or take-profits — positions close when the signal degrades.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <div className="font-semibold mb-3">Conditions to Open</div>
            <ul className="text-xs text-[var(--color-text-secondary)] space-y-2">
              <li>• <strong>Normalized score ≥ threshold</strong> (default 58, raised to 72 in high IV, lowered to 52 in low IV)</li>
              <li>• <strong>Trend confirmation</strong> — at least 2 of the last 4 non-neutral scores agree with current direction</li>
              <li>• <strong>Valid options structure</strong> — optimizer finds positive-EV candidate in the appropriate DTE window</li>
              <li>• <strong>Portfolio heat headroom</strong> — new position won&apos;t exceed max heat %</li>
              <li>• <strong>Open trade count headroom</strong> — below max open trades limit</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <div className="font-semibold mb-3">Conditions to Close</div>
            <ul className="text-xs text-[var(--color-text-secondary)] space-y-2">
              <li>• <strong>Score drops below threshold</strong> → all positions closed, move to cash</li>
              <li>• <strong>Direction reverses</strong> → existing closed, new position opened in opposite direction</li>
              <li>• <strong>Position size target decreases</strong> → oldest trades closed first to reach new target</li>
              <li>• <strong>No positive-EV structure</strong> for held direction → full liquidation</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <div className="font-semibold mb-3">Position Sizing</div>
            <ul className="text-xs text-[var(--color-text-secondary)] space-y-2">
              <li>• Contracts = <strong>int(optimal_contracts × normalized_score)</strong>, min 1</li>
              <li>• A score of 85 opens ~85% of the optimizer&apos;s suggested contracts</li>
              <li>• A score of 58 opens ~58% — higher conviction = larger position</li>
              <li>• DTE window adapts: high IV (&gt; 0.70) uses 0–2 DTE, normal/low IV uses 1–7 DTE</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
