'use client';

import { Fragment, useMemo, useState } from 'react';
import type { ConfluenceMatrixResponse, ConfluenceMatrixCell } from '@/hooks/useApiData';
import { getNumber } from '@/core/signalHelpers';
import ChartCaption from "./ChartCaption";

interface ConfluenceMatrixProps {
  data: ConfluenceMatrixResponse | null;
}

function cellColor(net: number | null | undefined): string {
  if (net == null || !Number.isFinite(net)) return 'var(--color-surface-subtle)';
  const clamped = Math.max(-1, Math.min(1, net));
  const alpha = Math.abs(clamped);
  if (clamped >= 0) {
    return `rgba(27, 196, 125, ${(0.08 + alpha * 0.72).toFixed(3)})`;
  }
  return `rgba(255, 77, 90, ${(0.08 + alpha * 0.72).toFixed(3)})`;
}

function pretty(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

// Axis codes for the phone heatmap. Full names down the side took ~260px of a
// 310px card and left room for a column and a half; codes let all eight
// columns fit, with a key underneath. Four characters or fewer where a matrix
// can have eight columns (~32px each).
const SHORT_CODES: Record<string, string> = {
  tape_flow_bias: 'TAPE',
  skew_delta: 'SKEW',
  vanna_charm_flow: 'V/C',
  dealer_delta_pressure: 'DDP',
  gex_gradient: 'GEXG',
  positioning_trap: 'PTRAP',
  squeeze_setup: 'SQZ',
  range_break_imminence: 'RBI',
  trap_detection: 'TRAP',
  zero_dte_position_imbalance: '0DTE',
  market_pressure: 'MPI',
  vol_expansion: 'VOL',
  gamma_vwap_confluence: 'GVW',
  eod_pressure: 'EOD',
};

// Names for the phone key, cased the way the signal pages title them.
const KEY_NAMES: Record<string, string> = {
  vanna_charm_flow: 'Vanna/Charm Flow',
  gex_gradient: 'GEX Gradient',
  zero_dte_position_imbalance: '0DTE Position Imbalance',
  market_pressure: 'Market Pressure Index',
  vol_expansion: 'Volatility Expansion',
  gamma_vwap_confluence: 'Gamma/VWAP Confluence',
  eod_pressure: 'EOD Pressure',
};

function shortCode(name: string): string {
  return SHORT_CODES[name] ?? name.split('_').map((w) => w.charAt(0)).join('').toUpperCase().slice(0, 4);
}

// ".73" / "-.48": two decimals in four characters, so a value fits a ~32px cell.
function compactNet(net: number): string {
  const fixed = net.toFixed(2);
  return fixed.replace(/^(-?)0\./, '$1.');
}

export default function ConfluenceMatrix({ data }: ConfluenceMatrixProps) {
  const [hover, setHover] = useState<{ row: string; col: string; cell: ConfluenceMatrixCell } | null>(null);

  const sortedComponents = useMemo(() => {
    const components = data?.components ?? [];
    const matrix = data?.matrix ?? {};
    const averages = new Map<string, number>();
    components.forEach((c) => {
      const row = matrix[c] ?? {};
      const net: number[] = [];
      Object.entries(row).forEach(([k, cell]) => {
        if (k === c) return;
        const v = getNumber(cell?.net_confluence);
        if (v != null) net.push(v);
      });
      const avg = net.length ? net.reduce((a, b) => a + b, 0) / net.length : -Infinity;
      averages.set(c, avg);
    });
    return [...components].sort((a, b) => (averages.get(b) ?? -Infinity) - (averages.get(a) ?? -Infinity));
  }, [data]);

  if (!data || !data.components || data.components.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
        No confluence data available yet.
      </div>
    );
  }

  const matrix = data.matrix ?? {};

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-sm font-semibold">Confluence Matrix</div>
          <div className="text-[11px] text-[var(--color-text-secondary)]">
            Pairwise agreement across the last {data.lookback ?? '—'} snapshots
            {data.sample_count != null ? ` · ${data.sample_count} rows analyzed` : ''}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-secondary)]">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: cellColor(-0.8) }} /> Disagree</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: cellColor(0) }} /> Neutral</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: cellColor(0.8) }} /> Agree</span>
        </div>
      </div>

      {/* Phone: the same matrix as a fitted grid of square cells with coded
          axes. Tapping a cell opens the same detail panel hover does. */}
      <div className="sm:hidden">
        <div
          className="grid gap-px"
          style={{ gridTemplateColumns: `40px repeat(${sortedComponents.length}, minmax(0, 1fr))` }}
          role="group"
          aria-label="Confluence matrix"
        >
          <div aria-hidden />
          {sortedComponents.map((c) => (
            <div
              key={c}
              aria-hidden
              className="truncate pb-1 text-center text-[10px] font-semibold text-[var(--color-text-secondary)]"
              title={pretty(c)}
            >
              {shortCode(c)}
            </div>
          ))}
          {sortedComponents.map((row) => (
            <Fragment key={row}>
              <div
                aria-hidden
                className="self-center truncate pr-1.5 text-right text-[10px] font-semibold text-[var(--color-text-secondary)]"
                title={pretty(row)}
              >
                {shortCode(row)}
              </div>
              {sortedComponents.map((col) => {
                const cell = matrix[row]?.[col] ?? {};
                const net = getNumber(cell.net_confluence);
                const isDiag = row === col;
                const selected = hover?.row === row && hover?.col === col;
                return (
                  <button
                    key={col}
                    type="button"
                    disabled={isDiag}
                    onClick={() => setHover(selected ? null : { row, col, cell })}
                    aria-label={`${pretty(row)} × ${pretty(col)}: ${net != null ? net.toFixed(2) : 'no data'}`}
                    aria-pressed={selected}
                    className="flex aspect-square items-center justify-center rounded-[3px] text-[10px] font-semibold tabular-nums"
                    style={{
                      background: isDiag ? 'var(--color-border)' : cellColor(net),
                      color: Math.abs(net ?? 0) > 0.5 ? '#fff' : 'var(--color-text-primary)',
                      outline: selected ? '2px solid var(--color-text-primary)' : 'none',
                      outlineOffset: -1,
                    }}
                  >
                    {isDiag ? '·' : net != null ? compactNet(net) : '—'}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] leading-snug text-[var(--color-text-secondary)]">
          {sortedComponents.map((c) => (
            <div key={c} className="flex min-w-0 items-baseline gap-1.5">
              <dt className="w-10 shrink-0 font-semibold text-[var(--color-text-primary)]">{shortCode(c)}</dt>
              <dd className="min-w-0">{KEY_NAMES[c] ?? pretty(c)}</dd>
            </div>
          ))}
        </dl>
        {!hover && (
          <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">Tap a cell for its agreement detail.</p>
        )}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--color-surface-subtle)] p-1.5" />
              {sortedComponents.map((c) => (
                <th
                  key={c}
                  className="p-1 align-bottom text-[var(--color-text-secondary)] font-semibold"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: 160 }}
                >
                  {pretty(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedComponents.map((row) => (
              <tr key={row}>
                <th className="sticky left-0 z-10 bg-[var(--color-surface-subtle)] p-2 text-right font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">
                  {pretty(row)}
                </th>
                {sortedComponents.map((col) => {
                  const cell = matrix[row]?.[col] ?? {};
                  const net = getNumber(cell.net_confluence);
                  const isDiag = row === col;
                  const bg = isDiag ? 'var(--color-border)' : cellColor(net);
                  return (
                    <td
                      key={col}
                      onMouseEnter={() => !isDiag && setHover({ row, col, cell })}
                      onMouseLeave={() => setHover(null)}
                      className="border border-[var(--color-border)]/40 text-center font-mono"
                      style={{ width: 44, height: 44, minWidth: 44, background: bg, color: Math.abs(net ?? 0) > 0.5 ? '#fff' : 'var(--color-text-primary)' }}
                    >
                      {isDiag ? '·' : net != null ? net.toFixed(2) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hover && (
        <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs">
          <div className="font-semibold mb-1">{pretty(hover.row)} × {pretty(hover.col)}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[var(--color-text-secondary)]">
            <span>Net confluence: <span className="font-mono text-[var(--color-text-primary)]">{hover.cell.net_confluence != null ? Number(hover.cell.net_confluence).toFixed(3) : '—'}</span></span>
            <span>Agree ratio: <span className="font-mono text-[var(--color-text-primary)]">{hover.cell.agreement_ratio != null ? Number(hover.cell.agreement_ratio).toFixed(3) : '—'}</span></span>
            <span>Disagree ratio: <span className="font-mono text-[var(--color-text-primary)]">{hover.cell.disagreement_ratio != null ? Number(hover.cell.disagreement_ratio).toFixed(3) : '—'}</span></span>
            <span>Observations: <span className="font-mono text-[var(--color-text-primary)]">{hover.cell.active_observations ?? 0} / {hover.cell.observations ?? 0}</span></span>
          </div>
        </div>
      )}
      <ChartCaption />
    </div>
  );
}
