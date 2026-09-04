import type { GexSummary } from '@/core/gexSummary';
import { fmtNetGex, fmtPrice, fmtTimestampET } from '@/core/gexSummary';
import { netGexAtSpotOrNull } from '@/core/gammaRegime';

type Props = {
  symbol: string;
  data: GexSummary;
  /**
   * The options chain the levels were computed from, when it differs from the
   * page's symbol (ES → SPX, NQ → NDX). Disclosed in the caption so a reader
   * or an answer engine quoting the table cannot mistake a projected level for
   * one derived from a futures chain that does not exist.
   */
  chainSymbol?: string;
};

type Row = { label: string; value: string; note: string };

/**
 * One real HTML table of today's delayed levels for a symbol.
 *
 * The free gamma-levels pages already show every level, but as styled <div>
 * rows inside a card that is itself a link. That reads fine to a person and
 * poorly to anything that extracts: Google's tabular featured snippets, the
 * AI answer engines whose grounding searches make up a large share of the
 * impressions on those pages, and screen readers all want a <table> with a
 * <caption> that carries the symbol and the "as of" time. Values come from
 * the same snapshot and the same formatters as the cards, so the two can
 * never disagree.
 */
export default function DelayedLevelsTable({ symbol, data, chainSymbol }: Props) {
  const netGex = netGexAtSpotOrNull(data.net_gex_at_spot);
  const rows: Row[] = [
    {
      label: 'Reference spot (delayed)',
      value: fmtPrice(data.spot_price),
      note: 'Snapshot price the levels below were computed against',
    },
    {
      label: 'Net dealer GEX at spot',
      value: fmtNetGex(netGex),
      note:
        netGex == null
          ? 'Modeled net dealer gamma, evaluated at spot'
          : netGex >= 0
            ? 'Positive: dealers modeled net long gamma — hedging tends to dampen moves'
            : 'Negative: dealers modeled net short gamma — hedging tends to amplify moves',
    },
    {
      label: 'Gamma flip (zero gamma level)',
      value: fmtPrice(data.gamma_flip),
      note: 'Regime line — above it positive gamma, below it negative gamma',
    },
    { label: 'Call wall', value: fmtPrice(data.call_wall), note: 'Heaviest call-gamma strike at or above spot' },
    { label: 'Put wall', value: fmtPrice(data.put_wall), note: 'Heaviest put-gamma strike at or below spot' },
    {
      label: 'Max pain',
      value: fmtPrice(data.max_pain),
      note: 'Strike where the most option value expires worthless',
    },
  ];
  if (data.pin_strike != null) {
    rows.push({
      label: 'Pin strike',
      value: fmtPrice(data.pin_strike),
      note: 'Reachable 0DTE strike with the strongest modeled restoring dealer gamma into expiration',
    });
  }

  const chainNote =
    chainSymbol && chainSymbol !== symbol
      ? ` · derived from the ${chainSymbol} options chain and converted to ${symbol} prices`
      : '';

  return (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="mb-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
          {symbol} gamma levels as of {fmtTimestampET(data.timestamp)} · delayed ~15 minutes{chainNote}
        </caption>
        <thead>
          <tr className="bg-[var(--color-surface-subtle)]">
            <th scope="col" className="border border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-primary)]">
              Level
            </th>
            <th scope="col" className="border border-[var(--color-border)] px-4 py-2 text-right font-semibold text-[var(--color-text-primary)]">
              Value
            </th>
            <th scope="col" className="border border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-primary)]">
              What it marks
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="border border-[var(--color-border)] px-4 py-2 text-left font-medium text-[var(--color-text-primary)]">
                {row.label}
              </th>
              <td
                className="border border-[var(--color-border)] px-4 py-2 text-right font-semibold text-[var(--color-text-primary)]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {row.value}
              </td>
              <td className="border border-[var(--color-border)] px-4 py-2 text-[var(--color-text-secondary)]">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
