'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { useForcedFlowCharmDecay } from '@/hooks/useApiData';

interface CharmIntoCloseChartProps {
  symbol?: string;
}

// Compact signed-USD formatter ($1.2B / $340M / $12K). Local per the repo's
// per-chart convention (no shared money util in core/).
function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return '--';
  if (value === 0) return '$0';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

interface CharmTooltipRow {
  days_elapsed: number;
  flow: number;
}

function CharmTooltip({
  active,
  payload,
  sessionDays,
  bg,
  border,
  text,
  flowColor,
}: {
  active?: boolean;
  payload?: Array<{ payload?: CharmTooltipRow }>;
  sessionDays: number;
  bg: string;
  border: string;
  text: string;
  flowColor: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const remaining = Math.max(0, sessionDays - row.days_elapsed);
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: '8px 12px',
        color: text,
        fontSize: 12,
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{remaining.toFixed(2)}d to close</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px' }}>
        <span style={{ color: flowColor }}>Cumulative flow</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontWeight: 600 }}>
          {formatCompactUsd(row.flow)}
        </span>
      </div>
    </div>
  );
}

export default function CharmIntoCloseChart({ symbol = 'SPY' }: CharmIntoCloseChartProps) {
  const chart = useChartTheme();
  const { data, loading, error } = useForcedFlowCharmDecay(symbol, 15000);

  const curve = data?.curve ?? [];
  const hasData = curve.length > 0;
  const sessionDays = data?.session_days ?? 1;
  const closeFlow = data?.close_flow_usd ?? 0;

  // Buy vs sell colours the whole story: positive close flow = forced buying.
  const flowColor = closeFlow >= 0 ? chart.bull : chart.bear;
  const direction = closeFlow >= 0 ? 'buy' : 'sell';

  const textColor = 'var(--text-primary)';

  return (
    <div
      className="rounded-2xl p-6"
      style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${'var(--text-secondary)'}` }}
    >
      <div className="mb-1 flex items-baseline gap-2 flex-wrap">
        <h3 className="zg-h3" style={{ color: textColor }}>
          Charm Into the Close
        </h3>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {symbol}
        </span>
      </div>

      {/* Headline number — the whole point of the chart. */}
      {hasData && (
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          If {symbol} sits here, time decay alone forces dealers to{' '}
          <span className="font-bold" style={{ color: flowColor }}>
            {direction} {formatCompactUsd(Math.abs(closeFlow))}
          </span>{' '}
          by the close.
        </p>
      )}

      {error ? (
        <div className="flex items-center justify-center h-[300px] text-sm" style={{ color: chart.bear }}>
          {error === 'No data available yet'
            ? `No charm-decay snapshot for ${symbol} yet.`
            : `Failed to load charm decay: ${error}`}
        </div>
      ) : loading && !data ? (
        <div className="flex items-center justify-center h-[300px] text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading charm decay…
        </div>
      ) : !hasData ? (
        <div className="flex items-center justify-center h-[300px] text-sm" style={{ color: 'var(--text-secondary)' }}>
          No charm-decay data available.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={curve} margin={{ top: 16, right: 20, left: 16, bottom: 8 }}>
              <defs>
                <linearGradient id="charmIntoCloseFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={flowColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={flowColor} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.gridLine} opacity={0.6} />
              <XAxis
                dataKey="days_elapsed"
                type="number"
                domain={[0, sessionDays]}
                stroke={chart.axisText}
                tick={{ fontSize: 11, fill: chart.axisText }}
                tickFormatter={(v) => {
                  const remaining = Math.max(0, sessionDays - Number(v));
                  return remaining <= 0.001 ? 'close' : `${remaining.toFixed(1)}d`;
                }}
                label={{
                  value: 'Time to close →',
                  position: 'insideBottom',
                  offset: -4,
                  fill: chart.axisText,
                  fontSize: 11,
                }}
              />
              <YAxis
                stroke={chart.axisText}
                width={72}
                tick={{ fontSize: 11, fill: chart.axisText }}
                tickFormatter={(v) => formatCompactUsd(Number(v))}
                label={{
                  value: 'Cumulative flow ($)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 8,
                  style: { fill: chart.axisText, fontSize: 11, textAnchor: 'middle' },
                }}
              />
              <Tooltip
                content={
                  <CharmTooltip
                    sessionDays={sessionDays}
                    bg={chart.tooltipBg}
                    border={chart.tooltipBorder}
                    text={chart.tooltipText}
                    flowColor={flowColor}
                  />
                }
              />
              <ReferenceLine y={0} stroke={chart.text} opacity={0.4} />
              <Area
                type="monotone"
                dataKey="flow"
                name="Cumulative charm flow"
                stroke={flowColor}
                strokeWidth={2.25}
                fill="url(#charmIntoCloseFill)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>

          {data?.timestamp && (
            <div className="mt-3 text-right text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Snapshot {new Date(data.timestamp).toLocaleTimeString()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
