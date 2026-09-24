'use client';

/**
 * ORB breakout map: the session's price against the opening range, with the
 * band, its high and low, and where price left it. Drawn on the Technicals page
 * and as a My Dashboard widget; both render this, so the two cannot drift
 * apart. The caller supplies the frame and heading.
 */

import { useId, useMemo } from 'react';
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartTooltipShell, { ChartTooltipRow } from '@/components/ChartTooltipShell';
import type { TechnicalsBar, TechnicalsOpeningRange } from '@/hooks/useTechnicals';
import {
  ET_HM,
  etMinuteOfDay,
  getDateMarkerMeta,
  orbChartDomain,
  orbChartRows,
  orbPriceTicks,
  phoneLabelStepMin,
  phonePriceTick,
  safeNum,
  timelineLabelStepMin,
} from '@/core/technicalsCharts';

export type OrbBreakoutMapLabels = {
  price: string;
  orbHigh: string;
  orbLow: string;
  vsHigh: string;
  vsLow: string;
  zone: string;
  above: string;
  below: string;
  inside: string;
};

const DEFAULT_LABELS: OrbBreakoutMapLabels = {
  price: 'Price',
  orbHigh: 'ORB High',
  orbLow: 'ORB Low',
  vsHigh: 'vs High',
  vsLow: 'vs Low',
  zone: 'Zone',
  above: 'Above ORB High',
  below: 'Below ORB Low',
  inside: 'Inside ORB Range',
};

type TickProps = { x?: number | string; y?: number | string; payload?: { value?: string | number }; index?: number };

