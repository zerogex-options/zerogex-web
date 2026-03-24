'use client';

import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';

interface ByStrikeRow {
  vanna_exposure?: number | null;
  charm_exposure?: number | null;
}

interface VolExpansionData {
  confidence: 'high' | 'medium' | 'low';
  normalized_score: number;
}

interface CharmVannaFlowsProps {
  byStrikeData: ByStrikeRow[] | null | undefined;
  volExpansion: VolExpansionData | null | undefined;
}

function formatB(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '';
  if (abs >= 1e9) return `${sign}${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(value / 1e6).toFixed(0)}M`;
  return `${sign}${(value / 1e3).toFixed(0)}K`;
}

function getFlowDescription(value: number, type: 'vanna' | 'charm' | 'eod_charm'): string {
  const abs = Math.abs(value);
  if (type === 'vanna') {
    if (value > 1e8) return 'Supports rally on vol crush';
    if (value < -1e8) return 'Supports selloff on vol crush';
    return 'Neutral vanna flow';
  }
  if (type === 'charm') {
    if (abs < 1e8) return 'Mild call decay, neutral';
    if (value > 0) return 'Put decay adding upside delta';
    return 'Call decay adding downside delta';
  }
  // eod_charm
  if (value > 1e8) return 'EOD buy pressure expected';
  if (value < -1e8) return 'EOD sell pressure expected';
  return 'Neutral EOD charm effect';
}

function FlowBar({ value, maxAbs, isDark }: { value: number; maxAbs: number; isDark: boolean }) {
  const width = maxAbs > 0 ? Math.min(100, (Math.abs(value) / maxAbs) * 100) : 0;
  const barColor = value >= 0 ? colors.bullish : colors.primary;

  return (
    <div
      className="h-5 rounded-full overflow-hidden flex-shrink-0"
      style={{
        width: '100px',
        backgroundColor: isDark ? 'rgba(150, 143, 146, 0.15)' : 'rgba(0, 0, 0, 0.06)',
      }}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${Math.max(4, width)}%`,
          backgroundColor: barColor,
        }}
      />
    </div>
  );
}

export default function CharmVannaFlows({ byStrikeData, volExpansion }: CharmVannaFlowsProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? colors.light : colors.dark;

  const rows = byStrikeData || [];
  const totalVanna = rows.reduce((sum, r) => sum + Number(r.vanna_exposure || 0), 0);
  const totalCharm = rows.reduce((sum, r) => sum + Number(r.charm_exposure || 0), 0);
  const eodCharm = totalCharm * 0.6; // EOD charm approximation (accelerated into close)

  const maxAbs = Math.max(Math.abs(totalVanna), Math.abs(totalCharm), Math.abs(eodCharm), 1);

  const volRiskLabel = volExpansion?.confidence === 'high' ? 'High' : volExpansion?.confidence === 'medium' ? 'Medium' : 'Low';
  const volRiskColor = volRiskLabel === 'High' ? colors.bearish : volRiskLabel === 'Medium' ? colors.primary : colors.muted;

  const flowItems = [
    {
      title: 'Vanna (vol\u2192delta)',
      description: getFlowDescription(totalVanna, 'vanna'),
      value: totalVanna,
      color: totalVanna >= 0 ? colors.bullish : colors.primary,
    },
    {
      title: 'Charm (time\u2192delta)',
      description: getFlowDescription(totalCharm, 'charm'),
      value: totalCharm,
      color: totalCharm >= 0 ? colors.bullish : colors.primary,
    },
    {
      title: 'End-of-day charm',
      description: getFlowDescription(eodCharm, 'eod_charm'),
      value: eodCharm,
      color: eodCharm >= 0 ? colors.bullish : colors.primary,
    },
  ];

  return (
    <div
      className="rounded-2xl p-6 h-full"
      style={{
        backgroundColor: isDark ? colors.cardDark : colors.cardLight,
        border: `1px solid ${colors.muted}`,
      }}
    >
      <h3
        className="text-sm font-bold tracking-wider uppercase mb-5"
        style={{ color: textColor }}
      >
        CHARM &amp; VANNA FLOWS
      </h3>

      <div className="flex flex-col gap-5">
        {flowItems.map((item) => (
          <div key={item.title} className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: textColor }}>{item.title}</div>
              <div className="text-xs" style={{ color: colors.muted }}>{item.description}</div>
            </div>
            <div className="text-sm font-bold whitespace-nowrap" style={{ color: item.color }}>
              {formatB(item.value)}
            </div>
            <FlowBar value={item.value} maxAbs={maxAbs} isDark={isDark} />
          </div>
        ))}

        {/* Vol expansion risk */}
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: textColor }}>Vol expansion risk</div>
            <div className="text-xs" style={{ color: colors.muted }}>
              {volRiskLabel === 'Low' ? 'GEX suppressing vol' : volRiskLabel === 'High' ? 'Vol breakout likely' : 'Moderate expansion risk'}
            </div>
          </div>
          <div className="text-sm font-bold italic whitespace-nowrap" style={{ color: volRiskColor }}>
            {volRiskLabel}
          </div>
          <div
            className="h-5 rounded-full flex-shrink-0"
            style={{
              width: '100px',
              backgroundColor: isDark ? 'rgba(150, 143, 146, 0.15)' : 'rgba(0, 0, 0, 0.06)',
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: volRiskLabel === 'High' ? '85%' : volRiskLabel === 'Medium' ? '50%' : '20%',
                backgroundColor: volRiskColor,
                opacity: 0.6,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
