'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { LivePrice, Theme } from '@/core/types';
import { colors } from '@/core/colors';

interface LivePriceWidgetProps {
  data: LivePrice;
  theme: Theme;
}

export default function LivePriceWidget({ data, theme }: LivePriceWidgetProps) {
  const isPositive = data.change >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? colors.bullish : colors.bearish;

  return (
    <div className="flex items-center gap-4">
      <span className="font-semibold text-sm opacity-60">{data.symbol}</span>
      <span className="font-bold text-2xl">${data.price.toFixed(2)}</span>
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-sm"
        style={{
          backgroundColor: theme === 'dark' ? `${trendColor}15` : `${trendColor}10`,
          color: trendColor,
        }}
      >
        <TrendIcon size={14} strokeWidth={2.5} />
        {isPositive ? '+' : ''}{data.change.toFixed(2)} ({isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%)
      </div>
      <div className="text-sm font-mono opacity-60">
        Vol <span className="font-semibold opacity-90">{data.volume}</span>
      </div>
    </div>
  );
}
