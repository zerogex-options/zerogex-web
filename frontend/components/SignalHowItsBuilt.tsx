'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

interface SignalHowItsBuiltProps {
  /** Optional override for the section title. Defaults to "How it's built". */
  title?: string;
  /** Body content — typically <code> snippets and short explanatory paragraphs. */
  children: ReactNode;
  /** Optional caveat shown in a divider footer (e.g. "Null IV → no data this cycle"). */
  caveat?: ReactNode;
}

/**
 * Standardized "How it's built" section, used at the bottom of every
 * signal-detail page just above the event timeline. Keeps formula
 * explanations rendered in a consistent visual location and style.
 */
export default function SignalHowItsBuilt({ title = "How it's built", children, caveat }: SignalHowItsBuiltProps) {
  return (
    <section className="zg-feature-shell mt-8 p-6">
      <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
        <Info size={16} />
        {title}
      </h2>
      <div className="text-xs text-[var(--color-text-secondary)] space-y-2 max-w-3xl">
        {children}
        {caveat && (
          <div className="pt-2 border-t border-[var(--color-border)]">{caveat}</div>
        )}
      </div>
    </section>
  );
}