export default function OrbBreakoutMap({
  bars,
  orb,
  height,
  compact,
  labelStepMin,
  labels = DEFAULT_LABELS,
}: {
  bars: TechnicalsBar[];
  /** The latest opening range, for the H and L tags on the right. */
  orb: TechnicalsOpeningRange | null;
  height: number;
  /** Narrow layout: about five ET-aligned time labels, tags inside the plot. */
  compact: boolean;
  /** Minutes between desktop time labels; worked out from the bars if omitted. */
  labelStepMin?: number;
  labels?: OrbBreakoutMapLabels;
}) {
  const axisStroke = 'var(--text-primary)';
  const mutedText = 'var(--text-secondary)';
  // Unique per chart: two maps on one board must not share a gradient.
  const gradientId = `orbZoneGrad-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const rows = useMemo(() => orbChartRows(bars), [bars]);
  const domain = useMemo(() => orbChartDomain(rows), [rows]);
  const priceTicks = useMemo(() => orbPriceTicks(domain), [domain]);
  const timestamps = useMemo(() => rows.map((row) => row.timestamp), [rows]);
  const dateMarkers = useMemo(() => getDateMarkerMeta(timestamps.map(String)), [timestamps]);
  const phoneStepMin = useMemo(() => phoneLabelStepMin(timestamps), [timestamps]);
  const desktopStepMin = labelStepMin ?? timelineLabelStepMin(rows.length);

  const renderTimelineTick = (props: TickProps) => {
    const x = Number(props?.x ?? 0); const y = Number(props?.y ?? 0);
    const ts = String(props?.payload?.value || '');
    const index = Number(props?.index ?? -1);
    const d = ts ? new Date(ts) : null;
    const minOfDay = d && !Number.isNaN(d.getTime()) ? d.getUTCHours() * 60 + d.getUTCMinutes() : -1;
    const showTime = minOfDay >= 0 && minOfDay % desktopStepMin === 0;
    const timeLabel = showTime ? d!.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) : '';
    const dateLabel = dateMarkers.get(index);
    if (!timeLabel && !dateLabel) return <g transform={`translate(${x},${y})`} />;
    return (
      <g transform={`translate(${x},${y})`}>
        <line x1={0} y1={0} x2={0} y2={5} stroke={axisStroke} strokeWidth={1} opacity={0.6} />
        {timeLabel ? <text dy={14} textAnchor="middle" fill={axisStroke} fontSize={10}>{timeLabel}</text> : null}
        {dateLabel ? <text dy={timeLabel ? 26 : 14} textAnchor="middle" fill={mutedText} fontSize={9}>{dateLabel}</text> : null}
      </g>
    );
  };

  // Compact twin of renderTimelineTick: an ET-aligned step sized to the
  // chart's own span (see phoneLabelStepMin), 10px type, and the session date
  // under the first slot.
  const renderCompactTick = (props: TickProps) => {
    const x = Number(props?.x ?? 0); const y = Number(props?.y ?? 0);
    const ts = String(props?.payload?.value || '');
    const index = Number(props?.index ?? -1);
    const ms = ts ? new Date(ts).getTime() : NaN;
    const minute = Number.isFinite(ms) ? etMinuteOfDay(ms) : -1;
    const showTime = minute >= 0 && minute % phoneStepMin === 0;
    const dateLabel = index === 0 && Number.isFinite(ms)
      ? new Date(ms).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })
      : '';
    if (!showTime && !dateLabel) return <g transform={`translate(${x},${y})`} />;
    return (
      <g transform={`translate(${x},${y})`}>
        {showTime ? <line x1={0} y1={0} x2={0} y2={5} stroke={axisStroke} strokeWidth={1} opacity={0.6} /> : null}
        {showTime ? <text dy={14} textAnchor="middle" fill={axisStroke} fontSize={10}>{ET_HM.format(new Date(ms))}</text> : null}
        {dateLabel ? <text dy={26} textAnchor="start" fill={mutedText} fontSize={10}>{dateLabel}</text> : null}
      </g>
    );
  };

  // Readouts in the compact layout pin to the top of the plot (clear of the
  // finger) and name the bar by the ET clock the axis prints.
  const tooltipPosition = compact ? { position: { y: 0 } } : {};
  const tooltipTimeLabel = (label: unknown) => {
    if (!label) return '--';
    const d = new Date(String(label));
    return compact ? `${ET_HM.format(d)} ET` : d.toLocaleString('en-US', { timeZone: 'America/New_York' });
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={compact ? { top: 8, right: 4, left: 0, bottom: 16 } : { top: 16, right: 56, left: 0, bottom: 16 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-warning)" stopOpacity={0.42} />
            <stop offset="100%" stopColor="var(--color-warning)" stopOpacity={0.18} />
          </linearGradient>
        </defs>
        <XAxis dataKey="timestamp" stroke={axisStroke} tickLine={false} interval={0} minTickGap={20} tick={compact ? renderCompactTick : renderTimelineTick} />
        <YAxis stroke={axisStroke} tick={{ fill: axisStroke, fontSize: compact ? 10 : 11 }} tickLine={false} width={compact ? 44 : 60} domain={domain ?? ['auto', 'auto']} ticks={priceTicks.length ? priceTicks : undefined} tickFormatter={(v) => (compact ? phonePriceTick(Number(v), priceTicks) : `$${Number(v).toFixed(2)}`)} allowDataOverflow={false} padding={{ top: 12, bottom: 12 }} />
        <Tooltip
          {...tooltipPosition}
          cursor={{ stroke: 'var(--text-primary)', strokeOpacity: 0.2 }}
          content={({ active, label, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0]?.payload as { price: number | null; orbHigh: number | null; orbLow: number | null } | undefined;
            if (!point) return null;
            const labelStr = tooltipTimeLabel(label);
            const distHigh = point.price != null && point.orbHigh != null ? point.price - point.orbHigh : null;
            const distLow = point.price != null && point.orbLow != null ? point.price - point.orbLow : null;
            const zone = point.price == null || point.orbHigh == null || point.orbLow == null
              ? null
              : point.price > point.orbHigh ? 'above' : point.price < point.orbLow ? 'below' : 'inside';
            const zoneColor = zone === 'above' ? 'var(--color-bull)' : zone === 'below' ? 'var(--color-bear)' : 'var(--color-warning)';
            return (
              <ChartTooltipShell label={labelStr}>
                <ChartTooltipRow label={labels.price} value={point.price != null ? `$${point.price.toFixed(2)}` : '--'} swatch="var(--text-primary)" />
                <ChartTooltipRow label={labels.orbHigh} value={point.orbHigh != null ? `$${point.orbHigh.toFixed(2)}` : '--'} swatch="var(--color-bull)" />
                <ChartTooltipRow label={labels.orbLow} value={point.orbLow != null ? `$${point.orbLow.toFixed(2)}` : '--'} swatch="var(--color-bear)" />
                {distHigh != null ? <ChartTooltipRow label={labels.vsHigh} value={`${distHigh >= 0 ? '+' : ''}$${distHigh.toFixed(2)}`} /> : null}
                {distLow != null ? <ChartTooltipRow label={labels.vsLow} value={`${distLow >= 0 ? '+' : ''}$${distLow.toFixed(2)}`} /> : null}
                {zone ? <ChartTooltipRow label={labels.zone} value={labels[zone]} color={zoneColor} /> : null}
              </ChartTooltipShell>
            );
          }}
        />
        <Area type="stepAfter" dataKey="orbBand" stroke="none" fill={`url(#${gradientId})`} connectNulls={false} isAnimationActive={false} activeDot={false} />
        <Line type="stepAfter" dataKey="orbHigh" name={labels.orbHigh} stroke="var(--color-bull)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        <Line type="stepAfter" dataKey="orbLow" name={labels.orbLow} stroke="var(--color-bear)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        <Line type="monotone" dataKey="price" name={labels.price} stroke="var(--text-primary)" strokeWidth={2.25} dot={false} connectNulls isAnimationActive={false} />
        {/* The level tags hang in a 56px right gutter on a wide chart; the
            compact layout has no gutter to spare, so they sit inside the
            plot's right edge — H above its line, L below its. */}
        {orb?.orb_high != null ? (
          <ReferenceLine y={orb.orb_high} stroke="transparent" label={{ value: `H $${(safeNum(orb.orb_high) ?? 0).toFixed(2)}`, position: compact ? 'insideTopRight' : 'right', fill: 'var(--color-bull)', fontSize: compact ? 10 : 11, fontWeight: 600 }} />
        ) : null}
        {orb?.orb_low != null ? (
          <ReferenceLine y={orb.orb_low} stroke="transparent" label={{ value: `L $${(safeNum(orb.orb_low) ?? 0).toFixed(2)}`, position: compact ? 'insideBottomRight' : 'right', fill: 'var(--color-bear)', fontSize: compact ? 10 : 11, fontWeight: 600 }} />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
