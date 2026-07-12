'use client';

import { useChartTheme } from '@/hooks/useChartTheme';
import { useForcedFlowBacktest } from '@/hooks/useApiData';

interface ForcedFlowTrackRecordProps {
  symbol?: string;
  lookbackDays?: number;
}

function formatPct(value: number | null, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '--';
  return `${(value * 100).toFixed(digits)}%`;
}

function formatSignedPct(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '--';
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export default function ForcedFlowTrackRecord({
  symbol = 'SPY',
  lookbackDays = 180,
}: ForcedFlowTrackRecordProps) {
  const chart = useChartTheme();
  const { data, loading, error } = useForcedFlowBacktest(symbol, lookbackDays);

  const textColor = 'var(--text-primary)';
  const evaluated = data?.evaluated_sessions ?? 0;
  const hasSample = !!data && evaluated > 0;

  // Edge over the naive "always guess the more common direction" baseline is
  // the honest read: green only when the signal genuinely beats a coin lean.
  const edge = data?.edge ?? null;
  const edgeColor =
    edge == null ? 'var(--text-secondary)' : edge > 0.005 ? chart.bull : edge < -0.005 ? chart.bear : chart.warning;

  return (
    <div
      className="rounded-2xl p-6"
      style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${'var(--text-secondary)'}` }}
    >
      <div className="mb-1 flex items-baseline gap-2 flex-wrap">
        <h3 className="zg-h3" style={{ color: textColor }}>
          Charm-into-Close · Track Record
        </h3>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {symbol}
        </span>
      </div>
      <p className="mb-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
        Did the morning charm-flow sign lean the same way as the actual noon → close move? Scored
        honestly against a naive directional baseline — a hit rate at or below the baseline is worth
        nothing.
      </p>

      {error ? (
        <div className="flex items-center justify-center h-[160px] text-sm" style={{ color: chart.bear }}>
          {error === 'No data available yet' ? 'No track record yet.' : `Failed to load track record: ${error}`}
        </div>
      ) : loading && !data ? (
        <div className="flex items-center justify-center h-[160px] text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading track record…
        </div>
      ) : !hasSample ? (
        <div
          className="flex flex-col items-center justify-center gap-1 h-[160px] text-sm text-center"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span className="text-base font-semibold" style={{ color: textColor }}>
            Collecting sessions…
          </span>
          <span className="text-xs">
            {data ? `${data.total_sessions} session${data.total_sessions === 1 ? '' : 's'} recorded, ` : ''}
            not enough decisive days yet to score a hit rate.
          </span>
        </div>
      ) : (
        <>
          {/* Headline stat row. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <Stat label="Hit rate" value={formatPct(data!.hit_rate, 1)} valueColor={textColor} big />
            <Stat label="Baseline" value={formatPct(data!.baseline_rate, 1)} valueColor="var(--text-secondary)" />
            <Stat
              label="Edge vs. baseline"
              value={edge == null ? '--' : `${edge >= 0 ? '+' : ''}${(edge * 100).toFixed(1)}pt`}
              valueColor={edgeColor}
            />
            <Stat
              label="Signal / session"
              value={data!.signal_mean_return == null ? '--' : formatSignedPct(data!.signal_mean_return)}
              valueColor={
                data!.signal_mean_return == null
                  ? 'var(--text-secondary)'
                  : data!.signal_mean_return >= 0
                    ? chart.bull
                    : chart.bear
              }
            />
          </div>

          <div className="mb-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {data!.hits} of {evaluated} decisive session{evaluated === 1 ? '' : 's'} over the last{' '}
            {data!.lookback_days} days
            {data!.total_sessions > evaluated ? ` (${data!.total_sessions - evaluated} flat/undecided excluded)` : ''}.
          </div>

          {/* Recent sessions ledger. */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ color: textColor }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                  <th className="py-1.5 pr-3 font-semibold uppercase tracking-wider text-[10px]">Date</th>
                  <th className="py-1.5 pr-3 font-semibold uppercase tracking-wider text-[10px]">Charm call</th>
                  <th className="py-1.5 pr-3 font-semibold uppercase tracking-wider text-[10px] text-right">
                    Noon → close
                  </th>
                  <th className="py-1.5 font-semibold uppercase tracking-wider text-[10px] text-right">Result</th>
                </tr>
              </thead>
              <tbody>
                {data!.records.slice(0, 12).map((r) => {
                  const predBuy = r.predicted_dir > 0;
                  return (
                    <tr key={r.date} style={{ borderTop: `1px solid ${chart.gridLine}` }}>
                      <td className="py-1.5 pr-3 font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {r.date}
                      </td>
                      <td className="py-1.5 pr-3 font-semibold" style={{ color: predBuy ? chart.bull : chart.bear }}>
                        {predBuy ? 'Buy' : 'Sell'}
                      </td>
                      <td
                        className="py-1.5 pr-3 font-mono text-right"
                        style={{ color: r.realized_dir > 0 ? chart.bull : chart.bear }}
                      >
                        {formatSignedPct(r.return_pct)}
                      </td>
                      <td className="py-1.5 text-right font-semibold" style={{ color: r.hit ? chart.bull : chart.bear }}>
                        {r.hit ? '✓ Hit' : '✗ Miss'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Signal / session is the mean of (charm direction × noon → close return) — the pre-cost
            drift of taking the charm sign at noon and closing at the bell. Educational only; not a
            trade recommendation.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  valueColor,
  big = false,
}: {
  label: string;
  value: string;
  valueColor: string;
  big?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className={big ? 'text-3xl font-bold' : 'text-xl font-bold'} style={{ color: valueColor }}>
        {value}
      </div>
    </div>
  );
}
