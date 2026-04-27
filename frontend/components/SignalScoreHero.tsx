'use client';

import type { ReactNode } from 'react';
import ExpandableCard from './ExpandableCard';
import SignalSparkline from './SignalSparkline';
import TooltipWrapper from './TooltipWrapper';
import {
  type ScoreHistoryPoint,
  type SignalTrend,
  trendColor,
} from '@/core/signalHelpers';

export interface SignalScoreHeroProps {
  /** Numeric score, or null when unavailable. */
  score: number | null;
  /** Display label above the score number. Defaults to "Score". */
  scoreLabel?: string;
  /** Subtitle below the score (e.g. "Range −100 to +100"). */
  scoreRangeLabel?: string;
  /** Sparkline domain min, defaults to -100. */
  sparklineMin?: number;
  /** Sparkline domain max, defaults to +100. */
  sparklineMax?: number;
  /** Number of decimal places when rendering the score. Defaults to 2. */
  decimals?: number;
  /** Custom rendering for the score (overrides `decimals`). */
  formatScore?: (score: number) => string;
  /** Color trend driving score color and sparkline tint. */
  trend: SignalTrend;
  /** One-line plain-text interpretation of the current score. */
  interpretation?: string;
  /** Optional pills / badges rendered just under the score number. */
  badges?: ReactNode;
  /** Optional small note rendered between interpretation and history. */
  footnote?: ReactNode;
  /** Tooltip explaining what the score means. Renders an info button beside the label. */
  scoreTooltip?: string;
  /** Score history points for the expandable sparkline. */
  history: ScoreHistoryPoint[];
}

/**
 * Standardized "score column" used as the left half of every signal-detail
 * page hero. Pages compose this with their own right-column visuals so the
 * score, interpretation, and score-history layout stay identical across
 * Basic and Advanced signals.
 */
export default function SignalScoreHero({
  score,
  scoreLabel = 'Score',
  scoreRangeLabel = 'Range −100 to +100',
  sparklineMin = -100,
  sparklineMax = 100,
  decimals = 2,
  formatScore,
  trend,
  interpretation,
  badges,
  footnote,
  scoreTooltip,
  history,
}: SignalScoreHeroProps) {
  const color = trendColor(trend);
  const display = score == null
    ? '—'
    : formatScore
      ? formatScore(score)
      : score.toFixed(decimals);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">
        <span>{scoreLabel}</span>
        {scoreTooltip && (
          <TooltipWrapper text={scoreTooltip} placement="bottom">
            <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
          </TooltipWrapper>
        )}
      </div>
      <div
        className="text-6xl font-black leading-none"
        style={{ color, fontVariantNumeric: 'tabular-nums' }}
      >
        {display}
      </div>
      {scoreRangeLabel && (
        <div className="text-[11px] text-[var(--color-text-secondary)] mt-1 uppercase tracking-wide">
          {scoreRangeLabel}
        </div>
      )}
      {badges && <div className="mt-3 flex flex-wrap items-center gap-2">{badges}</div>}
      {interpretation && (
        <div className="mt-3 text-lg font-semibold text-[var(--color-text-primary)]">
          {interpretation}
        </div>
      )}
      {footnote && (
        <div className="mt-2 text-xs text-[var(--color-text-secondary)] leading-relaxed">
          {footnote}
        </div>
      )}
      <ExpandableCard
        className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3"
        expandTrigger="button"
        expandButtonLabel="Expand score history"
      >
        <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
          Score history
        </div>
        <SignalSparkline
          points={history}
          strokeColor={color}
          fillColor={`${color}1f`}
          height={56}
          min={sparklineMin}
          max={sparklineMax}
        />
      </ExpandableCard>
    </div>
  );
}
