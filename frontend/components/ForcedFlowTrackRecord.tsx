'use client';

import { useChartTheme } from '@/hooks/useChartTheme';
import {
  useForcedFlowBacktest,
  type ForcedFlowBacktestVariant,
} from '@/hooks/useApiData';

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
  // The full (0DTE-inclusive) variant drives the shared sample check + ledger;
  // the smooth (charm-only) variant rides alongside as the A/B challenger.
  const full = data?.full;
  const smooth = data?.smooth;
  const evaluated = full?.evaluated_sessions ?? 0;
  const hasSample = !!full && evaluated > 0;

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
        nothing. Two definitions run side by side: the <strong>full</strong> close flow (dominated by
        same-day options resolving at the bell) vs. the <strong>charm-only</strong> drift.
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
            {full ? `${full.total_sessions} session${full.total_sessions === 1 ? '' : 's'} recorded, ` : ''}
            not enough decisive days yet to score a hit rate.
          </span>
        </div>
      ) : (
        <>
          {/* A/B: the two forecast definitions, scored over identical sessions. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <VariantPanel
              title="Full close flow"
              subtitle="0DTE-inclusive · what the headline shows"
              variant={full!}
              chart={chart}
              textColor={textColor}
            />
            <VariantPanel
              title="Charm-only"
              subtitle="time-decay drift, ex–expiry resolution"
              variant={smooth}
              chart={chart}
              textColor={textColor}
            />
          </div>

          <div className="mb-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {full!.hits} of {evaluated} decisive session{evaluated === 1 ? '' : 's'} (full) over the last{' '}
            {data!.lookback_days} days
            {full!.total_sessions > evaluated ? ` · ${full!.total_sessions - evaluated} flat/undecided excluded` : ''}.
          </div>

          {/* Recent sessions ledger for the full variant. */}
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
                {full!.records.slice(0, 12).map((r) => {
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
            Each definition carries a 95% Wilson confidence band; the verdict runs a one-sided test that
            the accuracy beats the baseline, and only certifies an edge at 95% once at least 30 decisive
            sessions have accrued. Signal / session is the mean of (charm direction × noon → close return)
            — the pre-cost drift of taking the charm sign at noon and closing at the bell, with its t-stat
            against zero. Educational only; not a trade recommendation.
          </p>
        </>
      )}
    </div>
  );
}

function VariantPanel({
  title,
  subtitle,
  variant,
  chart,
  textColor,
}: {
  title: string;
  subtitle: string;
  variant: ForcedFlowBacktestVariant | undefined;
  chart: ReturnType<typeof useChartTheme>;
  textColor: string;
}) {
  const evaluated = variant?.evaluated_sessions ?? 0;
  const edge = variant?.edge ?? null;
  const edgeColor =
    edge == null
      ? 'var(--text-secondary)'
      : edge > 0.005
        ? chart.bull
        : edge < -0.005
          ? chart.bear
          : chart.warning;
  const significant = variant?.significant ?? false;
  const pValue = variant?.edge_p_value ?? null;
  const verdictColor = significant ? chart.bull : chart.warning;
  const verdictLabel = significant
    ? 'Significant at 95%'
    : evaluated < 30
      ? 'Sample too small'
      : 'Not yet significant';
  const ciLabel =
    variant?.hit_rate_ci_low != null && variant?.hit_rate_ci_high != null
      ? `95% CI ${formatPct(variant.hit_rate_ci_low, 0)}–${formatPct(variant.hit_rate_ci_high, 0)}`
      : null;
  const meanRet = variant?.signal_mean_return ?? null;

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--bg-elevated, rgba(127,127,127,0.05))', border: `1px solid ${chart.gridLine}` }}
    >
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold" style={{ color: textColor }}>
          {title}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold"
          style={{ color: verdictColor }}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: verdictColor }} />
          {verdictLabel}
        </span>
      </div>
      <div className="mb-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {subtitle}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold" style={{ color: textColor }}>
          {formatPct(variant?.hit_rate ?? null, 1)}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          hit rate
        </span>
      </div>
      {ciLabel && (
        <div className="mt-0.5 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
          {ciLabel}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <MiniStat label="Baseline" value={formatPct(variant?.baseline_rate ?? null, 0)} color="var(--text-secondary)" />
        <MiniStat
          label="Edge"
          value={edge == null ? '--' : `${edge >= 0 ? '+' : ''}${(edge * 100).toFixed(1)}pt`}
          color={edgeColor}
        />
        <MiniStat
          label="Signal/day"
          value={meanRet == null ? '--' : formatSignedPct(meanRet)}
          color={meanRet == null ? 'var(--text-secondary)' : meanRet >= 0 ? chart.bull : chart.bear}
        />
      </div>
      {pValue != null && evaluated >= 30 && (
        <div className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          p = {pValue < 0.001 ? '<0.001' : pValue.toFixed(3)}
          {variant?.signal_t_stat != null ? ` · t = ${variant.signal_t_stat.toFixed(2)}` : ''}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
