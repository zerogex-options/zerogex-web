'use client';

/**
 * Contracts bought and sold, live: calls and puts each split by who crossed
 * the spread, with what the latest bar added to each, and the bullish side
 * (calls bought + puts sold) against the bearish side (puts bought + calls
 * sold) underneath. The numbers are core/flowAnalysis's; how bought and sold
 * are told apart is written up there.
 *
 * Color carries direction, as everywhere on the page: calls bought and puts
 * sold are the bullish side (bull), puts bought and calls sold the bearish
 * side (bear). So a put row's "bought" segment is red, which is the point: put
 * buying leans bearish.
 */

import type { CSSProperties, ReactNode } from 'react';
import Panel from '@/components/layout/Panel';
import { fmtContracts, fmtShare, type FlowRead } from '@/core/flowAnalysis';

const BULL = 'var(--color-bull)';
const BEAR = 'var(--color-bear)';
const rule = 'var(--border-subtle)';

interface Props {
  read: FlowRead | null;
  /** The latest bar's start in ET, "14:35"; null when unknown. */
  barLabel: string | null;
  compact: boolean;
  loading: boolean;
  /** The live session, still trading (a past one is final). */
  live: boolean;
  /** Says which contracts the numbers cover when a filter narrows them. */
  scopeNote?: string | null;
}

function Swatch({ color }: { color: string }) {
  return <span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, background: color, flex: 'none' }} />;
}

/** Two segments, `a` of `a + b`, in their own colors. */
function SplitBar({ a, b, colorA, colorB, height = 10 }: { a: number; b: number; colorA: string; colorB: string; height?: number }) {
  const total = a + b;
  const share = total > 0 ? (a / total) * 100 : 50;
  return (
    <div aria-hidden="true" style={{ display: 'flex', height, width: '100%', background: 'var(--bg-hover)', gap: total > 0 ? 2 : 0 }}>
      {total > 0 && (
        <>
          <div style={{ width: `${share}%`, background: colorA, opacity: 0.85 }} />
          <div style={{ flex: 1, background: colorB, opacity: 0.85 }} />
        </>
      )}
    </div>
  );
}

function Since({ n, barLabel }: { n: number; barLabel: string | null }) {
  return (
    <span className="zg-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
      {`+${fmtContracts(n)} since ${barLabel}`}
    </span>
  );
}

/** The phone's short form: the bar is named once, under the rows. */
function PlusOnly({ n }: { n: number }) {
  return (
    <span className="zg-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
      {`+${fmtContracts(n)}`}
    </span>
  );
}

