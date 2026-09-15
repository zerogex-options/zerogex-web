'use client';

import Link, { useLinkStatus } from 'next/link';

import { Spinner } from '../replay/LoadingNote';

/**
 * One session tile on /scorecard.
 *
 * Mirrors the replay tile: same shell, same click feedback, different facts.
 * A scorecard day is described by how many Playbook calls it emitted and the
 * regime it closed in, so those are what the card carries.
 *
 * `useLinkStatus` only reports from inside a <Link>, which is why the visuals
 * live on the inner element rather than the anchor.
 */

interface ScorecardSessionCardProps {
  href: string;
  humanDate: string;
  /** "long gamma" / "short gamma" / "transition" / "unknown". */
  regime: string;
  /** CSS color keyed to the regime. */
  regimeTone: string;
  cards: number;
}

function CardBody({
  humanDate,
  regime,
  regimeTone,
  cards,
}: Omit<ScorecardSessionCardProps, 'href'>) {
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
        {/* Swapped in place rather than appended, so the row keeps its width
            and the card doesn't reflow under the cursor as it loads. */}
        {pending ? (
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-secondary)]">
            <Spinner size={10} /> Loading
          </div>
        ) : (
          <div
            className="text-[10px] uppercase tracking-[0.18em] font-bold"
            style={{ color: regimeTone }}
          >
            {regime}
          </div>
        )}
      </div>
      <div className="mt-1 font-mono text-[11px] text-[var(--color-text-secondary)]">
        {cards === 0 ? 'No Playbook calls' : `${cards} Playbook call${cards === 1 ? '' : 's'}`}
      </div>
    </div>
  );
}

export default function ScorecardSessionCard({ href, ...body }: ScorecardSessionCardProps) {
  return (
    <Link href={href} className="block rounded-xl">
      <CardBody {...body} />
    </Link>
  );
}
