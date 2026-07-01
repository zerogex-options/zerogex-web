'use client';

import { Info } from 'lucide-react';
import { MetricCardProps } from '@/core/types';
import { colors } from '@/core/colors';
import TooltipWrapper from './TooltipWrapper';
import ExpandableCard from './ExpandableCard';
import { useTheme } from '@/core/ThemeContext';

export default function MetricCard({
  title,
  value,
  subtitle,
  subtitleColor,
  trend = 'neutral',
  tooltip,
  icon,
  theme,
  contextBadge,
}: MetricCardProps) {
  const { theme: activeTheme } = useTheme();
  const resolvedTheme = activeTheme || theme;
  const trendColors = {
    bullish: 'var(--color-bull)',
    bearish: 'var(--color-bear)',
    neutral: "var(--text-primary)",
  };

  return (
    <ExpandableCard className="h-full">
      <div
      className="h-full p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] flex flex-col"
      style={{
        backgroundColor: "var(--bg-card)",
        border: `1px solid ${'var(--text-secondary)'}`,
        boxShadow: resolvedTheme === 'dark' 
          ? '0 4px 12px var(--color-info-soft), 0 1px 3px var(--color-info-soft)' 
          : '0 4px 12px var(--color-info-soft), 0 1px 3px var(--border-subtle)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = resolvedTheme === 'dark'
          ? '0 8px 20px var(--color-info-soft), 0 2px 6px var(--color-info-soft)'
          : '0 8px 20px var(--color-info-soft), 0 2px 6px var(--color-info-soft)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = resolvedTheme === 'dark'
          ? '0 4px 12px var(--color-info-soft), 0 1px 3px var(--color-info-soft)'
          : '0 4px 12px var(--color-info-soft), 0 1px 3px var(--border-subtle)';
      }}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          {icon && <div style={{ color: 'var(--text-secondary)' }}>{icon}</div>}
          <h3 
            className="text-xs font-semibold tracking-wider uppercase"
            style={{ color: 'var(--text-secondary)' }}
          >
            {title}
          </h3>
        </div>
        <TooltipWrapper text={tooltip}>
          <Info size={14} />
        </TooltipWrapper>
      </div>
      <div
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 break-words"
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
    </ExpandableCard>
  );
}
