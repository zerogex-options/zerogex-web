'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/core/colors';

export default function GreeksGEXPage() {
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
        Greeks & GEX Analysis
      </h2>
      <div
        className="p-12 rounded-2xl text-center"
        style={{
          backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
        }}
      >
        <p className="text-lg mb-4" style={{ color: colors.muted }}>
          Greeks analysis and Grafana dashboards coming soon.
        </p>
        <p className="text-sm" style={{ color: colors.muted, opacity: 0.7 }}>
          This page will feature: Gamma Exposure Levels, Vanna/Charm exposure, Historical GEX patterns, and embedded Grafana dashboards.
        </p>
      </div>
    </div>
  );
}
