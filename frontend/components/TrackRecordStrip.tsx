import Link from 'next/link';

import { trackRecordOneLiner, type HistorySummary } from '@/core/trackRecord';

// The proof line, for the free levels pages and the homepage.
//
// PLACED BEFORE THE ASKS, not after. It is evidence, not a call to action:
// a reader who has just been told the numbers are graded and the misses are
// published reads the trial CTA differently than one who has not. Putting it
// below the conversion block would show it only to people who had already
// decided.
//
// The sentence itself is not written here. core/trackRecord.ts owns every
// claim so that a line on /spx-gamma-levels can never say something
// /track-record would contradict — which is a live risk, because the rolling
// window reads 29 of 29 while the record reads 48 of 55.

export default function TrackRecordStrip({
  history,
  symbol,
}: {
  history: HistorySummary | null;
  symbol: string;
}) {
  const line = trackRecordOneLiner(history, symbol);
  const hasNumbers = (history?.range.graded ?? 0) > 0;

  return (
    <section
      style={{ marginBottom: 40 }}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      aria-label="Forecast track record"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
          <strong className="text-[var(--color-text-primary)]">{line}</strong>
          {/* Only when there is a number to qualify. Without one the line
              already ends "Every receipt is published", and following that
              with a second sentence saying the same thing reads like padding
              on the one strip whose whole job is to sound credible. */}
          {hasNumbers ? (
            <> Including the days it broke&nbsp;- those are listed by date, with the forecast that got them wrong.</>
          ) : null}
        </p>
        <Link
          href="/track-record"
          className="shrink-0 whitespace-nowrap text-sm font-semibold underline hover:text-[var(--color-accent)]"
        >
          See the record →
        </Link>
      </div>
    </section>
  );
}
