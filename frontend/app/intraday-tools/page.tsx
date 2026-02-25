'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/lib/colors';

export default function IntradayToolsPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const bodyBg = document.body.style.backgroundColor;
      setTheme(bodyBg === colors.bgDark ? 'dark' : 'light');
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-6">
      <h2 
        className="text-3xl font-bold"
        style={{ color: theme === 'dark' ? colors.light : colors.dark }}
      >
        Intraday Trading Tools
      </h2>
      <div
        className="p-12 rounded-2xl text-center"
        style={{
          backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
        }}
      >
        <p className="text-lg mb-4" style={{ color: colors.muted }}>
          Intraday tools coming soon with real-time data.
        </p>
        <p className="text-sm" style={{ color: colors.muted, opacity: 0.7 }}>
          This page will feature: VWAP Deviation, Opening Range Breakouts, Volume Spikes, and Momentum Divergence indicators.
        </p>
      </div>
    </div>
  );
}
