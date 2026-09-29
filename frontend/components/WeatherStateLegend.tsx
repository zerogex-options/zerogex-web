'use client';

import { WEATHER_STATE_LEGEND, weatherStateColor } from '@/core/weatherStateColors';

/**
 * The five Weather colors, in one fixed order.
 *
 * Always all five, even when the session only visited two of them. A legend
 * that shrank to what happened would make two days incomparable at a glance.
 * Text stays in ink; the swatch beside it carries the identity.
 *
 * Its own component because the stacked view shows it once above five charts
 * while a lone drawer shows it under one. Same swatches either way.
 */
export default function WeatherStateLegend({ className = '' }: { className?: string }) {
  return (
    <ul
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] ${className}`}
      // borderColor too, because callers add their own border-t and the
      // Tailwind default would not match the panel's rules.
      style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
    >
      {WEATHER_STATE_LEGEND.map((entry) => (
        <li key={entry.state} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: weatherStateColor(entry.state) }}
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}
