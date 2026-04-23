'use client';

import { useMemo, useState } from 'react';
import type { ConfluenceMatrixResponse, ConfluenceMatrixCell } from '@/hooks/useApiData';
import { getNumber } from '@/core/signalHelpers';

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

      <div className="overflow-x-auto">
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
    </div>
  );
}
