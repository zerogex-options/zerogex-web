import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import PageShell from '@/components/layout/PageShell';
import SymbolPicker from '@/components/SymbolPicker';
import { CASH_SYMBOLS, buildSymbolHrefs, resolveSymbol } from '@/core/symbols';
import { serverApiGet } from '@/core/api/serverFetch';
import {
  groupByMonth,
  olderHref as resolveOlderHref,
  parseCursor,
  sessionsHref,
} from '@/core/hedgingFlowSessionIndex';
import SessionCard from './SessionCard';

// The index behind the dated Hedging Flow permalinks. ISR-cached for an hour;
// the list only changes once per trading day.
//
// Deliberately a list of sessions that HAVE data rather than a date picker
// over the calendar — the same choice /replay and /scorecard make. A picker
// invites a reader onto an empty day and lets them conclude the feature is
// broken.
//
// Paged, unlike /replay and /scorecard. Those read tables `make db-prune`
// empties at DATA_RETENTION_DAYS, so one request holds their entire contents
// permanently and their `limit=60` is not a page, it is everything. This list
// reads hedging_flow_5min, which is retention-exempt and gains a session every
// trading day, so a fixed request eventually stops showing the oldest sessions
// while their permalinks keep working perfectly. That failure is silent — the
// page looks complete, and the only symptom is history nobody can reach by
// browsing.

const REVALIDATE_SECONDS = 3600;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zerogex.io').replace(/\/+$/, '');

// A full regular session on the 5-minute grid is 82 bars (09:30–16:15 ET
// inclusive). The thresholds below grade against that, not against 78.
const FULL_SESSION_BARS = 82;

// One page of cards. Roughly four months of trading days: long enough that a
// reader rarely has to page at all, short enough to stay one quick scroll.
const PAGE_SIZE = 80;

interface HedgingFlowSession {
  date: string;
  bar_count: number;
  real_bar_count: number;
  had_0dte: boolean;
  cum_net_usd: number | null;
  first_bar: string | null;
  last_bar: string | null;
}

interface HedgingFlowSessionList {
  symbol: string;
  count: number;
  sessions: HedgingFlowSession[];
  /** Authoritative, from a row the API fetched and discarded. Deliberately not
   *  inferred from `count === PAGE_SIZE`, which is wrong on an exact multiple
   *  and offers a next page that renders as an empty archive. */
  has_more?: boolean;
  /** Feed back as `before` for the next page; null on the last one. */
  next_before?: string | null;
}





export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; before?: string }>;
}): Promise<Metadata> {
  const resolved = await searchParams;
  const symbol = resolveSymbol(resolved?.symbol);
  const cursor = parseCursor(resolved?.before);
  const title = 'Hedging Flow - Past Sessions - ZeroGEX';

  return {
    title,
    description:
      'Every stored session of estimated dealer hedging pressure, bar by bar, with the dealer gamma structure on the same timeline.',
    // Every page of the archive canonicalises to the first one: the deeper
    // pages are navigation, not content -- the content is the dated permalinks
    // they link to. `follow` is the part that matters, because those older
    // permalinks have no other route in for a crawler.
    alternates: { canonical: `${SITE_URL}/hedging-flow/sessions` },
    robots: cursor ? { index: false, follow: true } : undefined,
    openGraph: {
      type: 'website',
      url: `${SITE_URL}${sessionsHref(symbol, cursor)}`,
      title,
      description: 'Dated permalinks for estimated dealer hedging pressure.',
      siteName: 'ZeroGEX',
    },
  };
}

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

/**
 * Grade a session by the bars that carried real flow, not by the bars stored.
 *
 * The two differ: a quiet session is carried forward into a full grid of
 * synthetic bars, so counting rows would call a nearly empty day "full". What
 * a reader picking a session wants to know is how much of it actually traded.
 */
function sessionLabel(realBars: number): { label: string; tone: 'full' | 'partial' | 'thin' } {
  if (realBars >= FULL_SESSION_BARS * 0.9) return { label: 'Full session', tone: 'full' };
  if (realBars >= FULL_SESSION_BARS * 0.4) return { label: 'Partial', tone: 'partial' };
  return { label: 'Thin', tone: 'thin' };
}

