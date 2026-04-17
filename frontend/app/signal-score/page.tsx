'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { Gauge, Info, LineChart as LineChartIcon } from 'lucide-react';
import SignalScorePanel from '@/components/SignalScorePanel';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import TooltipWrapper from '@/components/TooltipWrapper';
import { useTimeframe } from '@/core/TimeframeContext';
import { useSignalScoreHistory } from '@/hooks/useApiData';
import { useTheme } from '@/core/ThemeContext';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';

function formatTime(value: unknown) {
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
}

export default function SignalScorePage() {
  const { symbol } = useTimeframe();
  const { theme } = useTheme();
  const { data: historyData, loading: historyLoading, error: historyError } = useSignalScoreHistory(symbol, PROPRIETARY_SIGNALS_REFRESH.compositeHistoryMs);

  const chartData = useMemo(() => {
    const payload = historyData as unknown as Record<string, unknown> | null;
    const nestedData = payload?.data as Record<string, unknown> | unknown[] | undefined;
    const rows = Array.isArray(historyData)
      ? historyData
      : Array.isArray(payload?.rows)
        ? payload.rows
        : Array.isArray(payload?.history)
          ? payload.history
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(nestedData)
              ? nestedData
              : Array.isArray((nestedData as Record<string, unknown> | undefined)?.rows)
                ? (nestedData as Record<string, unknown>).rows as unknown[]
                : Array.isArray((nestedData as Record<string, unknown> | undefined)?.history)
                  ? (nestedData as Record<string, unknown>).history as unknown[]
                  : [];
    if (!Array.isArray(rows)) return [];
    return [...rows]
      .reverse()
      .map((pt: Record<string, unknown>) => ({
        time: String(pt.timestamp ?? pt.time ?? pt.ts ?? pt.datetime ?? ''),
        score: Number(pt.composite_score ?? pt.score ?? pt.normalized_score ?? 0),
      }))
      .filter((pt) => pt.time && Number.isFinite(pt.score));
  }, [historyData]);

  const cardBg = theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <h1 className="text-3xl font-bold">Composite Score</h1>
        <TooltipWrapper text="Aggregate weighted conviction of eight independent market signals. Positive = net bullish, negative = net bearish." placement="bottom">
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      <SignalScorePanel symbol={symbol} />

      {/* Signal Engine Reference */}
      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Gauge size={20} />
          Signal Engine Reference
          <TooltipWrapper text="The composite score (−100 to +100) is the weighted sum of 15 components. Positive = net bullish, negative = net bearish. The normalized score (absolute value, 0–100) represents conviction strength and drives position sizing." placement="bottom">
            <Info size={14} className="text-[var(--color-text-secondary)] cursor-help" />
          </TooltipWrapper>
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm items-stretch">
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: cardBg }}>
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
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">GEX Regime</td><td>7%</td><td>Book-level gamma sign/magnitude regime</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Gamma Flip</td><td>5%</td><td>Spot distance from gamma flip transition line</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Dealer Regime</td><td>8%</td><td>Composite dealer posture alignment (DRS)</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">GEX Gradient</td><td>8%</td><td>Strike-level gamma asymmetry around spot</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Dealer Delta Pressure</td><td>8%</td><td>Dealer net delta hedge pressure estimate</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Vanna Charm Flow</td><td>7%</td><td>Second-order greek re-hedging pressure</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Smart Money</td><td>9%</td><td>Large/aggressive premium imbalance read</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Tape Flow Bias</td><td>8%</td><td>Continuous call-vs-put tape pressure</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Put/Call Ratio</td><td>5%</td><td>Sentiment/crowding read from PCR</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Skew Delta</td><td>4%</td><td>OTM put-call IV skew differential</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Vol Expansion</td><td>8%</td><td>Regime readiness × momentum direction</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Exhaustion</td><td>5%</td><td>Overextension / mean-reversion pressure</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Positioning Trap</td><td>6%</td><td>Crowding squeeze/flush trap detector</td></tr>
                <tr className="border-b border-[var(--color-border)]/30"><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Intraday Regime</td><td>5%</td><td>Time-of-day regime context multiplier</td></tr>
                <tr><td className="py-1.5 font-medium text-[var(--color-text-primary)]">Opportunity Quality</td><td>7%</td><td>Tradeability / structure quality from optimizer</td></tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: cardBg }}>
              <div className="font-semibold mb-3">How the Composite Is Built</div>
              <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
                <div><span className="font-medium text-[var(--color-text-primary)]">Raw:</span> Flat weighted average of all 15 components (dormant components count as zero).</div>
                <div><span className="font-medium text-[var(--color-text-primary)]">Renormalized:</span> Dormant components are dropped and active weights are rescaled.</div>
                <div><span className="font-medium text-[var(--color-text-primary)]">Agreement:</span> Multiplier shrinks split reads and boosts aligned reads.</div>
                <div><span className="font-medium text-[var(--color-text-primary)]">Extremity:</span> Adds a boost when the loudest component is near ±1.0.</div>
                <div className="pt-2 border-t border-[var(--color-border)]">
                  <span className="font-semibold text-[var(--color-text-primary)]">Final Composite = Raw → Renormalized × Agreement × Extremity.</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: cardBg }}>
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
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: cardBg }}>
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

      {/* Score History */}
      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <LineChartIcon size={20} />
          Score History
          <TooltipWrapper text="Composite score over time. Green shading = bullish, red = bearish." placement="bottom">
            <Info size={14} className="text-[var(--color-text-secondary)] cursor-help" />
          </TooltipWrapper>
        </h2>
        <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]" style={{ height: 320 }}>
          {chartData.length > 0 ? (
            <MobileScrollableChart>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatTime}
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
                  stroke="var(--color-border)"
                  minTickGap={40}
                />
                <YAxis
                  domain={[-100, 100]}
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
                  stroke="var(--color-border)"
                  width={40}
                />
                <Tooltip
                  contentStyle={{ background: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-chart-tooltip-text)' }}
                  labelFormatter={formatTime}
                  formatter={(value) => [Number(value).toFixed(2), 'Score']}
                />
                <ReferenceLine y={0} stroke="var(--color-text-secondary)" strokeOpacity={0.4} />
                <ReferenceLine y={58} stroke="var(--color-bull)" strokeDasharray="4 4" strokeOpacity={0.4} />
                <ReferenceLine y={-58} stroke="var(--color-bear)" strokeDasharray="4 4" strokeOpacity={0.4} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--color-warning)"
                  strokeWidth={2}
                  dot={chartData.length === 1 ? { r: 3, fill: 'var(--color-warning)', stroke: 'var(--color-warning)' } : false}
                  activeDot={{ r: 4, stroke: 'var(--color-warning)', fill: 'var(--color-surface)' }}
                />
              </LineChart>
            </ResponsiveContainer>
            </MobileScrollableChart>
          ) : historyError ? (
            <div className="flex flex-col items-center justify-center h-full text-sm text-[var(--color-text-secondary)] gap-1">
              <div>Unable to load score history.</div>
              <div className="text-xs opacity-80">{historyError}</div>
            </div>
          ) : historyLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-secondary)]">
              Loading score history…
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-secondary)]">
              No score history available.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
