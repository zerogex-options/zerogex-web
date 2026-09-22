'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import SectionHead from './SectionHead';
import BetaBadge from '@/components/BetaBadge';
import { navSubcategoryLabel } from '@/core/navigation';

/**
 * The ONE page header for an instrument page. Four parts, in this order:
 *
 *   1. eyebrow    the nav subcategory the page sits under — resolved from the
 *                 menu itself, never typed in, so the page cannot advertise a
 *                 category the menu does not file it under
 *   2. title      the page name, matching its nav label
 *   3. tooltip    the long read: what the number is, how it is built, how to
 *                 use it. Everything that will not fit in the standfirst
 *   4. sub        a standfirst of one or two sentences. Keep it SHORT — if it
 *                 wants a third sentence, that sentence belongs in the tooltip
 *
 * `actions` takes the page's filters and sits right-aligned on the same rule.
 *
 * The layout itself is SectionHead's, so a page header and a panel header are
 * the same unit at two scales (zg-h2 here, zg-h3 in ChartPanel) rather than two
 * separately-maintained headers that drift apart.
 */
export default function PageHeader({
  title,
  sub,
  tooltip,
  actions,
  eyebrow,
  beta = false,
  className = '',
}: {
  title: ReactNode;
  sub?: ReactNode;
  tooltip?: string;
  actions?: ReactNode;
  /** Overrides the eyebrow resolved from the nav. Only for pages outside the menu. */
  eyebrow?: ReactNode;
  /** Prints the Beta pill beside the title, for pages the nav also marks beta. */
  beta?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const resolvedEyebrow = eyebrow ?? navSubcategoryLabel(pathname);

  return (
    <SectionHead
      eyebrow={resolvedEyebrow}
      title={
        beta ? (
          <span className="inline-flex items-center gap-2.5">
            {title}
            <BetaBadge size="md" />
          </span>
        ) : (
          title
        )
      }
      sub={sub}
      tooltip={tooltip}
      actions={actions}
      className={className}
    />
  );
}
