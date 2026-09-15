'use client';

import Link from 'next/link';
import { useSignalTrailingRecord } from '@/hooks/useApiData';

/**
 * A signal's trailing record, and the way into the public Daily Scorecard.
 *
 * Two gaps this closes, both found the same week:
 *
 * 1. The Scorecard was unreachable. Dated permalinks with no sidebar entry, no
 *    inbound link and no sitemap listing, arrived at only via the 4:15 PM ET
 *    post that links one date. Subscribers reading these signals every day did
 *    not know it existed.
 * 2. Nothing aggregated a signal across sessions, so "is this any good?" could
 *    not be answered from the product — only from one session at a time.
 *
 * `scored` is shown next to `flips` rather than hidden. A signal that only
 * fires near the close has flips with no same-session forward price to grade
 * against, and stating that is the point: an absent measurement must not read
 * as a flat one.
 */
export default function ScorecardLink({
  signalName,
  symbol,
}: {
  signalName: string;
  symbol: string;
}) {
  const { data } = useSignalTrailingRecord(signalName, symbol, { sessions: 30 });
  const row = data?.signals?.[0];

  const pct = (v: number | null | undefined) =>
    v == null || !Number.isFinite(v) ? null : `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(2)}%`;
  const avg = pct(row?.avg_directional_return);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-secondary)]">
      {row && row.flips > 0 ? (
        row.scored > 0 ? (
          <span>
            <span className="font-medium text-[var(--color-text-primary)]">Last 30 sessions:</span>{' '}
            <span className="font-mono">{row.flips}</span> flips,{' '}
            <span className="font-mono">{row.scored}</span> scored,{' '}
            <span className="font-mono">
              {row.wins}–{row.losses}
            </span>
            {row.win_rate != null ? <> ({(row.win_rate * 100).toFixed(0)}%)</> : null}
            {avg ? (
              <>
                , avg{' '}
                <span
                  className="font-mono"
                  style={{
                    color:
                      (row.avg_directional_return ?? 0) > 0
                        ? 'var(--color-bull)'
                        : (row.avg_directional_return ?? 0) < 0
                          ? 'var(--color-bear)'
                          : undefined,
                  }}
                >
                  {avg}
                </span>
              </>
            ) : null}
          </span>
        ) : (
          <span
            title={`All ${row.flips} flips fired within the forward window of the close, so none had a same-session price to grade against. That is an absent measurement, not a flat result.`}
          >
            <span className="font-medium text-[var(--color-text-primary)]">Last 30 sessions:</span>{' '}
            <span className="font-mono">{row.flips}</span> flips, none scorable inside the session
          </span>
        )
      ) : null}
      <Link
        href="/scorecard"
        className="underline underline-offset-2 hover:text-[var(--color-text-primary)]"
      >
        See the daily scorecard
      </Link>
    </div>
  );
}
