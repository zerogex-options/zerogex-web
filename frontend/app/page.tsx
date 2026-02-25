'use client';

import { useEffect, useState } from 'react';
import { Target, Activity, Scale, Zap, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Area, AreaChart } from 'recharts';
import MetricCard from '@/components/MetricCard';
import TooltipWrapper from '@/components/TooltipWrapper';
import { colors } from '@/core/colors';
import { GEXStrikeData } from '@/core/types';
import { Info } from 'lucide-react';

// Mock data - will be replaced with real API
const mockGEXData: GEXStrikeData[] = [
  { strike: 575, gex: 1.2, type: 'support' },
  { strike: 580, gex: 2.8, type: 'support' },
  { strike: 585, gex: 0.4, type: 'neutral' },
  { strike: 590, gex: -0.8, type: 'resistance' },
  { strike: 595, gex: -1.5, type: 'resistance' },
];

const mockFlowData = [
  { time: '09:30', calls: 850, puts: 420, net: 430 },
  { time: '10:00', calls: 1200, puts: 680, net: 520 },
  { time: '10:30', calls: 950, puts: 890, net: 60 },
  { time: '11:00', calls: 1450, puts: 720, net: 730 },
  { time: '11:30', calls: 2450, puts: 1890, net: 560 },
];

const mockSmartMoneyTrades = [
  { time: '11:28', symbol: 'SPY 590C 2/28', size: 500, notional: '$125K', iv: '0.62', score: 8, type: 'call' },
  { time: '11:25', symbol: 'SPY 575P 2/28', size: 350, notional: '$89K', iv: '0.58', score: 7, type: 'put' },
  { time: '11:20', symbol: 'SPY 585C 3/01', size: 280, notional: '$156K', iv: '0.45', score: 6, type: 'call' },
];

