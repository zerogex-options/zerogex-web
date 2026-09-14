'use client';

/**
 * The hover readout, pinned to a corner instead of chasing the cursor.
 *
 * Recharts' default tooltip follows the mouse, which means on a dense session
 * chart the box sits directly on top of the bars you moved the cursor there to
 * read. The vertical cursor line is the useful part; the box is the part that
 * gets in the way.
 *
 * So the box is lifted out of Recharts entirely (the chart renders the cursor
 * line and no tooltip content) and drawn here, absolutely positioned in a top
 * corner of the plot. It switches sides at the midpoint of the session: while
 * the cursor is in the left half the readout sits top-right, and once past
 * halfway it moves top-left, so it is always on the side the cursor is not.
 *
 * `pointer-events: none` throughout. A readout that could intercept the mouse
 * would make the chart under it unhoverable, which is the same problem wearing
 * a different hat.
 */

export interface ReadoutRow {
  label: string;
  value: string;
  /** CSS color for the series swatch; omitted rows render without one. */
  color?: string;
}

export interface ChartHoverReadoutProps {
  title: string;
  rows: ReadoutRow[];
  /** Which corner to occupy. The caller decides from cursor position. */
  side: 'left' | 'right';
  /** Vertical inset in px, so callers can clear a legend. */
  top?: number;
}

export default function ChartHoverReadout({
  title,
  rows,
  side,
  top = 4,
}: ChartHoverReadoutProps) {
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border px-3 py-2 text-[11px] shadow-lg"
      style={{
        top,
        [side === 'right' ? 'right' : 'left']: 8,
        backgroundColor: 'var(--color-chart-tooltip-bg)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-chart-tooltip-text)',
        minWidth: 168,
      }}
    >
      <div className="mb-1 font-semibold">{title}</div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-4 leading-5">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--color-chart-tooltip-muted)' }}>
            {row.color && (
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: row.color }}
              />
            )}
            {row.label}
          </span>
          <span className="font-medium tabular-nums">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Which corner the readout belongs in for a given position in the series.
 *
 * Keyed on the hovered bar's index rather than a pixel coordinate so that two
 * synced charts agree: only the chart under the mouse gets mouse events, but
 * both know the index.
 */
export function readoutSide(index: number, total: number): 'left' | 'right' {
  if (total <= 0) return 'right';
  return index > total / 2 ? 'left' : 'right';
}
