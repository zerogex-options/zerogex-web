'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Info } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import ExpandableCard from './ExpandableCard';
import TooltipWrapper from './TooltipWrapper';
import { useIsMobile } from '@/hooks/useIsMobile';
import MobileScrollableChart from './MobileScrollableChart';

interface StrikeRow {
  strike: number;
  netGexB: number;
}

interface GexStrikeChartProps {
  strikeData: StrikeRow[];
  gammaFlip: number | null | undefined;
  spotPrice: number | null | undefined;
}

function formatB(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1) return `${value.toFixed(1)}B`;
  if (abs >= 0.01) return `${(value * 1000).toFixed(0)}M`;
  return `${(value * 1000).toFixed(1)}M`;
}

export default function GexStrikeChart({ strikeData, gammaFlip, spotPrice }: GexStrikeChartProps) {
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const isDark = theme === 'dark';
  const textColor = isDark ? colors.light : colors.dark;
  const axisStroke = isDark ? 'var(--color-text-primary)' : 'var(--color-text-primary)';
  const gridStroke = isDark ? 'var(--color-text-secondary)' : 'var(--color-border)';

  const flipStrike = gammaFlip != null && strikeData.length > 0
    ? strikeData.reduce((closest, row) =>
        Math.abs(row.strike - gammaFlip) < Math.abs(closest - gammaFlip) ? row.strike : closest,
      strikeData[0].strike)
    : null;

  const renderLegend = () => (
    <div className="w-full flex flex-wrap justify-end items-center gap-4 text-xs" style={{ color: textColor }}>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: colors.bullish }} />
        Positive GEX (pin)
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: colors.bearish }} />
        Negative GEX (accel)
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4" style={{ backgroundColor: colors.primary }} />
        Gamma flip
      </div>
    </div>
  );

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart">
      <div
        className="rounded-2xl p-6 h-full"
        style={{
          backgroundColor: isDark ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <h3
            className="text-sm font-bold tracking-wider uppercase"
            style={{ color: textColor }}
          >
            GEX BY STRIKE
          </h3>
          <TooltipWrapper text="Net gamma exposure by strike for the selected symbol. Bars above zero indicate positive dealer gamma (pinning/mean-reversion); below zero indicate negative gamma (trend acceleration).">
            <Info size={14} />
          </TooltipWrapper>
        </div>

        {strikeData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-sm" style={{ color: colors.muted }}>
            No strike data available
          </div>
        ) : (
          <MobileScrollableChart>
          <ResponsiveContainer width="100%" height={isMobile ? 290 : 340}>
            <BarChart data={strikeData} margin={{ top: 5, right: isMobile ? 4 : 10, left: isMobile ? -12 : 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.3} />
              <XAxis
                dataKey="strike"
                stroke={axisStroke}
                tick={{ fontSize: isMobile ? 8 : 10, fill: axisStroke }}
                tickFormatter={(v) => `${Number(v).toFixed(0)}`}
              />
              <YAxis
                stroke={axisStroke}
                width={isMobile ? 44 : 56}
                tick={{ fontSize: isMobile ? 8 : 10, fill: axisStroke }}
                tickFormatter={(v) => formatB(Number(v))}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-chart-tooltip-bg)',
                  borderColor: 'var(--color-border)',
                  borderRadius: 8,
                  color: 'var(--color-chart-tooltip-text)',
                }}
                labelStyle={{ color: 'var(--color-chart-tooltip-text)' }}
                itemStyle={{ color: 'var(--color-chart-tooltip-muted)' }}
                labelFormatter={(v) => `Strike $${Number(v).toFixed(0)}`}
                formatter={(value) => [`$${formatB(Number(value))}`, 'Net GEX']}
              />
              <Legend verticalAlign="top" align="right" content={renderLegend} wrapperStyle={{ top: 0, right: 0 }} />
              <ReferenceLine y={0} stroke={axisStroke} strokeWidth={1} />
              {flipStrike != null && (
                <ReferenceLine
                  x={flipStrike}
                  stroke={colors.primary}
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                  label={{
                    value: 'Gamma flip',
                    fill: colors.primary,
                    position: 'insideTopRight',
                    fontSize: 10,
                    dy: 4,
                  }}
                />
              )}
              <Bar dataKey="netGexB" barSize={14}>
                {strikeData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.netGexB >= 0 ? colors.bullish : colors.bearish} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </MobileScrollableChart>
        )}
      </div>
    </ExpandableCard>
  );
}
