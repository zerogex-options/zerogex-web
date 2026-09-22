'use client';

/**
 * ConeReliabilityPanel — does a published hold probability mean what it says?
 *
 * This is the panel the intraday cone exists to earn. Anyone can draw a band
 * and print a percentage on it; the number is worth nothing until somebody can
 * check whether 73% holds 73% of the time. A Brier score alone cannot answer
 * that — a model that never strays from the middle of the distribution scores
 * respectably while telling you nothing — so the reliability table is the
 * headline and the score is the footnote.
 *
 * Three rules this panel holds to, all of them about not flattering ourselves:
 *
 * 1. **The baseline is shown next to the score, always.** The bar to clear is
 *    "always predict the base rate". A cone that cannot beat that has
 *    demonstrated something about the base rate and nothing about the market.
 * 2. **A thin sample publishes no verdict.** Below the API's minimum the
 *    verdict reads "building history" rather than a number that would look
 *    like precision and be noise.
 * 3. **Overconfidence is rendered, not summarized.** Each bucket shows
 *    predicted against realized on the same axis, so a band that came in under
 *    its promise is visible as a shortfall rather than averaged away.
 *
 * Color is never load-bearing alone: every bucket carries its numbers and a
 * signed gap in text beside the bars.
 */

import { useMemo, useState } from 'react';

import { useChartTheme } from '@/hooks/useChartTheme';
import Panel from '@/components/layout/Panel';
import {
  useConeReliability,
  type ConeScoreBlock,
  type ReliabilityBucket,
} from '@/hooks/useIntradayCone';

const HORIZON_LABELS: Record<string, string> = {
  '30': '+30m',
  '60': '+1h',
  '90': '+90m',
  '120': '+2h',
};

function pct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function score(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(3);
}

/**
 * One reliability row. The two bars share an axis so the gap between what was
 * promised and what happened is a length difference, not a color difference.
 */
