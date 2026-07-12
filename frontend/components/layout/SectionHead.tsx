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
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  tooltip?: string;
  actions?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  const centered = align === 'center';
  return (
    <div className={`mb-5 ${className}`}>
      <div
        className={`flex gap-4 pb-2 border-b ${centered ? 'flex-col items-center text-center' : 'items-end justify-between'}`}
        style={{ borderColor: 'var(--border-default)' }}
      >
        <div className={centered ? 'max-w-2xl' : ''}>
          {eyebrow ? (
            <div className="zg-eyebrow" style={{ color: 'var(--color-accent-hot)', marginBottom: 6 }}>
              {eyebrow}
            </div>
          ) : null}
          <div className={`flex items-center gap-2 ${centered ? 'justify-center' : ''}`}>
            <h2 className="zg-h2">{title}</h2>
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
        {actions && !centered ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}
