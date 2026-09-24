import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

// The "we couldn't load this" state for a dated permalink.
//
// It exists so that a backend blip is not rendered as a 404. These URLs are
// indexed — they rank for "<ticker> <date> gamma levels"-shaped searches — and
// notFound() tells Google the page is gone. A hard 404 served during a crawl
// because the data service was restarting drops a permalink that has perfectly
// good data behind it, and the URL then has to earn its place back.
//
// So a page with one of these has three outcomes, not two:
//   * the API answers with data              -> render it
//   * the API answers 404: no such date      -> notFound(), which is true
//   * the API does not answer at all         -> this, with a 200
//
// `serverApiGetResult` is what makes the middle and last distinguishable;
// `serverApiGet`'s null collapses them. The copy below is deliberate about
// which one this is: telling a visitor "there is no data for this date" when
// the truth is "our backend is down" is a confident claim about our own
// ingestion that a screenshot cannot later be walked back.
//
// /replay/[symbol]/[date] already draws this distinction with its own inline
// version, which also carries a third "today has no frames yet" branch. This
// component is the reusable shape for the pages that only need the two.

export default function DataUnavailable({
  what,
  backHref,
  backLabel,
}: {
  /** Human phrase for the thing that would not load, e.g. "SPX scorecard for Sep 12, 2026". */
  what: string;
  /** Where the index for these permalinks lives. */
  backHref: string;
  /** Link text for that index, e.g. "All sessions". */
  backLabel: string;
}) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-5">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft size={14} /> {backLabel}
        </Link>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-8 text-sm leading-7 text-[var(--color-text-secondary)]">
        Couldn&rsquo;t load the {what} just now&nbsp;- the data service didn&rsquo;t answer. This
        is on our side, not a gap in the session. Refresh in a moment, or{' '}
        <Link href={backHref} className="underline hover:text-[var(--color-text-primary)]">
          pick another date
        </Link>
        .
      </div>
    </main>
  );
}
