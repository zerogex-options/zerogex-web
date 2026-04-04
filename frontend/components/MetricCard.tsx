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
  trend = 'neutral',
  tooltip,
  icon,
  theme,
}: MetricCardProps) {
  const { theme: activeTheme } = useTheme();
  const resolvedTheme = activeTheme || theme;
  const trendColors = {
    bullish: colors.bullish,
    bearish: colors.bearish,
    neutral: resolvedTheme === 'dark' ? colors.light : colors.dark,
  };

  return (
    <ExpandableCard className="h-full">
      <div
      className="h-full p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] flex flex-col"
      style={{
        backgroundColor: resolvedTheme === 'dark' ? colors.cardDark : colors.cardLight,
        border: `1px solid ${colors.muted}`,
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
          {icon && <div style={{ color: colors.muted }}>{icon}</div>}
          <h3 
            className="text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            {title}
          </h3>
        </div>
        <TooltipWrapper text={tooltip}>
          <Info size={14} />
        </TooltipWrapper>
      </div>
      <div 
        className="text-4xl font-bold mb-2"
        style={{ 
          color: trendColors[trend]
        }}
      >
        {value}
      </div>
      {subtitle && (
        <div 
          className="text-sm font-semibold"
          style={{ color: colors.muted }}
        >
          {subtitle}
        </div>
      )}
      </div>
    </ExpandableCard>
  );
}
