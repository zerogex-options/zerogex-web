'use client';

// One wall alert as a list row — shared by the header bell's dropdown and the
// Recent alerts list on /account/alerts, so both read identically. Words come
// from core/wallAlerts.ts formatWallAlert (the same formatter the email uses).

import type { WallAlertFeedEntry } from '@/core/wallAlerts';
import { formatWallAlert, type WallAlertCopy } from '@/core/wallAlerts';

export const TONE_COLOR: Record<string, string> = {
  info: 'var(--color-info)',
  bull: 'var(--color-bull)',
  bear: 'var(--color-bear)',
  neutral: 'var(--color-text-secondary)',
};

function sameEtDay(a: Date, b: Date): boolean {
  const f = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  return f(a) === f(b);
}

/** "10:15 AM ET" today, "Oct 13, 10:15 AM ET" otherwise. */
export function fmtWhen(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString(locale, { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
  if (sameEtDay(d, new Date())) return `${time} ET`;
  const day = d.toLocaleDateString(locale, { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
  return `${day}, ${time} ET`;
}

export function WallAlertRow({
  entry,
  copy,
  locale,
  compact = false,
}: {
  entry: WallAlertFeedEntry;
  copy: WallAlertCopy;
  locale: string;
  compact?: boolean;
}) {
  const f = formatWallAlert({ ...entry.payload, symbol: entry.payload?.symbol ?? entry.symbol }, copy);
  const color = TONE_COLOR[f.tone];
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ color, border: `1px solid ${color}` }}
      >
        {f.kindChip}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-[var(--color-text-primary)]">{f.headline}</div>
        <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug tabular-nums mt-0.5">{f.detail}</div>
        {!compact
          ? f.facts.map((line) => (
              <div key={line} className="text-[11px] text-[var(--color-text-secondary)] leading-snug mt-0.5">
                {line}
              </div>
            ))
          : f.tierLabel
            ? <div className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{f.facts[0]}</div>
            : null}
        <div className="text-[10px] text-[var(--color-text-secondary)] mt-1">{fmtWhen(entry.created_at, locale)}</div>
      </div>
    </div>
  );
}

