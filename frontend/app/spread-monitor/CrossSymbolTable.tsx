'use client';

import {
  EMPTY,
  formatBps,
  formatMultiple,
  formatPct,
  type CompareRow,
} from '@/core/spreadMonitor';

/**
 * The same reading across every symbol with an option chain of its own.
 *
 * This is the panel that answers "is NDX any better than SPX today?", and
 * the only honest way to answer it is the **bps of the underlying** column.
 * SPX trades near 6,800 and NDX near 25,000: a $1.00-wide market means
 * something completely different on each, and comparing their dollar
 * widths compares their index levels. Width as a share of the option's own
 * premium is the other comparable measure and sits beside it, because the
 * two can disagree — a chain can be tight in index terms and expensive
 * relative to a cheap option's premium, which is exactly the 0DTE wing.
 *
 * A symbol whose chain could not be read gets a row saying so. Dropping it
 * would read as "not compared" and zero-filling it as "perfectly tight";
 * both are worse than the truth.
 */

const HEAD_CLASS = 'px-3 py-2 text-left font-semibold whitespace-nowrap';
const CELL_CLASS = 'px-3 py-2 whitespace-nowrap tabular-nums';

function toneFor(percentile: number | null): string {
  if (percentile == null) return 'var(--text-secondary)';
  if (percentile >= 95) return 'var(--color-bear)';
  if (percentile >= 80) return 'var(--color-warning)';
  if (percentile < 20) return 'var(--color-bull)';
  return 'var(--text-primary)';
}

export default function CrossSymbolTable({
  rows,
  activeSymbol,
  onSelect,
}: {
  rows: CompareRow[];
  activeSymbol?: string;
  onSelect?: (symbol: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr
            className="border-b"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <th className={HEAD_CLASS}>Symbol</th>
            <th className={HEAD_CLASS}>Put spread</th>
            <th className={HEAD_CLASS}>Call spread</th>
            <th className={HEAD_CLASS} title="Width in basis points of the index level — the cross-symbol comparable measure">
              Put width vs index
            </th>
            <th className={HEAD_CLASS} title="Put width divided by call width. Above 1 means the downside is the expensive side to trade.">
              Put / call
            </th>
            <th className={HEAD_CLASS} title="Share of contracts in range quoted with an offer and no bid">
              No bid
            </th>
            <th className={HEAD_CLASS} title="Where today's put width sits in this symbol's own trailing sessions">
              vs its own history
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isActive = row.symbol === activeSymbol;
            const selectable = onSelect != null && row.unavailable == null;
            return (
              <tr
                key={row.symbol}
                className="border-b last:border-b-0"
                style={{
                  borderColor: 'var(--border-default)',
                  backgroundColor: isActive ? 'var(--color-warning-soft)' : undefined,
                }}
              >
                {/* The switch lives on the symbol as a real button rather than
                    a click handler on the row: a whole-row onClick is
                    unreachable by keyboard and invisible to a screen reader,
                    and this is the page's only way to change symbol from the
                    comparison. */}
                <th scope="row" className={`${CELL_CLASS} text-left font-semibold`}>
                  {selectable ? (
                    <button
                      type="button"
                      onClick={() => onSelect?.(row.symbol)}
                      className="underline-offset-2 hover:underline"
                      style={{ color: 'inherit', font: 'inherit' }}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      {row.symbol}
                    </button>
                  ) : (
                    row.symbol
                  )}
                </th>
                {row.unavailable ? (
                  <td
                    className={CELL_CLASS}
                    colSpan={6}
                    style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}
                  >
                    {row.unavailable === 'no quoted chain'
                      ? 'No quoted chain available right now'
                      : row.unavailable}
                  </td>
                ) : (
                  <>
                    <td className={CELL_CLASS}>
                      {formatPct(row.puts?.median_relative_spread_pct)}
                    </td>
                    <td className={CELL_CLASS}>
                      {formatPct(row.calls?.median_relative_spread_pct)}
                    </td>
                    <td className={CELL_CLASS}>
                      {formatBps(row.puts?.median_spread_bps_underlying)}
                    </td>
                    <td className={CELL_CLASS}>
                      {formatMultiple(row.put_call_width_ratio)}
                    </td>
                    <td className={CELL_CLASS}>{formatPct(row.puts?.zero_bid_pct, 1)}</td>
                    <td
                      className={`${CELL_CLASS} font-semibold`}
                      style={{ color: toneFor(row.puts_percentile) }}
                    >
                      {row.puts_percentile == null
                        ? EMPTY
                        : `${Math.round(row.puts_percentile)}th pct`}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Compare across symbols using <strong>put width vs index</strong> — spreads in dollars
        are not comparable between an index near 6,800 and one near 25,000.{' '}
        <span style={{ fontStyle: 'italic' }}>
          vs its own history is null until the daily record has sessions to rank against.
        </span>
      </p>
    </div>
  );
}
