'use client';

import { Info } from 'lucide-react';
import { MetricCardProps } from '@/lib/types';
import { colors } from '@/lib/colors';
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
    neutral: colors.light,
  };

  return (
    <div
      className="p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
      style={{
        backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
        border: `1px solid ${colors.muted}`,
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
          color: theme === 'dark' ? colors.light : colors.dark 
        }}
      >
        {value}
      </div>
      {subtitle && (
        <div 
          className="text-sm font-semibold"
          style={{ color: trendColors[trend] }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
