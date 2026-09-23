'use client';

import type { LucideIcon } from 'lucide-react';
import TooltipWrapper from './TooltipWrapper';

interface SignalPageTitleProps {
  title: string;
  /** Optional one-line tagline rendered in italics next to the title. */
  subtitle?: string;
  icon?: LucideIcon;
  tooltip?: string;
  /** Optional content rendered to the right of the title (e.g. a kicker badge). */
  rightSlot?: React.ReactNode;
}

/**
 * Standardized page title for every signal-detail page. Keeps icon size,
 * heading typography, and the tooltip ⓘ glyph identical across pages.
 */
export default function SignalPageTitle({ title, subtitle, icon: Icon, tooltip, rightSlot }: SignalPageTitleProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-6">
      {Icon && <Icon size={24} />}
      {/* On a phone a long name ("Gamma / VWAP Confluence") was pushed under
          its icon, stranding the icon on a line of its own. Below sm the title
          is 26px and claims exactly the rest of the icon's line (24px icon +
          8px gap), wrapping inside itself if it must, so the subtitle always
          starts the next line instead of squeezing in beside it. */}
      <h1
        className={`text-3xl font-bold max-sm:min-w-0 max-sm:text-[26px] ${
          Icon ? 'max-sm:basis-[calc(100%_-_2rem_-_1px)]' : 'max-sm:basis-full'
        }`}
      >
        {title}
      </h1>
      {subtitle && (
        // Capped short of the line on a phone so a two-line subtitle still
        // leaves room for the ⓘ beside it, instead of stranding it below.
        <span className="text-sm italic text-[var(--color-text-secondary)] max-sm:max-w-[calc(100%_-_2.25rem)]">
          {subtitle}
        </span>
      )}
      {tooltip && (
        <TooltipWrapper text={tooltip} placement="bottom">
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      )}
      {rightSlot && <div className="ml-auto">{rightSlot}</div>}
    </div>
  );
}
