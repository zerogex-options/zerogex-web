'use client';

import { useState, useEffect } from 'react';
import { MarketSession, Theme } from '@/core/types';

interface SessionBadgeProps {
  session: MarketSession;
  theme: Theme;
  showCountdown?: boolean;
  compact?: boolean;
}

export default function SessionBadge({ session, showCountdown = false, compact = false }: SessionBadgeProps) {
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
    'open': { label: 'MARKET OPEN', color: 'var(--color-bull)', icon: '●' },
    'pre-market': { label: 'PRE-MARKET', color: 'var(--color-brand-coral)', icon: '○' },
    'after-hours': { label: 'AFTER HOURS', color: 'var(--color-brand-coral)', icon: '○' },
    'closed': { label: 'CLOSED', color: 'var(--color-bear)', icon: '●' },
    'halted': { label: 'HALTED', color: 'var(--color-warning)', icon: '▲' },
    'closed-weekend': { label: 'CLOSED (WEEKEND)', color: 'var(--color-bear)', icon: '●' },
    'closed-holiday': { label: 'CLOSED (HOLIDAY)', color: 'var(--color-bear)', icon: '●' },
    // Cash index is closed but its future is trading — quotes/charts show
    // the future (see index→future display swap).
    'futures': { label: 'FUTURES', color: 'var(--color-brand-coral)', icon: '◆' },
  };

  const badge = badges[session] || badges['closed'];

  // Compact mode - circle only in a square container
  if (compact && !showCountdown) {
    return (
      <div
        className="px-2 py-2 rounded-[2px] flex items-center justify-center"
        title={badge.label}
        style={{
          backgroundColor: 'var(--bg-hover)',
          border: `1px solid var(--border-default)`,
          width: '40px',
          height: '40px',
        }}
      >
        <span 
          className="text-2xl leading-none"
          style={{ color: badge.color }}
        >
          {badge.icon}
        </span>
      </div>
    );
  }

  // Show countdown if toggle is on and countdown exists
  if (showCountdown && countdown) {
    return (
      <div
        className="px-3 py-1.5 rounded-[2px] text-xs font-semibold tracking-wider flex items-center gap-2"
        style={{
          backgroundColor: 'var(--bg-hover)',
          color: 'var(--text-primary)',
          border: `1px solid var(--border-default)`,
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
      className="px-3 py-1.5 rounded-[2px] text-xs font-semibold tracking-wider flex items-center gap-2"
      style={{
        backgroundColor: 'transparent',
        color: badge.color,
        border: `1px solid ${badge.color}`,
        fontFamily: 'var(--font-mono)',
      }}
    >
      <span className="text-base leading-none">{badge.icon}</span>
      {badge.label}
    </div>
  );
}
