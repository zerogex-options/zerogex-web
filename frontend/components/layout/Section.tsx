import type { ReactNode } from 'react';

/**
 * A vertical rhythm block inside a PageShell. `gap` sets the space BELOW the
 * section from the geometric scale, so spacing encodes importance instead of a
 * uniform mb-8 everywhere. `width="measure"` re-narrows a prose block inside a
 * wide/bleed shell; `width="bleed"` lets a chart escape the shell's padding.
 */
type Gap = 'tight' | 'row' | 'block' | 'section';
type Width = 'default' | 'measure' | 'bleed';

const GAP: Record<Gap, string> = {
  tight: 'mb-2',
  row: 'mb-4',
  block: 'mb-10',
  section: 'mb-16',
};

const WIDTH: Record<Width, string> = {
  default: '',
  measure: 'max-w-3xl',
  bleed: '-mx-4 sm:-mx-6 lg:-mx-8',
};

export default function Section({
  gap = 'block',
  width = 'default',
  className = '',
  children,
}: {
  gap?: Gap;
  width?: Width;
  className?: string;
  children: ReactNode;
}) {
  return <section className={`${GAP[gap]} ${WIDTH[width]} ${className}`}>{children}</section>;
}
