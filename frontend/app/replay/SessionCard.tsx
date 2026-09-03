'use client';

import Link, { useLinkStatus } from 'next/link';

import { Spinner } from './LoadingNote';

/**
 * One session tile on /replay, with click feedback.
 *
 * The date page pulls a whole session of per-minute frames, so there is a real
 * beat between the click and the new route painting — longest for a card that
 * scrolled into view too recently for its shell to have prefetched. The route's
 * `loading.tsx` covers the wait once the transition starts; this covers the
 * gap before it, on the tile the user actually clicked, so a slow session never
 * reads as a dead card.
 *
 * `useLinkStatus` only reports from inside a <Link>, which is why the card's
 * visuals live on the inner element rather than on the anchor itself.
 */

interface SessionCardProps {
  href: string;
  humanDate: string;
  /** "Full session" / "Partial" / "Thin". */
  statusLabel: string;
  /** CSS color for the status label, keyed to that tone. */
  statusTone: string;
  barCount: number;
}

function CardBody({
  humanDate,
  statusLabel,
  statusTone,
  barCount,
}: Omit<SessionCardProps, 'href'>) {
  const { pending } = useLinkStatus();

  return (
    <div
      aria-busy={pending}
      className="rounded-xl border bg-[var(--color-surface)] px-4 py-3 transition-colors hover:bg-[var(--color-surface-subtle)]"
      style={{
        borderColor: pending ? 'var(--accent-2)' : 'var(--color-border)',
        // Set only while pending so the hover rule still owns the resting card.
        background: pending ? 'var(--color-surface-subtle)' : undefined,
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-semibold">{humanDate}</div>
        {/* Swapped in place rather than appended: the row keeps its width, so
            the card doesn't reflow under the cursor as it starts loading. */}
        {pending ? (
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-secondary)]">
            <Spinner size={10} /> Loading
          </div>
        ) : (
          <div
            className="text-[10px] uppercase tracking-[0.18em] font-bold"
            style={{ color: statusTone }}
          >
            {statusLabel}
          </div>
        )}
      </div>
      <div className="mt-1 font-mono text-[11px] text-[var(--color-text-secondary)]">
        {barCount} bars
      </div>
    </div>
  );
}

export default function SessionCard({ href, ...body }: SessionCardProps) {
  return (
    <Link href={href} className="block rounded-xl">
      <CardBody {...body} />
    </Link>
  );
}
