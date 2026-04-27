'use client';

import type { LucideIcon } from 'lucide-react';
import TooltipWrapper from './TooltipWrapper';

interface SignalPageTitleProps {
  title: string;
  icon?: LucideIcon;
  tooltip?: string;
  /** Optional content rendered to the right of the title (e.g. a kicker badge). */
  rightSlot?: React.ReactNode;
}

/**
 * Standardized page title for every signal-detail page. Keeps icon size,
 * heading typography, and the tooltip ⓘ glyph identical across pages.
 */
export default function SignalPageTitle({ title, icon: Icon, tooltip, rightSlot }: SignalPageTitleProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Icon && <Icon size={24} />}
      <h1 className="text-3xl font-bold">{title}</h1>
      {tooltip && (
        <TooltipWrapper text={tooltip} placement="bottom">
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      )}
      {rightSlot && <div className="ml-auto">{rightSlot}</div>}
    </div>
  );
}
