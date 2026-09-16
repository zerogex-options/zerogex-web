'use client';

/**
 * The one legend for every Spread Monitor chart.
 *
 * Rendered by hand rather than configured, because two things that matter
 * here are not reliably controllable through Recharts' own legend — both
 * found by rendering the charts and looking at them, neither visible in the
 * code:
 *
 * **Text never wears the data colour.** Recharts paints each label with its
 * series stroke, which leaves a red word beside a green word as the only
 * thing telling them apart. Identity belongs to the swatch; the text stays
 * in the same muted ink as every other label on the page, so a reader who
 * cannot separate the two hues still reads two ordinary words.
 *
 * **Order is declared, not inferred.** Recharts orders entries by when each
 * series registers internally — not declaration order, and not the order
 * they appear on screen. The by-expiration chart drew puts then calls and
 * captioned itself "Calls, Puts". Passing an explicit `payload` does not fix
 * it on Recharts 3.7 (tried; ignored), so the legend is rendered directly
 * and the caption matches the picture by construction.
 *
 * The swatch carries the dash pattern too. The site's call/put green/red
 * pair measures ΔE 7.8 under deuteranopia — inside the 6-8 band that is
 * legal only with secondary encoding — so a dashed line in the chart must
 * be a dashed line in the legend, or the encoding stops at the plot edge.
 */

export interface LegendItem {
  /** Must match the series `name` exactly, or legend and tooltip diverge. */
  value: string;
  color: string;
  /** `line` honours `dasharray`; `rect` is a fill swatch. */
  shape?: 'line' | 'rect';
  dasharray?: string;
}

function Swatch({ item }: { item: LegendItem }) {
  if (item.shape === 'line') {
    return (
      <svg width={16} height={10} aria-hidden="true" style={{ flex: 'none' }}>
        <line
          x1={0}
          y1={5}
          x2={16}
          y2={5}
          stroke={item.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={item.dasharray}
        />
      </svg>
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: 2,
        backgroundColor: item.color,
        flex: 'none',
      }}
    />
  );
}

export function ChartLegend({ items }: { items: readonly LegendItem[] }) {
  return (
    <ul
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
      style={{ margin: 0, padding: '0 0 6px', listStyle: 'none', fontSize: 11 }}
    >
      {items.map((item) => (
        <li key={item.value} className="flex items-center gap-1.5">
          <Swatch item={item} />
          <span style={{ color: 'var(--text-secondary)' }}>{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Spread onto a Recharts `<Legend>`: `<Legend {...legendProps(items)} />`. */
export function legendProps(items: readonly LegendItem[]) {
  return {
    verticalAlign: 'top' as const,
    content: () => <ChartLegend items={items} />,
  };
}
