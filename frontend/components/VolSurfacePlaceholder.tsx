'use client';

import { LineChart } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';

export default function VolSurfacePlaceholder() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className="rounded-2xl p-6 flex flex-col h-full"
      style={{
        backgroundColor: isDark ? colors.cardDark : colors.cardLight,
        border: `1px solid ${colors.muted}`,
      }}
    >
      <h3
        className="text-sm font-bold tracking-wider uppercase mb-4"
        style={{ color: isDark ? colors.light : colors.dark }}
      >
        VOL SURFACE
      </h3>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[200px]">
        <LineChart size={48} style={{ color: colors.muted, opacity: 0.4 }} />
        <span className="text-sm font-medium" style={{ color: colors.muted }}>
          Coming Soon
        </span>
        <span className="text-xs text-center max-w-[240px]" style={{ color: colors.muted, opacity: 0.7 }}>
          IV surface across strikes and expirations for 0DTE, 7DTE, and 30DTE tenors
        </span>
      </div>
    </div>
  );
}
