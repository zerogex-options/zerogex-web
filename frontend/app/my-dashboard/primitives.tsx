'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './primitives.i18n';

/**
 * The uniform container for widgets that don't carry their own card chrome
 * (charts, gauges, panels). Self-carded components (MetricCard, TodaysReadCard,
 * SignalScorePanel) render directly and skip this. Keeps every framed widget on
 * the same hairline-panel + eyebrow-title system as the rest of the site.
 */
export function WidgetCard({
  title,
  icon: Icon,
  href,
  hrefLabel,
  bordered = true,
  pad = true,
  fill = false,
  stretch = false,
  minHeight,
  children,
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  href?: string;
  hrefLabel?: string;
  bordered?: boolean;
  pad?: boolean;
  fill?: boolean;
  /**
   * The body takes all of the card's height that the header leaves, as a
   * flex column — for a widget that lays itself out to the tile's height (the
   * free-resize Gamma Ladder) rather than to its own content.
   */
  stretch?: boolean;
  minHeight?: number;
  children: ReactNode;
}) {
  const t = usePageT(dict);
  const header = title ? (
    <div
      className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5 border-b"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {Icon ? <Icon size={15} style={{ color: 'var(--color-accent-hot)' }} strokeWidth={2} /> : null}
        <h3 className="zg-eyebrow truncate" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
      </div>
      {href ? (
        <Link
          href={href}
          className="shrink-0 inline-flex items-center gap-1 zg-caption transition-opacity opacity-60 hover:opacity-100"
          style={{ color: 'var(--color-accent-hot)' }}
        >
          <span>{hrefLabel ?? t('open')}</span>
          <ArrowUpRight size={13} />
        </Link>
      ) : null}
    </div>
  ) : null;

  const body = (
    <div
      className={[pad ? 'p-4' : '', fill || stretch ? 'flex flex-col' : '', stretch ? 'flex-1 min-h-0' : '']
        .filter(Boolean)
        .join(' ')}
      style={minHeight ? { minHeight } : undefined}
    >
      {fill ? <div className="flex-1 min-h-0">{children}</div> : children}
    </div>
  );

  return (
    <div className={`h-full ${stretch ? 'flex flex-col' : ''} ${bordered ? 'zg-panel overflow-hidden' : ''}`}>
      {header}
      {body}
    </div>
  );
}