function formatUsd(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

async function loadSessions(
  symbol: string,
  before: string | null,
): Promise<HedgingFlowSessionList | null> {
  const qs = new URLSearchParams({ symbol, limit: String(PAGE_SIZE) });
  if (before) qs.set('before', before);
  return serverApiGet<HedgingFlowSessionList>(
    `/api/flow/hedging/sessions?${qs.toString()}`,
    REVALIDATE_SECONDS,
  );
}

export default async function HedgingFlowSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; before?: string }>;
}) {
  const resolved = await searchParams;
  const symbol = resolveSymbol(resolved?.symbol);
  const cursor = parseCursor(resolved?.before);
  const data = await loadSessions(symbol, cursor);
  const sessions = data?.sessions ?? [];
  const months = groupByMonth(sessions);
  // Trust the API's own has_more rather than comparing count to PAGE_SIZE.
  const olderHref = resolveOlderHref(symbol, data);
  // Switching symbol restarts at the newest page: a cursor from one symbol's
  // history means nothing in another's, and carrying it over would drop a
  // reader into a random middle — or past the end, on a symbol whose snapshot
  // starts later, which reads as "this symbol has nothing".
  const pickerHrefs = buildSymbolHrefs((s) => sessionsHref(s, null));

  return (
    <PageShell width="measure">
      <div className="mb-5">
        <Link
          href="/hedging-flow"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] max-sm:min-h-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronLeft size={14} /> Live session
        </Link>
      </div>

      <header className="mb-6">
        {/* Stacked below `sm`: side by side, the picker squeezed "Past
            sessions" into two lines and ran off a phone's edge. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <div
              className="text-[11px] uppercase tracking-[0.22em] font-bold"
              style={{ color: 'var(--text-secondary)' }}
            >
              ZeroGEX · Hedging Flow
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Past sessions</h1>
          </div>
          {/* Cash only: the backend's futures middleware refuses the
              per-contract flow endpoints for ES / NQ, so offering them here
              would be offering an error. */}
          <SymbolPicker current={symbol} hrefs={pickerHrefs} symbols={CASH_SYMBOLS} />
        </div>
        <p
          className="mt-2 max-w-2xl text-sm leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          Every stored session of estimated dealer hedging pressure, with the dealer gamma
          structure on the same timeline. Each card shows where the session&rsquo;s cumulative
          lean finished and how much of the day actually traded; an expiry session also carries
          its 0DTE view.
        </p>
      </header>

      <section>
        {sessions.length === 0 ? (
          <div
            className="rounded-xl border p-8 text-center text-sm"
            style={{
              borderColor: 'var(--border-default)',
              background: 'var(--bg-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            {cursor ? (
              <>
                No stored sessions for {symbol} before {formatHumanDate(cursor)}&nbsp;- this is
                the start of its history.{' '}
                <Link href={sessionsHref(symbol, null)} className="underline">
                  Back to the latest sessions
                </Link>
                .
              </>
            ) : (
              <>
                No stored sessions for {symbol} yet. The snapshot is written once per analytics
                cycle, so the first one appears after the next trading day.
              </>
            )}
          </div>
        ) : (
          months.map((month) => (
            <div key={month.label} className="mb-7 last:mb-0">
              <h2
                className="mb-2 text-[11px] uppercase tracking-[0.22em] font-bold"
                style={{ color: 'var(--text-secondary)' }}
              >
                {month.label}
              </h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {month.sessions.map((session) => {
                  const meta = sessionLabel(session.real_bar_count);
                  const tone =
                    meta.tone === 'full'
                      ? 'var(--color-bull)'
                      : meta.tone === 'partial'
                        ? 'var(--color-warning)'
                        : 'var(--text-secondary)';
                  return (
                    <li key={session.date}>
                      <SessionCard
                        href={`/hedging-flow/${symbol}/${session.date}`}
                        humanDate={formatHumanDate(session.date)}
                        statusLabel={meta.label}
                        statusTone={tone}
                        barCount={session.real_bar_count}
                        leanLabel={
                          session.cum_net_usd != null ? formatUsd(session.cum_net_usd) : null
                        }
                        leanPositive={(session.cum_net_usd ?? 0) >= 0}
                        had0dte={session.had_0dte}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      {/* Paging. Rendered as links rather than a button so a crawler can follow
          them: these pages are the only route to the older permalinks. */}
      {(cursor || olderHref) && (
        <nav
          className="mt-8 flex items-center justify-between gap-3 border-t pt-5"
          style={{ borderColor: 'var(--border-default)' }}
          aria-label="Session pages"
        >
          {cursor ? (
            <Link
              href={sessionsHref(symbol, null)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] max-sm:min-h-8"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ChevronLeft size={14} /> Latest sessions
            </Link>
          ) : (
            <span />
          )}
          {olderHref ? (
            <Link
              href={olderHref}
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] max-sm:min-h-8"
              style={{ color: 'var(--text-secondary)' }}
            >
              Older sessions <ChevronRight size={14} />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      <section
        className="mt-10 rounded-lg border p-5 text-xs leading-relaxed"
        style={{
          borderColor: 'var(--border-default)',
          background: 'var(--bg-subtle)',
          color: 'var(--text-secondary)',
        }}
      >
        <div className="mb-1 text-[10px] uppercase tracking-[0.22em] font-bold">
          About these sessions
        </div>
        These are stored bars, not a re-run of the live pipeline. The trades a session is
        computed from live in <span className="font-mono">flow_contract_facts</span>, which is
        pruned on a rolling retention window&nbsp;- 60 days on this deployment&nbsp;- so a
        recomputed permalink would quietly go blank rather than missing. The finished 5-minute
        bars are written once per analytics cycle into{' '}
        <span className="font-mono">hedging_flow_5min</span> and kept past that window, which is
        why a session from months ago still draws.
        <br />
        <br />
        Every number here remains an <strong>estimate</strong>. It assumes the passive side of
        each classified print was a market maker&nbsp;- an assumption that has not been validated
        against exchange-classified data. Storing a session does not promote it to an
        observation.
      </section>
    </PageShell>
  );
}
