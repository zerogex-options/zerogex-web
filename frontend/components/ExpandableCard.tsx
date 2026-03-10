'use client';

import { ReactNode, createContext, useContext, useState } from 'react';
import { Expand, X } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';

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
  const { theme } = useTheme();

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
            className="absolute right-3 top-3 z-20 p-2 rounded-md border"
            style={{
              color: theme === 'dark' ? colors.light : colors.dark,
              backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
              borderColor: colors.muted,
            }}
          >
            <Expand size={16} />
          </button>
        ) : null}
        <ExpandedCardContext.Provider value={false}>{children}</ExpandedCardContext.Provider>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-[100] p-3 md:p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={() => setExpanded(false)}
        >
          <div
            className={`relative h-full w-full overflow-auto rounded-xl shadow-2xl ${expandClassName}`}
            style={{ backgroundColor: theme === 'dark' ? colors.bgDark : colors.bgLight }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close expanded card"
              onClick={() => setExpanded(false)}
              className="sticky top-2 float-right z-20 p-2 m-2 rounded-md"
              style={{ color: theme === 'dark' ? colors.light : colors.dark, backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight }}
            >
              <X size={18} />
            </button>
            <div className="clear-both p-6 md:p-10 text-base md:text-lg leading-relaxed">
              <ExpandedCardContext.Provider value>{children}</ExpandedCardContext.Provider>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
