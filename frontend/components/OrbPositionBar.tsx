'use client';

/**
 * Position Within Range: where price sits against the opening range, on a bar
 * that runs from one range-width below the range to one above it. Drawn on
 * the Technicals page and as a My Dashboard widget; both render this, so the
 * two cannot drift apart.
 */

import type { ReactNode } from 'react';
import type { TechnicalsOpeningRange } from '@/hooks/useTechnicals';
import { spectrumIndicatorLeft } from '@/core/spectrumIndicator';
import { orbPosition, orbStatusColor } from '@/core/technicalsCharts';

export type OrbPositionLabels = { below: string; inside: string; above: string };

const DEFAULT_LABELS: OrbPositionLabels = {
  below: 'Below Range',
  inside: 'Inside Range',
  above: 'Above Range',
};

export default function OrbPositionBar({
  orb,
  price,
  compact,
  title,
  labels = DEFAULT_LABELS,
}: {
  orb: TechnicalsOpeningRange | null;
  price: number | null | undefined;
  /** Narrow layout: keep the price label inside the bar at either end. */
  compact: boolean;
  /** Heading beside the status; omitted where the frame already names it. */
  title?: ReactNode;
  labels?: OrbPositionLabels;
}) {
  const position = orbPosition(orb, price);
  if (!position) return null;
  const { orbLow, orbHigh, price: currentPrice, lowPct, highPct, pricePct } = position;
  const status = orb?.orb_status ?? '--';
  const statusColor = orbStatusColor(orb?.orb_status);
  const mutedText = 'var(--text-secondary)';
  const textColor = 'var(--text-primary)';

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        {title ? <h3 className="zg-h3">{title}</h3> : null}
        <div className={title ? 'text-sm' : 'text-sm ml-auto'} style={{ color: statusColor, fontWeight: 600 }}>
          {status}
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-2" style={{ color: mutedText }}>
        <span>{labels.below}</span>
        <span>{labels.inside}</span>
        <span>{labels.above}</span>
      </div>
      <div
        className="relative h-5 rounded-full overflow-visible"
        style={{ background: 'linear-gradient(to right, var(--color-bear) 0%, color-mix(in srgb, var(--color-bear) 30%, transparent) 33%, color-mix(in srgb, var(--color-warning) 35%, transparent) 50%, color-mix(in srgb, var(--color-bull) 30%, transparent) 67%, var(--color-bull) 100%)' }}
      >
        <div className="absolute top-0 bottom-0 w-px" style={{ left: `${lowPct}%`, backgroundColor: 'var(--text-primary)', opacity: 0.45 }} />
        <div className="absolute top-0 bottom-0 w-px" style={{ left: `${highPct}%`, backgroundColor: 'var(--text-primary)', opacity: 0.45 }} />
        <div
          className="absolute -top-1 -bottom-1 w-1 -translate-x-1/2 rounded"
          style={{ left: spectrumIndicatorLeft(pricePct, 20, 4), backgroundColor: 'var(--text-primary)', boxShadow: '0 0 10px rgba(255,255,255,0.55)' }}
        />
      </div>
      <div className="relative h-5 mt-2 text-[10px]" style={{ color: mutedText }}>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${lowPct}%` }}>${orbLow.toFixed(2)}</span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${highPct}%` }}>${orbHigh.toFixed(2)}</span>
      </div>
      <div className="relative h-4 text-[10px]">
        {/* Centered under the marker, the price label hung half off the card
            whenever price sat at either end of the scale (it pins there once
            it leaves the range). A narrow layout anchors it inside instead. */}
        <span
          className={`absolute whitespace-nowrap font-semibold ${
            compact && pricePct > 88 ? '-translate-x-full' : compact && pricePct < 12 ? '' : '-translate-x-1/2'
          }`}
          style={{ left: `${pricePct}%`, color: textColor }}
        >
          ${currentPrice.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
