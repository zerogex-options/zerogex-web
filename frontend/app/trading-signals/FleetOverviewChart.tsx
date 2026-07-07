'use client';

/**
 * Fleet Overview — the anchor visualization at the top of the dashboard.
 *
 * Overlays every bot's session-level cumulative return on a single line
 * chart, indexed to a common base (100 = starting NAV) so bots with
 * different capital sleeves are directly comparable. That's the dataviz
 * "one axis" rule: never two y-scales; index to a common base instead.
 *
 * Each bot's line is the color assigned in palette.ts and never changes
 * with leaderboard rank. The user's currently-selected bot (from the
 * roster / leaderboard click) is highlighted at 2.5px stroke while the
 * rest render at 1.5px — draws the eye to the drilldown target without
 * hiding the fleet context around it.
 */

import { Fragment, useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { botColor } from './palette';
import { fmtDate, fmtSignedPct } from './format';
import type { BotEquityBundle } from './types';

interface Props {
  bundles: BotEquityBundle[];
  selectedBotId: string | null;
  onSelect?: (botId: string) => void;
  height?: number;
}

interface ChartPoint {
  session_date: string;
  [botId: string]: number | string | null;
}

export default function FleetOverviewChart({
  bundles,
  selectedBotId,
  onSelect,
  height = 260,
}: Props) {
  const { rows, botIds } = useMemo(() => {
    const dateSet = new Set<string>();
    for (const b of bundles) for (const p of b.points) dateSet.add(p.session_date);
    const dates = Array.from(dateSet).sort();
    const rows: ChartPoint[] = dates.map((d) => ({ session_date: d }));
    for (const b of bundles) {
      const first = b.points[0]?.starting_nav ?? b.points[0]?.ending_nav ?? null;
      if (!first || first <= 0) continue;
      const byDate = new Map(b.points.map((p) => [p.session_date, p.ending_nav]));
      for (const row of rows) {
        const raw = byDate.get(row.session_date as string);
        row[b.bot_id] = raw != null ? (raw / first - 1) * 100 : null;
      }
    }
    return { rows, botIds: bundles.map((b) => b.bot_id) };
  }, [bundles]);

  if (rows.length < 2) return null;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
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
            tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
            stroke="var(--color-border)"
            width={48}
          />
          <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="3 3" />
          <Tooltip
            cursor={{ stroke: 'var(--color-info)', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={<FleetTooltip selectedBotId={selectedBotId} />}
          />
          {botIds.map((id, i) => {
            const isSelected = selectedBotId === id;
            const anySelected = selectedBotId !== null;
            return (
              <Line
                key={id}
                dataKey={id}
                type="monotone"
                stroke={botColor(id, i)}
                strokeWidth={isSelected ? 2.5 : 1.5}
                opacity={anySelected && !isSelected ? 0.35 : 1}
                dot={false}
                activeDot={{
                  r: 4,
                  strokeWidth: 2,
                  stroke: 'var(--color-surface)',
                  fill: botColor(id, i),
                  onClick: () => onSelect?.(id),
                }}
                isAnimationActive={false}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ dataKey: string; value: number | null; color: string }>;
  selectedBotId: string | null;
}

function FleetTooltip({ active, label, payload, selectedBotId }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = [...payload]
    .filter((p) => p.value !== null && Number.isFinite(p.value))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <div
      className="p-3 rounded-xl text-xs"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        minWidth: 180,
      }}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
        {fmtDate(String(label))}
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-1 items-center">
        {rows.map((r) => {
          const isSel = selectedBotId === r.dataKey;
          return (
            <Fragment key={r.dataKey}>
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: r.color }}
              />
              <span
                className="truncate text-[var(--color-text-primary)]"
                style={{ fontWeight: isSel ? 600 : 400 }}
              >
                {r.dataKey.replace(/_/g, ' ')}
              </span>
              <span
                className="tabular-nums"
                style={{ color: (r.value ?? 0) >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}
              >
                {fmtSignedPct((r.value ?? 0) / 100, 1)}
              </span>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