function BucketRow({ bucket, theme }: { bucket: ReliabilityBucket; theme: ReturnType<typeof useChartTheme> }) {
  // Negative gap = realized fell short of predicted = overconfident.
  const overconfident = bucket.gap < 0;
  const gapColor = Math.abs(bucket.gap) < 0.05 ? theme.textDim : overconfident ? theme.bear : theme.bull;

  return (
    <div className="grid grid-cols-[72px_1fr_92px] items-center gap-3 py-2">
      <div className="text-[11px] tabular-nums" style={{ color: theme.textDim }}>
        {pct(bucket.bucket_low)}–{pct(bucket.bucket_high)}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-sm" style={{ background: theme.bgHover }}>
            <div
              className="h-full"
              style={{ width: `${bucket.predicted * 100}%`, background: theme.textMuted }}
            />
          </div>
          <span className="w-9 text-right text-[11px] tabular-nums" style={{ color: theme.textMuted }}>
            {pct(bucket.predicted)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-sm" style={{ background: theme.bgHover }}>
            <div
              className="h-full"
              style={{ width: `${bucket.realized * 100}%`, background: theme.accent }}
            />
          </div>
          <span className="w-9 text-right text-[11px] tabular-nums" style={{ color: theme.text }}>
            {pct(bucket.realized)}
          </span>
        </div>
      </div>

      <div className="text-right">
        <div className="text-[12px] font-medium tabular-nums" style={{ color: gapColor }}>
          {bucket.gap >= 0 ? '+' : ''}
          {pct(bucket.gap, 1)}
        </div>
        <div className="text-[10px] tabular-nums" style={{ color: theme.textMuted }}>
          n={bucket.n}
        </div>
      </div>
    </div>
  );
}

/** The verdict line. Deliberately capable of saying "we lose". */
function BaselineVerdict({ block, theme }: { block: ConeScoreBlock; theme: ReturnType<typeof useChartTheme> }) {
  const min = block.min_sample ?? 40;

  if (block.n === 0) {
    return (
      <span style={{ color: theme.textMuted }}>
        No graded claims yet — nothing to report.
      </span>
    );
  }
  if (block.beats_baseline === null) {
    return (
      <span style={{ color: theme.textMuted }}>
        Building history — {block.n} of {min} graded claims needed before a verdict.
      </span>
    );
  }
  if (block.beats_baseline) {
    return (
      <span style={{ color: theme.bull }}>
        Beats the base-rate baseline ({score(block.brier)} vs {score(block.baseline_brier)}).
      </span>
    );
  }
  return (
    <span style={{ color: theme.warning }}>
      Does not beat the base-rate baseline ({score(block.brier)} vs{' '}
      {score(block.baseline_brier)}) — published, not counted as a win.
    </span>
  );
}

function ScoreTiles({ block, theme }: { block: ConeScoreBlock; theme: ReturnType<typeof useChartTheme> }) {
  const tiles = [
    {
      label: 'Brier',
      value: score(block.brier),
      hint: 'Lower is better. 0 is perfect, 0.25 is a coin flip.',
    },
    {
      label: 'Baseline to beat',
      value: score(block.baseline_brier),
      hint: 'Always predicting the base rate. The cone must score below this.',
    },
    {
      label: 'Calibration error',
      value: pct(block.calibration_error, 1),
      hint: 'Mean gap between what was promised and what happened, weighted by sample.',
    },
    {
      label: 'Claims graded',
      value: block.n.toLocaleString(),
      hint: 'Each is one band at one horizon, graded against the tape.',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} title={t.hint}>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: theme.textMuted }}>
            {t.label}
          </div>
          <div className="text-[19px] font-semibold tabular-nums" style={{ color: theme.text }}>
            {t.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ConeReliabilityPanel({
  symbol = 'SPY',
  window = 30,
}: {
  symbol?: string;
  window?: number;
}) {
  const theme = useChartTheme();
  const { data, loading, error } = useConeReliability(symbol, window);
  const [horizon, setHorizon] = useState<string>('overall');

  const block: ConeScoreBlock | null = useMemo(() => {
    if (!data) return null;
    return horizon === 'overall' ? data.overall : data.by_horizon?.[horizon] ?? null;
  }, [data, horizon]);

  if (loading && !data) {
    return (
      <Panel>
        <div className="text-[13px]" style={{ color: theme.textMuted }}>
          Loading the cone track record…
        </div>
      </Panel>
    );
  }

  if (error || !data || !block) {
    return (
      <Panel>
        <div className="text-[13px]" style={{ color: theme.textMuted }}>
          The cone track record is unavailable right now.
        </div>
      </Panel>
    );
  }

  const tabs = ['overall', ...Object.keys(data.by_horizon ?? {})];

  return (
    <Panel>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold" style={{ color: theme.text }}>
          Does the cone mean what it says?
        </h2>
        <div className="text-[11px] tabular-nums" style={{ color: theme.textMuted }}>
          {data.sessions_covered} session{data.sessions_covered === 1 ? '' : 's'}
          {data.first_session ? ` · ${data.first_session} → ${data.last_session}` : ''}
        </div>
      </div>

      <p className="mt-2 max-w-[68ch] text-[12px] leading-relaxed" style={{ color: theme.textDim }}>
        {data.definition}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {tabs.map((key) => {
          const active = key === horizon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setHorizon(key)}
              className="rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors"
              style={{
                background: active ? theme.accentSoft : 'transparent',
                color: active ? theme.accent : theme.textDim,
                border: `1px solid ${active ? theme.accent : theme.border}`,
              }}
            >
              {key === 'overall' ? 'All horizons' : HORIZON_LABELS[key] ?? `+${key}m`}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <ScoreTiles block={block} theme={theme} />
      </div>

      <div className="mt-3 text-[12px] leading-relaxed">
        <BaselineVerdict block={block} theme={theme} />
      </div>

      <hr className="my-5 border-0 border-t" style={{ borderColor: theme.border }} />

      <div className="flex items-baseline justify-between">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: theme.textDim }}>
          Promised vs. delivered
        </h3>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: theme.textMuted }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-4 rounded-sm" style={{ background: theme.textMuted }} />
            predicted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-4 rounded-sm" style={{ background: theme.accent }} />
            realized
          </span>
        </div>
      </div>

      {block.reliability.length === 0 ? (
        <div className="py-4 text-[12px]" style={{ color: theme.textMuted }}>
          No graded claims in this window yet.
        </div>
      ) : (
        <div className="mt-2 divide-y" style={{ borderColor: theme.border }}>
          {block.reliability.map((bucket) => (
            <BucketRow key={`${bucket.bucket_low}-${bucket.bucket_high}`} bucket={bucket} theme={theme} />
          ))}
        </div>
      )}

      <p className="mt-4 max-w-[68ch] text-[11px] leading-relaxed" style={{ color: theme.textMuted }}>
        A band nobody forecast into is omitted rather than shown as a zero — an
        empty bucket is not a bucket that was wrong. Claims whose window never
        produced bars are excluded from every number here rather than being
        scored either way.
      </p>
    </Panel>
  );
}
