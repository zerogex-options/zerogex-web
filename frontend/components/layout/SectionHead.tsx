import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import TooltipWrapper from '@/components/TooltipWrapper';

/**
 * The one section header. Left-flush kicker → title → standfirst, closed by a
 * full-width hairline rule, with optional right-aligned actions. Replaces the
 * six locally-redefined SectionTitle/SectionHeading units and the centered
 * eyebrow-pill. All type routes through the .zg-* scale; the eyebrow is the
 * one sanctioned label.
 */
export default function SectionHead({
  eyebrow,
  title,
  sub,
  tooltip,
  actions,
  align = 'left',
  className = '',
  titleClassName = 'zg-h2',
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  tooltip?: string;
  actions?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
  /**
   * Type scale for the title element. Defaults to the `zg-h2` subsection
   * scale; pass `zg-h3` (the design system's dedicated chart-title scale) for
   * compact chart cards that want a smaller heading.
   */
  titleClassName?: string;
}) {
  const centered = align === 'center';
  return (
    <div className={`mb-5 ${className}`}>
      {/* Phones wrap: when the title block and the actions cannot share a
          row, the actions drop under the title instead of squeezing it into
          a one-word-per-line column. From `sm` up the row never wraps. */}
      <div
        className={`flex gap-x-4 gap-y-3 pb-2 border-b ${centered ? 'flex-col items-center text-center' : 'flex-wrap sm:flex-nowrap items-end justify-between'}`}
        style={{ borderColor: 'var(--border-default)' }}
      >
        <div className={centered ? 'max-w-2xl' : 'min-w-0'}>
          {eyebrow ? (
            <div className="zg-eyebrow" style={{ color: 'var(--color-accent-hot)', marginBottom: 6 }}>
              {eyebrow}
            </div>
          ) : null}
          <div className={`flex items-center gap-2 ${centered ? 'justify-center' : ''}`}>
            <h2 className={titleClassName}>{title}</h2>
            {tooltip ? (
              <TooltipWrapper text={tooltip}>
                <Info size={14} />
              </TooltipWrapper>
            ) : null}
          </div>
          {sub ? (
            <p className="zg-small" style={{ color: 'var(--text-secondary)', marginTop: 6, maxWidth: '62ch' }}>
              {sub}
            </p>
          ) : null}
        </div>
        {actions && !centered ? <div className="flex flex-wrap items-center gap-2 sm:shrink-0 max-w-full">{actions}</div> : null}
      </div>
    </div>
  );
}
