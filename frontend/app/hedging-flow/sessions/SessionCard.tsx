'use client';

import Link, { useLinkStatus } from 'next/link';

/**
 * One session tile on /hedging-flow/sessions.
 *
 * Shaped after /replay's card and for the same reason: a dated page is a real
 * fetch, so the tile the reader clicked has to acknowledge the click before
 * the route paints. The visuals live on the inner element because
 * `useLinkStatus` only reports from inside a <Link>.
 *
 * Where it differs is what it says. A replay tile grades completeness; this
 * one also carries the session's closing lean, because "which day do I want"
 * is a question about what happened, and a column of dates cannot answer it.
 */

interface SessionCardProps {
  href: string;
  humanDate: string;
  /** "Full session" / "Partial" / "Thin". */
  statusLabel: string;
  /** CSS color for the status label, keyed to that tone. */
  statusTone: string;
  barCount: number;
  /** The session's closing cumulative lean, pre-formatted. Null when unknown. */
  leanLabel: string | null;
  leanPositive: boolean;
  had0dte: boolean;
}

function CardBody({
  humanDate,
  statusLabel,
  statusTone,
  barCount,
  leanLabel,
  leanPositive,
  had0dte,
}: Omit<SessionCardProps, 'href'>) {
  const { pending } = useLinkStatus();

  return (
    <div
      aria-busy={pending}
      className="rounded-xl border px-4 py-3 transition-colors"
      style={{
        borderColor: pending ? 'var(--accent-2)' : 'var(--border-default)',
        background: pending ? 'var(--bg-subtle)' : 'var(--bg-card)',
      }}
    >
      {/* Both halves of this row refuse to wrap. Letting them wrap made a long
          date break on some cards and not others, so a grid of sessions came
          out with mismatched heights. */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-semibold whitespace-nowrap">{humanDate}</div>
        {/* Swapped in place rather than appended: the row keeps its width, so
            the card doesn't reflow under the cursor as it starts loading. */}
        {pending ? (
          <div
            className="whitespace-nowrap text-[10px] uppercase tracking-[0.18em] font-bold"
            style={{ color: 'var(--text-secondary)' }}
          >
            Loading
          </div>
        ) : (
          <div
            className="whitespace-nowrap text-[10px] uppercase tracking-[0.18em] font-bold"
            style={{ color: statusTone }}
          >
            {statusLabel}
          </div>
        )}
      </div>

      {leanLabel && (
        <div
          className="mt-1.5 font-mono text-[13px] font-semibold"
          style={{ color: leanPositive ? 'var(--color-bull)' : 'var(--color-bear)' }}
        >
          {leanLabel}
        </div>
      )}

      <div
        className="mt-1 flex items-center gap-2 font-mono text-[11px]"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span>{barCount} bars</span>
        {had0dte && (
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
            title="This session was an expiry, so the 0DTE view has data"
          >
            0DTE
          </span>
        )}
      </div>
    </div>
  );
}

export default function HedgingFlowSessionCard({ href, ...body }: SessionCardProps) {
  return (
    <Link href={href} className="block rounded-xl">
      <CardBody {...body} />
    </Link>
  );
}
