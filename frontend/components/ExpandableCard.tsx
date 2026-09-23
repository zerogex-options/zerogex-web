'use client';

import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { Expand, X } from 'lucide-react';
import { useInDashboardWidget } from '@/core/dashboardWidget';
import { lockPageScroll } from '@/core/scrollLock';

interface ExpandableCardProps {
  children: ReactNode;
  className?: string;
  expandClassName?: string;
  expandTrigger?: 'card' | 'button';
  expandButtonLabel?: string;
}

const ExpandedCardContext = createContext(false);
export const useExpandedCard = () => useContext(ExpandedCardContext);

export default function ExpandableCard({
  children,
  className = '',
  expandClassName = '',
  expandTrigger = 'card',
  expandButtonLabel = 'Expand chart',
}: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(false);
  // Inside a "My Dashboard" tile the card renders bare: the tile owns its
  // top-right corner (the Expand button sat on top of the tile's remove button)
  // and a widget is resized by its footprint rather than blown up to fill the
  // viewport. See core/dashboardWidget.
  const inWidget = useInDashboardWidget();

  // The expanded view is a modal: hold the page still behind it (on a phone
  // a drag inside the chart otherwise scrolled the page underneath) and let
  // Escape close it.
  useEffect(() => {
    if (!expanded) return;
    const release = lockPageScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      release();
    };
  }, [expanded]);

  if (inWidget) {
    return (
      <div className={`relative ${className}`}>
        <ExpandedCardContext.Provider value={false}>{children}</ExpandedCardContext.Provider>
      </div>
    );
  }

  return (
    <>
      <div
        className={`relative ${expandTrigger === 'card' ? 'cursor-zoom-in' : ''} ${className}`}
        onClick={expandTrigger === 'card' ? () => setExpanded(true) : undefined}
      >
        {expandTrigger === 'button' ? (
          <button
            type="button"
            aria-label={expandButtonLabel}
            onClick={() => setExpanded(true)}
            className="absolute right-2 top-2 sm:right-3 sm:top-3 z-20 p-2.5 sm:p-2 rounded-md border"
            style={{
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--text-secondary)',
            }}
          >
            <Expand size={16} />
          </button>
        ) : null}
        <ExpandedCardContext.Provider value={false}>{children}</ExpandedCardContext.Provider>
      </div>

      {expanded && (
        // Full-bleed on a phone: the inset and rounded frame that frame the
        // expanded card on a monitor only take width away from the chart on
        // a 390px screen, which is the one place expanding is for.
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] p-0 md:p-6"
          style={{ backgroundColor: 'var(--color-grid-overlay)' }}
          onClick={() => setExpanded(false)}
        >
          <div
            className={`relative h-full w-full md:rounded-xl shadow-2xl ${expandClassName}`}
            style={{ backgroundColor: 'var(--bg-main)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close expanded card"
              onClick={() => setExpanded(false)}
              className="absolute right-2 top-2 md:right-3 md:top-3 z-30 p-2.5 md:p-2 rounded-md border"
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
            >
              <X size={18} />
            </button>
            <div className="h-full w-full overflow-auto overscroll-contain px-3 pt-14 pb-6 md:p-10 text-base md:text-lg leading-relaxed">
              <ExpandedCardContext.Provider value>{children}</ExpandedCardContext.Provider>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
