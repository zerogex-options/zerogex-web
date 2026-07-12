import type { ReactNode } from 'react';

/**
 * The one page shell. Owns max-width + horizontal padding + top/bottom
 * rhythm so pages stop hand-rolling `container mx-auto px-4 py-8` (33 copies
 * today). Change page width or rhythm here and it moves the whole site.
 *
 *   default  — tool / data pages (wide instrument surface)
 *   wide     — extra-wide dashboards
 *   measure  — content / article / hub pages (kept readable)
 *   bleed    — full width; the page manages its own interior widths
 */
type Width = 'default' | 'wide' | 'measure' | 'bleed';

const MAXW: Record<Width, string> = {
  default: 'max-w-screen-xl',
  wide: 'max-w-screen-2xl',
  measure: 'max-w-4xl',
  bleed: 'max-w-none',
};

export default function PageShell({
  width = 'default',
  className = '',
  children,
}: {
  width?: Width;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto w-full ${MAXW[width]} px-4 sm:px-6 lg:px-8 py-8 ${className}`}>
      {children}
    </div>
  );
}
