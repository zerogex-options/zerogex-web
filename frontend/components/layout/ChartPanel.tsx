import type { ReactNode } from 'react';

import Panel from './Panel';
import SectionHead from './SectionHead';

/**
 * The ONE titled surface below a page header: a `.zg-panel` carrying a
 * SectionHead at the chart scale (zg-h3), then its content.
 *
 * Promoted out of the Spread Monitor, where it was a local helper, because
 * every Metrics page wants exactly this and each was hand-rolling it — a
 * `rounded-lg p-6` div here, a `rounded-2xl p-6` there, an `<h2 class="text-2xl
 * font-semibold">` with no rule under it somewhere else. Same unit as
 * PageHeader, one scale down, so a page reads as one instrument.
 *
 * "One border deep": never nest a ChartPanel inside another — group leaf tiles
 * inside a single panel and separate them with rules.
 */
export default function ChartPanel({
  title,
  tooltip,
  sub,
  actions,
  className = 'mt-6',
  padded = true,
  children,
}: {
  title: ReactNode;
  /** The long read — how the surface is built and what would mislead you. */
  tooltip?: string;
  /** One line on what the surface shows. */
  sub?: ReactNode;
  /** Panel-scoped filters, right-aligned on the header rule. */
  actions?: ReactNode;
  className?: string;
  padded?: boolean;
  children: ReactNode;
}) {
  return (
    <Panel className={className} padded={padded}>
      <SectionHead
        title={title}
        titleClassName="zg-h3"
        tooltip={tooltip}
        sub={sub}
        actions={actions}
      />
      {children}
    </Panel>
  );
}
