import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { LoadingNote } from '../../LoadingNote';

/**
 * Route-level Suspense fallback for /replay/[symbol]/[date].
 *
 * `page.tsx` awaits `/api/replay/range?...&include_expirations=true` — a
 * session-wide scan plus a second pass for the per-strike expiration mix, so
 * ~5s is normal. Without a loading boundary the App Router keeps the *previous*
 * page on screen for that entire window: clicking a date on /replay looked like
 * the click had been swallowed, and the usual response to that is to click
 * again. This file wraps the segment in Suspense, so the chrome paints the
 * instant the click lands and the fetch streams in behind it.
 *
 * It also gives `<Link>` something worth prefetching. For a dynamic route the
 * router only prefetches down to the nearest loading boundary — with no
 * boundary there was nothing to prefetch, so the navigation itself couldn't
 * start until the server had the whole payload.
 *
 * The shape traces the real page (back link, header, scrubber panel, chart
 * panel) so nothing jumps when the data lands. `.zg-skeleton-line` is the
 * app-wide placeholder bar; the global prefers-reduced-motion rule stills it.
 */
export default function ReplayDateLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10" aria-busy="true">
      {/* A real link, not a skeleton: a slow session should stay escapable. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
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
              ZeroGEX · GEX Replay
            </div>
            {/* loading.tsx gets no params, so the title can't name the session. */}
            <div className="zg-skeleton-line mt-2 h-6 w-64 max-w-full" />
            <LoadingNote className="mt-2">Loading the session…</LoadingNote>
          </div>
          <div className="zg-skeleton-line h-8 w-40 shrink-0" />
        </div>
      </header>

      <div className="space-y-5">
        {/* Scrubber control panel: timestamp readout, controls, playhead. */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="zg-skeleton-line h-2.5 w-24" />
              <div className="zg-skeleton-line mt-2 h-5 w-32" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[72, 96, 84, 64].map((w) => (
                <div key={w} className="zg-skeleton-line h-7" style={{ width: w }} />
              ))}
            </div>
          </div>
          <div className="zg-skeleton-line mt-4 h-2 w-full" />
          <div className="mt-2 flex justify-between">
            <div className="zg-skeleton-line h-2.5 w-14" />
            <div className="zg-skeleton-line h-2.5 w-14" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[88, 76, 92].map((w) => (
              <div key={w} className="zg-skeleton-line h-7" style={{ width: w }} />
            ))}
          </div>
        </div>

        {/* Chart panel: tape + strike profile share the 380px well. */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="zg-skeleton-line h-2.5 w-44" />
            <div className="zg-skeleton-line h-6 w-28" />
          </div>
          <div className="zg-skeleton-line mt-3 h-[380px] w-full" />
          {/* Level status row: call wall / flip / max pain / put wall / pin. */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {[68, 52, 66, 62, 44].map((w) => (
              <div key={w} className="zg-skeleton-line h-2.5" style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
