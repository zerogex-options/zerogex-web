'use client';

import { useDensity } from '@/core/DensityContext';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './DensityToggle.i18n';

// The Simple / Detailed view switch. One global preference (core/DensityContext),
// so flipping it on any page that shows this switch applies to every page that
// reads it: the Main Dashboard and Dealer Positioning.
export default function DensityToggle() {
  const { density, setDensity } = useDensity();
  const t = usePageT(dict);
  return (
    <div
      className="inline-flex rounded-md border overflow-hidden text-xs"
      style={{ borderColor: 'var(--color-border)' }}
      role="group"
      aria-label={t('densityAriaLabel')}
    >
      {(['simple', 'detailed'] as const).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => setDensity(d)}
          className="px-3 py-1.5 font-medium capitalize"
          aria-pressed={density === d}
          style={{
            background: density === d ? 'var(--color-info-soft)' : 'transparent',
            color: density === d ? 'var(--color-info)' : 'var(--color-text-secondary)',
          }}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
