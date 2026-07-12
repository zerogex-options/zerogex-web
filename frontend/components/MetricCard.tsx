'use client';

import { Info } from 'lucide-react';
import { MetricCardProps } from '@/core/types';
import TooltipWrapper from './TooltipWrapper';

export default function MetricCard({
  title,
  value,
  subtitle,
  subtitleColor,
  trend = 'neutral',
  tooltip,
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
          <h3 className="zg-eyebrow">{title}</h3>
        </div>
        <TooltipWrapper text={tooltip}>
          <Info size={14} />
        </TooltipWrapper>
      </div>
      <div
        className="zg-metric text-3xl sm:text-4xl mb-2 break-words"
        style={{
          color: trendColors[trend],
        }}
      >
        {value}
      </div>
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