function Num({ children, size = 24, color }: { children: ReactNode; size?: number; color?: string }) {
  return (
    <span className="zg-metric" style={{ fontSize: size, color, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

interface Side {
  key: 'calls' | 'puts';
  label: string;
  bought: number;
  sold: number;
  lastBought: number;
  lastSold: number;
  boughtColor: string;
  soldColor: string;
}

function netWords(net: number): string {
  return net > 0 ? 'net bought' : net < 0 ? 'net sold' : 'even';
}

export default function BoughtSoldBoard({ read, barLabel, compact, loading, live, scopeNote = null }: Props) {
  const sides: Side[] = read
    ? [
        {
          key: 'calls',
          label: 'Calls',
          bought: read.totals.callsBought,
          sold: read.totals.callsSold,
          lastBought: read.last.callsBought,
          lastSold: read.last.callsSold,
          boughtColor: BULL,
          soldColor: BEAR,
        },
        {
          key: 'puts',
          label: 'Puts',
          bought: read.totals.putsBought,
          sold: read.totals.putsSold,
          lastBought: read.last.putsBought,
          lastSold: read.last.putsSold,
          boughtColor: BEAR,
          soldColor: BULL,
        },
      ]
    : [];

  const header = (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${rule}` }}>
      <div style={{ minWidth: 0 }}>
        <h2 className="zg-h3" style={{ margin: 0 }}>
          Bought vs. sold
        </h2>
        <p className="zg-caption" style={{ margin: '4px 0 0' }}>
          Contracts by who crossed the spread: at the ask counts as bought, at the bid as sold.
          {scopeNote ? ` ${scopeNote}` : ''}
        </p>
      </div>
      {read && (
        <span className="zg-caption" style={{ whiteSpace: 'nowrap' }}>
          {live ? 'Session totals, live' : 'Session totals'}
        </span>
      )}
    </div>
  );

  if (!read) {
    return (
      <Panel padded={false}>
        {header}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '18px 16px' }} aria-hidden="true">
            <div className="zg-skeleton-line" style={{ width: '70%', height: 22 }} />
            <div className="zg-skeleton-line" style={{ width: '62%', height: 22 }} />
          </div>
        ) : (
          <p className="zg-caption" style={{ margin: 0, padding: '18px 16px' }}>
            No trades yet in this session.
          </p>
        )}
      </Panel>
    );
  }

  const bullTotal = read.bullish;
  const bearTotal = read.bearish;
  const sideTotal = bullTotal + bearTotal;

  const sideLine = (label: string, color: string, value: number, share: string, note: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
      <span className="zg-label" style={{ color }}>
        {label}
      </span>
      <Num size={compact ? 17 : 18}>{fmtContracts(value)}</Num>
      <span className="zg-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {share}
        {compact ? '' : ` · ${note}`}
      </span>
    </span>
  );

  const sidesFooter = (
    <div style={{ padding: '14px 16px 16px', borderTop: `1px solid ${rule}` }}>
      {compact ? (
        // Stacked on a phone: two short lines read better than one that wraps.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {sideLine('Bullish side', BULL, bullTotal, fmtShare(bullTotal, sideTotal), 'calls bought + puts sold')}
          {sideLine('Bearish side', BEAR, bearTotal, fmtShare(bearTotal, sideTotal), 'puts bought + calls sold')}
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          {sideLine('Bullish side', BULL, bullTotal, fmtShare(bullTotal, sideTotal), 'calls bought + puts sold')}
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span className="zg-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              puts bought + calls sold · {fmtShare(bearTotal, sideTotal)}
            </span>
            <Num size={18}>{fmtContracts(bearTotal)}</Num>
            <span className="zg-label" style={{ color: BEAR }}>
              Bearish side
            </span>
          </span>
        </div>
      )}
      <SplitBar a={bullTotal} b={bearTotal} colorA={BULL} colorB={BEAR} height={8} />
      <p className="zg-caption" style={{ margin: '8px 0 0' }}>
        {read.netFlow === 0
          ? 'The two sides are level.'
          : `The ${read.netFlow > 0 ? 'bullish' : 'bearish'} side leads by ${fmtContracts(Math.abs(read.netFlow))} contracts, the session's net flow.`}
      </p>
    </div>
  );

  if (compact) {
    return (
      <Panel padded={false}>
        {header}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {sides.map((s, i) => {
            const net = s.bought - s.sold;
            return (
              <li key={s.key} style={{ padding: '14px 16px', borderTop: i === 0 ? 'none' : `1px solid ${rule}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span className="zg-h4">{s.label}</span>
                  <span className="zg-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {fmtShare(s.bought, s.bought + s.sold)} bought · {fmtContracts(s.bought + s.sold)} traded
                  </span>
                </div>
                <SplitBar a={s.bought} b={s.sold} colorA={s.boughtColor} colorB={s.soldColor} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                  <Cell label="Bought" color={s.boughtColor} value={fmtContracts(s.bought)} since={barLabel ? <PlusOnly n={s.lastBought} /> : null} size={18} />
                  <Cell label="Sold" color={s.soldColor} value={fmtContracts(s.sold)} since={barLabel ? <PlusOnly n={s.lastSold} /> : null} size={18} />
                  <Cell label="Net" value={fmtContracts(net, true)} valueColor={net === 0 ? undefined : net > 0 ? s.boughtColor : s.soldColor} since={<span className="zg-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{netWords(net)}</span>} size={18} />
                </div>
              </li>
            );
          })}
        </ul>
        {barLabel && (
          <p className="zg-caption" style={{ margin: 0, padding: '0 16px 12px' }}>
            The + figures are what traded since the {barLabel} bar opened.
          </p>
        )}
        {sidesFooter}
      </Panel>
    );
  }

  const th: CSSProperties = {
    textAlign: 'left',
    padding: '10px 12px 6px',
    borderBottom: `1px solid ${rule}`,
    whiteSpace: 'nowrap',
  };
  const td: CSSProperties = { padding: '14px 12px', verticalAlign: 'top' };

  return (
    <Panel padded={false}>
      {header}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th scope="col" className="zg-label" style={{ ...th, paddingLeft: 16, width: 120 }}>
                <span className="sr-only">Option type</span>
              </th>
              <th scope="col" className="zg-label" style={th}>
                Bought
              </th>
              <th scope="col" className="zg-label" style={th}>
                Sold
              </th>
              <th scope="col" className="zg-label" style={{ ...th, width: '28%' }}>
                Split
              </th>
              <th scope="col" className="zg-label" style={{ ...th, paddingRight: 16, textAlign: 'right' }}>
                Net
              </th>
            </tr>
          </thead>
          <tbody>
            {sides.map((s, i) => {
              const net = s.bought - s.sold;
              const border = i === 0 ? undefined : `1px solid ${rule}`;
              return (
                <tr key={s.key} style={{ borderTop: border }}>
                  <th scope="row" style={{ ...td, paddingLeft: 16, textAlign: 'left', fontWeight: 'normal' }}>
                    <div className="zg-h4">{s.label}</div>
                    <div className="zg-mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {fmtContracts(s.bought + s.sold)} traded
                    </div>
                  </th>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Swatch color={s.boughtColor} />
                      <Num>{fmtContracts(s.bought)}</Num>
                    </div>
                    {barLabel && (
                      <div style={{ marginTop: 4, paddingLeft: 16 }}>
                        <Since n={s.lastBought} barLabel={barLabel} />
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Swatch color={s.soldColor} />
                      <Num>{fmtContracts(s.sold)}</Num>
                    </div>
                    {barLabel && (
                      <div style={{ marginTop: 4, paddingLeft: 16 }}>
                        <Since n={s.lastSold} barLabel={barLabel} />
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, paddingTop: 18 }}>
                    <SplitBar a={s.bought} b={s.sold} colorA={s.boughtColor} colorB={s.soldColor} />
                    <div className="zg-mono" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                      {fmtShare(s.bought, s.bought + s.sold)} bought
                    </div>
                  </td>
                  <td style={{ ...td, paddingRight: 16, textAlign: 'right' }}>
                    <Num color={net === 0 ? undefined : net > 0 ? s.boughtColor : s.soldColor}>{fmtContracts(net, true)}</Num>
                    <div className="zg-mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {netWords(net)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sidesFooter}
    </Panel>
  );
}

function Cell({
  label,
  value,
  since,
  color,
  valueColor,
  size,
}: {
  label: string;
  value: string;
  since: ReactNode;
  color?: string;
  valueColor?: string;
  size: number;
}) {
  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span className="zg-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {color && <Swatch color={color} />}
        {label}
      </span>
      <Num size={size} color={valueColor}>
        {value}
      </Num>
      {since}
    </div>
  );
}
