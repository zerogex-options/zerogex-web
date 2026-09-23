'use client';

import { Info } from 'lucide-react';
import { MetricCardProps } from '@/core/types';
import TooltipWrapper from './TooltipWrapper';
import AutoFitValue from './AutoFitValue';

export default function MetricCard({
  title,
  value,
  subtitle,
  subtitleColor,
  trend = 'neutral',
  tooltip,
  tooltipIcon,
  icon,
  contextBadge,
}: MetricCardProps) {
  // Trend keys the value color to direction — bull/bear on data, neutral
  // otherwise. This is the one sanctioned use of semantic color here.
  const trendColors = {
    bullish: 'var(--color-bull)',
    bearish: 'var(--color-bear)',
    neutral: 'var(--text-primary)',
  };

  return (
    <div className="zg-panel h-full p-5 flex flex-col">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          {icon && <div style={{ color: 'var(--text-secondary)' }}>{icon}</div>}
          {/* Phones track the title at 0.06em, not the label's 0.14em, so a
              title in a two-up grid ("Nearest-expiration max pain") wraps
              less. On the span because .zg-eyebrow is unlayered CSS and
              would beat a utility class on the h3 itself. */}
          <h3 className="zg-eyebrow">
            <span className="max-sm:tracking-[0.06em]">{title}</span>
          </h3>
        </div>
        <TooltipWrapper text={tooltip}>
          {tooltipIcon ?? <Info size={14} />}
        </TooltipWrapper>
      </div>
      <AutoFitValue
        className="zg-metric text-3xl sm:text-4xl mb-2"
        style={{ color: trendColors[trend] }}
      >
        {value}
      </AutoFitValue>
      {contextBadge && <div className="mb-2">{contextBadge}</div>}
      {subtitle && (
        <div
          className="text-sm font-semibold break-words"
          style={{ color: subtitleColor || 'var(--text-secondary)' }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
