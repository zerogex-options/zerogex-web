'use client';

import { Info } from 'lucide-react';
import { MetricCardProps } from '@/core/types';
import { colors } from '@/core/colors';
import TooltipWrapper from './TooltipWrapper';

export default function MetricCard({
  title,
  value,
  subtitle,
  trend = 'neutral',
  tooltip,
  icon,
  theme,
}: MetricCardProps) {
  const trendColors = {
    bullish: colors.bullish,
    bearish: colors.bearish,
    neutral: theme === 'dark' ? colors.light : colors.dark,
  };

  return (
    <div
      className="p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
      style={{
        backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
        border: `1px solid ${colors.muted}`,
        boxShadow: theme === 'dark' 
          ? '0 4px 12px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)' 
          : '0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = theme === 'dark'
          ? '0 8px 20px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3)'
          : '0 8px 20px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = theme === 'dark'
          ? '0 4px 12px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)'
          : '0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)';
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
  );
}
