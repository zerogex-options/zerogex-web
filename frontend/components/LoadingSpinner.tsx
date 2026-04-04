/**
 * Loading spinner component
 */

import { useTheme } from '@/core/ThemeContext';

export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  };

  return (
    <div className="flex items-center justify-center p-8">
      <div className={`animate-spin rounded-full border-b-2 border-[var(--accent-2)] ${sizeClasses[size]}`}></div>
    </div>
  );
}

export function LoadingCard() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div className="rounded-lg p-6 animate-pulse" style={{ backgroundColor: isDark ? 'var(--color-surface)' : 'var(--color-surface-subtle)' }}>
      <div className="h-4 rounded w-1/2 mb-4" style={{ backgroundColor: isDark ? 'var(--color-text-secondary)' : 'var(--color-border)' }}></div>
      <div className="h-8 rounded w-3/4" style={{ backgroundColor: isDark ? 'var(--color-text-secondary)' : 'var(--color-border)' }}></div>
    </div>
  );
}
