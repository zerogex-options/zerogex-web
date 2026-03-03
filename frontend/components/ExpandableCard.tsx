'use client';

import { ReactNode, useState } from 'react';
import { Expand, X } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';

interface ExpandableCardProps {
  children: ReactNode;
  className?: string;
  expandClassName?: string;
}

export default function ExpandableCard({ children, className = '', expandClassName = '' }: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { theme } = useTheme();

  return (
    <>
      <div className={`relative cursor-zoom-in ${className}`} onClick={() => setExpanded(true)}>
        <button
          type="button"
          aria-label="Expand card"
          className="absolute top-2 right-2 z-10 p-1 rounded-md"
          style={{ color: colors.muted, backgroundColor: theme === 'dark' ? `${colors.dark}66` : `${colors.light}cc` }}
        >
          <Expand size={14} />
        </button>
        {children}
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-[100] p-4 md:p-8"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={() => setExpanded(false)}
        >
          <div
            className={`relative h-full w-full overflow-auto rounded-xl ${expandClassName}`}
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
            <div className="clear-both p-4 md:p-6">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
