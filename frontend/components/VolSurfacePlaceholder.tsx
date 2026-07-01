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
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${'var(--text-secondary)'}`,
      }}
    >
      <h3
        className="zg-h3 mb-4"
        style={{ color: 'var(--text-primary)' }}
      >
        Volatility surface
      </h3>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[200px]">
        <LineChart size={48} style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Coming Soon
        </span>
        <span className="text-xs text-center max-w-[240px]" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
          IV surface across strikes and expirations for 0DTE, 7DTE, and 30DTE tenors
        </span>
      </div>
    </div>
  );
}
