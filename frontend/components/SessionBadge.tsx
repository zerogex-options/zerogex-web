'use client';

import { useState, useEffect } from 'react';
import { MarketSession, Theme } from '@/core/types';
import { colors } from '@/core/colors';

interface SessionBadgeProps {
  session: MarketSession;
  theme: Theme;
  showCountdown?: boolean;
}

export default function SessionBadge({ session, theme, showCountdown = false }: SessionBadgeProps) {
  const [countdown, setCountdown] = useState('');
  const [countdownLabel, setCountdownLabel] = useState('');

  useEffect(() => {
    if (!showCountdown) return;

    const updateCountdown = () => {
      const now = new Date();
      const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

      if (session === 'open') {
        const closeTime = new Date(nyTime);
        closeTime.setHours(16, 0, 0, 0);
        const diff = closeTime.getTime() - nyTime.getTime();
        
        if (diff > 0) {
          const h = Math.floor(diff / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((diff % (1000 * 60)) / 1000);
          setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
          setCountdownLabel('until close');
        }
      } else if (session === 'pre-market') {
        const openTime = new Date(nyTime);
        openTime.setHours(9, 30, 0, 0);
        const diff = openTime.getTime() - nyTime.getTime();
        
        if (diff > 0) {
          const h = Math.floor(diff / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((diff % (1000 * 60)) / 1000);
          setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
          setCountdownLabel('until open');
        }
      } else {
        setCountdown('');
        setCountdownLabel('');
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [session, showCountdown]);

  const badges = {
    'open': { label: 'MARKET OPEN', color: colors.bullish, icon: '●' },
    'pre-market': { label: 'PRE-MARKET', color: colors.muted, icon: '○' },
    'after-hours': { label: 'AFTER HOURS', color: colors.muted, icon: '○' },
    'closed': { label: 'CLOSED', color: colors.bearish, icon: '●' },
    'halted': { label: 'HALTED', color: '#eab308', icon: '▲' },
    'closed-weekend': { label: 'CLOSED (WEEKEND)', color: colors.bearish, icon: '●' },
    'closed-holiday': { label: 'CLOSED (HOLIDAY)', color: colors.bearish, icon: '●' },
  };

  const badge = badges[session] || badges['closed'];

  // Show countdown if toggle is on and countdown exists
  if (showCountdown && countdown) {
    return (
      <div
        className="px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider flex items-center gap-2"
        style={{
          backgroundColor: theme === 'dark' ? `${colors.muted}15` : `${colors.muted}10`,
          color: theme === 'dark' ? colors.light : colors.dark,
          border: `1px solid ${colors.muted}40`,
          boxShadow: theme === 'dark' ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <span className="text-base leading-none">⏱️</span>
        <span style={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>{countdown}</span>
        <span>{countdownLabel}</span>
      </div>
    );
  }

  return (
    <div
      className="px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider flex items-center gap-2"
      style={{
        backgroundColor: theme === 'dark' ? `${badge.color}15` : `${badge.color}10`,
        color: badge.color,
        border: `1px solid ${badge.color}40`,
        boxShadow: theme === 'dark' ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}
    >
      <span className="text-base leading-none">{badge.icon}</span>
      {badge.label}
    </div>
  );
}
