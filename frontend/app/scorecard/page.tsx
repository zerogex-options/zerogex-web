import type { Metadata } from 'next';

import { serverApiGet } from '@/core/api/serverFetch';
import SymbolPicker from '@/components/SymbolPicker';
import { buildSymbolHrefs, resolveSymbol } from '@/core/symbols';
import ScorecardSessionCard from './SessionCard';

// Landing page for /scorecard — lists the recent trading days that have a
// scorecard and links to /scorecard/[symbol]/[date]. ISR-cached for an hour;
// the session list only changes once per trading day.
//
// This page exists because the Scorecard had no entry point at all: dated
// permalinks, no sidebar entry, no inbound link, and missing from the sitemap.
// The only way in was the 4:15 PM ET post that links a single date.

const REVALIDATE_SECONDS = 3600;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zerogex.io').replace(/\/+$/, '');

interface ScorecardSession {
  date: string;
  cards: number;
  regime: string;
  composite_score: number | null;
}

interface ScorecardSessionList {
  symbol: string;
  count: number;
  sessions: ScorecardSession[];
}

export const metadata: Metadata = {
  title: 'Daily Scorecard — ZeroGEX',
  description:
    "Every session's signal receipt: how many Playbook calls fired, which signals flipped, how many of those flips could be graded, and how they resolved.",
  alternates: { canonical: `${SITE_URL}/scorecard` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/scorecard`,
    title: 'Daily Scorecard — ZeroGEX',
    description: 'Per-session, per-signal receipts for the ZeroGEX engine.',
    siteName: 'ZeroGEX',
  },
};

function formatHumanDate(raw: string): string {
  try {
    const dt = new Date(`${raw}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dt);
  } catch {
    return raw;
  }
}

function regimeTone(regime: string): string {
  switch (regime) {
    case 'long gamma':
      return 'var(--color-bull)';
    case 'short gamma':
      return 'var(--color-bear)';
    case 'transition':
      return 'var(--color-warning)';
    default:
      // "unknown" — the engine wrote no closing regime for that day. Not a
      // regime, so it must not borrow the color of one.
      return 'var(--color-text-secondary)';
  }
}

async function loadSessions(symbol: string): Promise<ScorecardSessionList | null> {
  return serverApiGet<ScorecardSessionList>(
    `/api/scorecard/sessions?symbol=${symbol}&limit=60`,
    REVALIDATE_SECONDS,
  );
}

export default async function ScorecardLanding({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const symbol = resolveSymbol((await searchParams)?.symbol);
  const data = await loadSessions(symbol);
  const sessions = data?.sessions ?? [];
  const pickerHrefs = buildSymbolHrefs((s) =>
    s === 'SPY' ? '/scorecard' : `/scorecard?symbol=${s}`,
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        {/* Picker under the title on a phone: beside it, it squeezed the
            heading into a four-line column and ran its chips off screen. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] sm:tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
              ZeroGEX · Daily Scorecard
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              What the engine actually called
            </h1>
          </div>
          {/* Six chips are ~350px: on a phone they scroll sideways, edge to
              edge, rather than run off the screen. */}
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
            <SymbolPicker current={symbol} hrefs={pickerHrefs} />
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)] leading-relaxed">
          One receipt per session, written after the close and never edited afterward. Each day
          lists every signal&rsquo;s direction flips, how many of those flips could be graded
          against a price from the same session, and how they resolved — alongside the Playbook
          calls that fired and the regime the day closed in.
        </p>
      </header>

      <section>
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
            No scorecards for {symbol} yet. Check back after the next trading day.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <li key={session.date}>
                <ScorecardSessionCard
                  href={`/scorecard/${symbol}/${session.date}`}
                  humanDate={formatHumanDate(session.date)}
                  regime={session.regime}
                  regimeTone={regimeTone(session.regime)}
                  cards={session.cards}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-[13px] text-[var(--color-text-secondary)] leading-relaxed sm:p-5 sm:text-xs">
        <div className="mb-1 text-[10px] uppercase tracking-[0.22em] font-bold">
          About the Scorecard
        </div>
        A &ldquo;flip&rdquo; is a signal changing direction; it is graded on where price sat{' '}
        60 minutes later. That forward price must come from the same regular session, so a flip
        inside the last hour of trading has nothing to grade against and is counted but not
        scored — which is why a signal that only fires near the close, like EOD Pressure, can
        read &ldquo;not scorable&rdquo; for a whole day. That is an absent measurement, not a
        flat one. Each receipt is immutable once written: the engine cannot retroactively edit a
        published scorecard.
      </section>
    </main>
  );
}
