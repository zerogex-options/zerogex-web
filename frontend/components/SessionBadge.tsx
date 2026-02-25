'use client';

import { MarketSession, Theme } from '@/lib/types';
import { colors } from '@/lib/colors';

interface SessionBadgeProps {
  session: MarketSession;
  theme: Theme;
}

export default function SessionBadge({ session, theme }: SessionBadgeProps) {
  const badges = {
    'open': { label: 'MARKET OPEN', color: colors.bullish, icon: '●' },
    'pre-market': { label: 'PRE-MARKET', color: colors.muted, icon: '○' },
    'after-hours': { label: 'AFTER HOURS', color: colors.muted, icon: '○' },
    'closed': { label: 'CLOSED', color: colors.bearish, icon: '●' },
    'halted': { label: 'HALTED', color: '#eab308', icon: '▲' },
    'closed-weekend': { label: 'CLOSED', color: colors.bearish, icon: '●' },
  };

  const badge = badges[session];

  return (
    <div
      className="px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider flex items-center gap-2"
      style={{
        backgroundColor: theme === 'dark' ? `${badge.color}15` : `${badge.color}10`,
        color: badge.color,
        border: `1px solid ${badge.color}40`,
      }}
    >
      <span className="text-base leading-none">{badge.icon}</span>
      {badge.label}
    </div>
  );
}
