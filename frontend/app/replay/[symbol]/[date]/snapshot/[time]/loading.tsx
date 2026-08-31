import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { LoadingNote } from '@/app/replay/LoadingNote';

/**
 * Suspense fallback for a single replay moment.
 *
 * This route sits under the [date] segment, so without its own boundary it
 * would inherit the scrubber-shaped fallback next door and then reflow into a
 * completely different layout. The snapshot fetches one frame rather than a
 * whole session (and caches for a day), so the wait is usually short — but a
 * cold miss still goes to the backend, and a wrong-shaped skeleton is worse
 * than a right-shaped one.
 *
 * Both boundaries do exist on this route, so a cold permalink load paints the
 * parent's fallback for the one frame before React swaps in this one (measured
 * at ~8ms). That is the cost of having the right shape for the other ~4s.
 */
export default function ReplaySnapshotLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10" aria-busy="true">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {/* The player is one segment up; /replay is the safe target from a
            fallback that can't read params to rebuild the player's URL. */}
        <Link
          href="/replay"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft size={14} /> All sessions
        </Link>
        <div className="zg-skeleton-line h-7 w-28" />
      </div>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
              ZeroGEX · Replay snapshot
            </div>
            <div className="zg-skeleton-line mt-2 h-6 w-72 max-w-full" />
            <LoadingNote className="mt-2">Loading the snapshot…</LoadingNote>
          </div>
          <div className="zg-skeleton-line h-8 w-40 shrink-0" />
        </div>
      </header>

      {/* Spot / call wall / put wall / gamma flip. */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4"
          >
            <div className="zg-skeleton-line h-2.5 w-16" />
            <div className="zg-skeleton-line mt-2 h-5 w-20" />
          </div>
        ))}
      </section>

      <div className="zg-skeleton-line h-[420px] w-full" />
    </main>
  );
}
