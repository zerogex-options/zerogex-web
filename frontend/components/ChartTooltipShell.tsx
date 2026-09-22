import type { CSSProperties, ReactNode } from 'react';

/**
 * The ONE hover card for a chart.
 *
 * Recharts' own `contentStyle` only reaches the default tooltip; every chart
 * that wanted to show two numbers and a label rendered a custom `content={...}`
 * div instead, and each picked its own box — `rounded-lg border px-3 py-2` on
 * Technicals, a `rounded-xl` with a shadow on Max Pain, a bare div on
 * Volatility. Same hover, three boxes.
 *
 * This is that box, on the panel's own tokens: flat ground, one hairline, the
 * system's 2px radius rather than a per-chart guess.
 *
 *   content={({ active, payload, label }) =>
 *     active && payload?.length ? (
 *       <ChartTooltipShell label={fmtTime(label)}>
 *         <ChartTooltipRow label="Price" value={`$${p.price.toFixed(2)}`} />
 *       </ChartTooltipShell>
 *     ) : null
 *   }
 */
export default function ChartTooltipShell({
  label,
  className = '',
  style,
  children,
}: {
  /** The point's identity — a timestamp, a strike, an expiration. */
  label?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={`border px-3 py-2 text-xs ${className}`}
      style={{
        borderRadius: 'var(--radius-panel)',
        backgroundColor: 'var(--color-chart-tooltip-bg)',
        borderColor: 'var(--border-default)',
        color: 'var(--color-chart-tooltip-text)',
        ...style,
      }}
    >
      {label != null ? (
        <div className="zg-eyebrow mb-1.5" style={{ color: 'var(--color-chart-tooltip-muted)' }}>
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** One label/value line inside the shell. Values are mono so they align. */
export function ChartTooltipRow({
  label,
  value,
  color,
  swatch,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Tints the value only — the label stays quiet so the column reads evenly. */
  color?: string;
  /** A series dot, for charts plotting more than one line. */
  swatch?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 leading-relaxed">
      <span className="flex items-center gap-1.5" style={{ color: 'var(--color-chart-tooltip-muted)' }}>
        {swatch ? (
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: 1,
              background: swatch,
              display: 'inline-block',
            }}
          />
        ) : null}
        {label}
      </span>
      <span className="zg-datum" style={{ fontSize: 12, color: color ?? 'var(--color-chart-tooltip-text)' }}>
        {value}
      </span>
    </div>
  );
}

/**
 * The props Recharts' default `<Tooltip>` needs to match the shell above, for
 * charts that do not render custom content.
 *
 *   <Tooltip {...CHART_TOOLTIP_PROPS} />
 */
export const CHART_TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: 'var(--color-chart-tooltip-bg)',
    borderColor: 'var(--border-default)',
    borderRadius: 'var(--radius-panel)',
    color: 'var(--color-chart-tooltip-text)',
    fontSize: 12,
  },
  labelStyle: { color: 'var(--color-chart-tooltip-text)', fontWeight: 600 },
  itemStyle: { color: 'var(--color-chart-tooltip-muted)' },
  cursor: { stroke: 'var(--text-primary)', strokeOpacity: 0.2 },
} as const;

/** Axis chrome, so every in-page chart draws the same axis. */
export const CHART_AXIS = {
  stroke: 'var(--text-secondary)',
  tickLine: false,
  tick: { fill: 'var(--text-secondary)', fontSize: 11 },
} as const;

/** Horizontal-only gridlines on the chart grid token. */
export const CHART_GRID = {
  vertical: false,
  stroke: 'var(--color-grid-line)',
} as const;
