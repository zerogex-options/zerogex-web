'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { usePageT } from '@/core/LanguageContext';
import { dict } from './StrikeProfileSnapshot.i18n';

// Horizontal-strike-profile card for the shareable moment page. Mirrors
// the flipped ReplayScrubber chart so the snapshot reads the same way
// as the live scrubber a user just came from.

interface SnapshotStrike {
  strike: number | null;
  net_gex: number | null;
}

interface StrikeProfileSnapshotProps {
  strikes: SnapshotStrike[];
  spot?: number | null;
  gammaFlip?: number | null;
  callWall?: number | null;
  putWall?: number | null;
}

function formatMagnitude(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export default function StrikeProfileSnapshot({
  strikes,
  spot,
  gammaFlip,
  callWall,
  putWall,
}: StrikeProfileSnapshotProps) {
  const t = usePageT(dict);
  const rows = strikes
    .filter((s) => s.strike != null && s.net_gex != null)
    .map((s) => ({
      strike: s.strike as number,
      net_gex: s.net_gex as number,
      fill:
        (s.net_gex as number) >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
    }))
    // Descending so higher strikes render at the top of the Y-axis —
    // matches how a trader reads an option chain.
    .sort((a, b) => b.strike - a.strike);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-6 text-sm text-[var(--color-text-secondary)]">
        {t('empty')}
      </div>
    );
  }

  const peak = rows.reduce(
    (acc, r) => (Math.abs(r.net_gex) > acc ? Math.abs(r.net_gex) : acc),
    0,
  );
  const domainMax = peak * 1.05 || 1;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
      <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
        {t('heading')}
      </div>
      <div className="mt-3 h-[520px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={rows}
            margin={{ top: 8, right: 24, left: 16, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              type="number"
              domain={[-domainMax, domainMax]}
              stroke="var(--color-text-secondary)"
              tickFormatter={formatMagnitude}
            />
            <YAxis
              type="category"
              dataKey="strike"
              stroke="var(--color-text-secondary)"
              width={64}
              tickFormatter={(v) => Number(v).toFixed(0)}
              interval="preserveStartEnd"
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                fontSize: 12,
              }}
              formatter={(value) => [
                typeof value === 'number' ? formatMagnitude(value) : '—',
                'Net GEX',
              ]}
              labelFormatter={(label) => `Strike $${label}`}
            />
            <ReferenceLine x={0} stroke="var(--color-border)" />
            {spot != null && (
              <ReferenceLine
                y={spot}
                stroke="var(--color-text-primary)"
                strokeDasharray="3 2"
                label={{
                  value: 'Spot',
                  position: 'right',
                  fill: 'var(--color-text-primary)',
                  fontSize: 10,
                }}
              />
            )}
            {gammaFlip != null && (
              <ReferenceLine
                y={gammaFlip}
                stroke="var(--color-warning)"
                strokeDasharray="4 2"
                label={{
                  value: 'Flip',
                  position: 'right',
                  fill: 'var(--color-warning)',
                  fontSize: 10,
                }}
              />
            )}
            {callWall != null && (
              <ReferenceLine
                y={callWall}
                stroke="var(--color-bear)"
                strokeDasharray="4 2"
                label={{
                  value: 'Call wall',
                  position: 'right',
                  fill: 'var(--color-bear)',
                  fontSize: 10,
                }}
              />
            )}
            {putWall != null && (
              <ReferenceLine
                y={putWall}
                stroke="var(--color-bull)"
                strokeDasharray="4 2"
                label={{
                  value: 'Put wall',
                  position: 'right',
                  fill: 'var(--color-bull)',
                  fontSize: 10,
                }}
              />
            )}
            <Bar dataKey="net_gex" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