export default function DashboardPage() {

  import { useTheme } from '@/core/ThemeContext';

  // Inside component
  const theme = useTheme();

  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <div>
        <h2 
          className="text-3xl font-bold mb-6"
          style={{ color: theme === 'dark' ? colors.light : colors.dark }}
        >
          Critical Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            theme={theme}
            title="GEX Flip Point"
            value="$583.50"
            subtitle="Below Flip"
            trend="bearish"
            icon={<Target size={18} />}
            tooltip="The price level where dealer gamma exposure changes from positive to negative. Below this level, dealers amplify moves by hedging (destabilizing). Above it, they dampen moves (stabilizing)."
          />
          <MetricCard
            theme={theme}
            title="Max Pain"
            value="$580.00"
            subtitle="Above Max Pain"
            trend="bullish"
            icon={<Activity size={18} />}
            tooltip="The strike price where option holders lose the most money at expiration. Market makers have incentive to push price toward this level to maximize option decay profits."
          />
          <MetricCard
            theme={theme}
            title="Put/Call Ratio"
            value="0.87"
            subtitle="Bullish Sentiment"
            trend="bullish"
            icon={<Scale size={18} />}
            tooltip="Ratio of put volume to call volume. Below 1.0 indicates more call buying (bullish). Above 1.0 indicates more put buying (bearish). Extreme readings (>1.5 or <0.5) can signal reversal."
          />
          <MetricCard
            theme={theme}
            title="Net Option Flow"
            value="+$2.4M"
            subtitle="Call Dominated"
            trend="bullish"
            icon={<Zap size={18} />}
            tooltip="Net notional value of call flow minus put flow in the last 30 minutes. Positive indicates more money flowing into calls (bullish bias). Negative indicates put accumulation (bearish bias)."
          />
        </div>
      </div>

      {/* GEX Chart */}
      <div
        className="p-8 rounded-2xl"
        style={{
          backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
        }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 
            className="text-2xl font-bold"
            style={{ color: theme === 'dark' ? colors.light : colors.dark }}
          >
            Gamma Exposure by Strike
          </h2>
          <TooltipWrapper text="Shows dealer gamma exposure at each strike. Positive GEX (green) acts as support - dealers buy dips and sell rallies. Negative GEX (red) acts as resistance - dealers amplify moves. Largest absolute values are key levels.">
            <Info size={18} />
          </TooltipWrapper>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={mockGEXData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.3} />
            <XAxis 
              type="number" 
              stroke={colors.muted}
              tick={{ fontSize: 12, fontWeight: 600, fill: colors.muted }}
            />
            <YAxis 
              dataKey="strike" 
              type="category" 
              stroke={colors.muted}
              tick={{ fontSize: 12, fontWeight: 600, fill: colors.muted }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
                border: `1px solid ${colors.muted}`,
                borderRadius: '8px',
                color: theme === 'dark' ? colors.light : colors.dark,
              }}
            />
            <Bar dataKey="gex" radius={[0, 8, 8, 0]}>
              {mockGEXData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.gex > 0 ? colors.bullish : entry.gex < 0 ? colors.bearish : colors.muted}
                  opacity={0.9}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Flow & Hedging */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Flow */}
        <div
          className="p-8 rounded-2xl"
          style={{
            backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
            border: `1px solid ${colors.muted}`,
          }}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 
              className="text-xl font-bold"
              style={{ color: theme === 'dark' ? colors.light : colors.dark }}
            >
              Live Options Flow
            </h2>
            <TooltipWrapper text="Real-time options volume split between calls and puts. Shows directional bias from recent options trading. Large divergences between calls and puts indicate strong conviction.">
              <Info size={18} />
            </TooltipWrapper>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={mockFlowData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.bullish} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={colors.bullish} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="putGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.bearish} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={colors.bearish} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.3} />
              <XAxis 
                dataKey="time" 
                stroke={colors.muted}
                tick={{ fontSize: 11, fontWeight: 600, fill: colors.muted }}
              />
              <YAxis 
                stroke={colors.muted}
                tick={{ fontSize: 11, fontWeight: 600, fill: colors.muted }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
                  border: `1px solid ${colors.muted}`,
                  borderRadius: '8px',
                  color: theme === 'dark' ? colors.light : colors.dark,
                }}
              />
              <Area 
                type="monotone" 
                dataKey="calls" 
                stroke={colors.bullish} 
                strokeWidth={2.5} 
                fill="url(#callGradient)"
                name="Calls" 
              />
              <Area 
                type="monotone" 
                dataKey="puts" 
                stroke={colors.bearish} 
                strokeWidth={2.5} 
                fill="url(#putGradient)"
                name="Puts" 
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div 
                className="text-xs font-semibold uppercase mb-1"
                style={{ color: colors.muted }}
              >
                Calls
              </div>
              <div className="text-xl font-bold" style={{ color: colors.bullish }}>
                2,450
              </div>
              <div className="text-sm font-mono" style={{ color: colors.muted }}>
                $1.2M
              </div>
            </div>
            <div className="text-center">
              <div 
                className="text-xs font-semibold uppercase mb-1"
                style={{ color: colors.muted }}
              >
                Puts
              </div>
              <div className="text-xl font-bold" style={{ color: colors.bearish }}>
                1,890
              </div>
              <div className="text-sm font-mono" style={{ color: colors.muted }}>
                $0.8M
              </div>
            </div>
            <div className="text-center">
              <div 
                className="text-xs font-semibold uppercase mb-1"
                style={{ color: colors.muted }}
              >
                Net
              </div>
              <div className="text-xl font-bold" style={{ color: colors.bullish }}>
                +560
              </div>
              <div className="text-sm font-mono" style={{ color: colors.muted }}>
                +$400K
              </div>
            </div>
          </div>
        </div>

        {/* Dealer Hedging */}
        <div
          className="p-8 rounded-2xl"
          style={{
            backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
            border: `1px solid ${colors.muted}`,
          }}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 
              className="text-xl font-bold"
              style={{ color: theme === 'dark' ? colors.light : colors.dark }}
            >
              Dealer Hedging Pressure
            </h2>
            <TooltipWrapper text="Expected dealer hedging flow based on recent price movements and open gamma exposure. When dealers are forced to buy (green) or sell (red) stock to maintain delta-neutral positions, it can amplify price moves.">
              <Info size={18} />
            </TooltipWrapper>
          </div>
          <div className="flex flex-col items-center justify-center h-64">
            <div 
              className="w-32 h-32 rounded-full flex items-center justify-center mb-4"
              style={{
                background: `radial-gradient(circle, ${colors.bullish}30, ${colors.bullish}10)`,
                border: `2px solid ${colors.bullish}60`,
              }}
            >
              <TrendingUp size={48} strokeWidth={2} style={{ color: colors.bullish }} />
            </div>
            <div className="text-2xl font-bold mb-2" style={{ color: colors.bullish }}>
              Strong Buying Pressure
            </div>
            <div 
              className="text-lg font-mono"
              style={{ color: colors.muted }}
            >
              +125K shares
            </div>
            <div 
              className="mt-4 text-sm text-center max-w-xs leading-relaxed"
              style={{ color: colors.muted }}
            >
              Dealers need to buy underlying to hedge gamma exposure as price rises
            </div>
          </div>
        </div>
      </div>

      {/* Smart Money Table */}
      <div
        className="p-8 rounded-2xl overflow-hidden"
        style={{
          backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
        }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 
            className="text-2xl font-bold"
            style={{ color: theme === 'dark' ? colors.light : colors.dark }}
          >
            Smart Money Flow
          </h2>
          <TooltipWrapper text="Large block trades, high IV plays, and deep OTM options that may indicate informed trading. Score (0-10) weights size, notional value, IV, and time to expiration. Scores 7+ deserve attention.">
            <Info size={18} />
          </TooltipWrapper>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr 
                className="border-b" 
                style={{ borderColor: colors.muted }}
              >
                <th 
                  className="text-left py-4 px-4 text-xs font-semibold uppercase"
                  style={{ color: colors.muted }}
                >
                  Time
                </th>
                <th 
                  className="text-left py-4 px-4 text-xs font-semibold uppercase"
                  style={{ color: colors.muted }}
                >
                  Symbol
                </th>
                <th 
                  className="text-right py-4 px-4 text-xs font-semibold uppercase"
                  style={{ color: colors.muted }}
                >
                  Size
                </th>
                <th 
                  className="text-right py-4 px-4 text-xs font-semibold uppercase"
                  style={{ color: colors.muted }}
                >
                  Notional
                </th>
                <th 
                  className="text-right py-4 px-4 text-xs font-semibold uppercase"
                  style={{ color: colors.muted }}
                >
                  IV
                </th>
                <th 
                  className="text-right py-4 px-4 text-xs font-semibold uppercase"
                  style={{ color: colors.muted }}
                >
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {mockSmartMoneyTrades.map((trade, idx) => (
                <tr 
                  key={idx} 
                  className="border-b"
                  style={{ borderColor: colors.muted }}
                >
                  <td 
                    className="py-4 px-4 text-sm font-mono"
                    style={{ color: colors.muted }}
                  >
                    {trade.time}
                  </td>
                  <td 
                    className="py-4 px-4 font-semibold"
                    style={{ color: theme === 'dark' ? colors.light : colors.dark }}
                  >
                    {trade.symbol}
                  </td>
                  <td 
                    className="py-4 px-4 text-right font-mono"
                    style={{ color: theme === 'dark' ? colors.light : colors.dark }}
                  >
                    {trade.size}
                  </td>
                  <td 
                    className="py-4 px-4 text-right font-bold"
                    style={{ color: theme === 'dark' ? colors.light : colors.dark }}
                  >
                    {trade.notional}
                  </td>
                  <td 
                    className="py-4 px-4 text-right font-mono text-sm"
                    style={{ color: theme === 'dark' ? colors.light : colors.dark }}
                  >
                    {trade.iv}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span
                      className="px-3 py-1.5 rounded-lg font-bold text-sm inline-block"
                      style={{
                        backgroundColor: trade.score >= 8 
                          ? `${colors.bearish}20` 
                          : trade.score >= 6 
                            ? `${colors.bullish}20` 
                            : `${colors.muted}20`,
                        color: trade.score >= 8 
                          ? colors.bearish 
                          : trade.score >= 6 
                            ? colors.bullish 
                            : colors.muted,
                        border: `1px solid ${
                          trade.score >= 8 
                            ? colors.bearish 
                            : trade.score >= 6 
                              ? colors.bullish 
                              : colors.muted
                        }40`,
                      }}
                    >
                      {trade.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
