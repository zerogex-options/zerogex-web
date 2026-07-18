'use client';

import { ReactNode, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Reusable disclosure — generalizes the header-button-toggle pattern that
// SignalsGuide pioneered. Keeps the dashboard glance-first: verbose sections
// live behind a one-line header the user can expand on demand.
//
// Note on `defaultOpen`: it seeds the initial state only. Callers that want
// the open state to follow a live preference (e.g. the Simple/Detailed
// density toggle) should pass a `key` that changes with the preference so the
// component remounts and re-reads `defaultOpen`.
export default function Collapsible({
  title,
  subtitle,
  defaultOpen = false,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  right?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="zg-feature-shell p-4 mb-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">{title}</span>
          {subtitle ? (
            <span className="text-[11px] text-[var(--color-text-secondary)] hidden sm:inline truncate">
              · {subtitle}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {right}
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </section>
  );
}
