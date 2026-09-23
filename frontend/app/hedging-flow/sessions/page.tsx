import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import PageShell from '@/components/layout/PageShell';
import SymbolPicker from '@/components/SymbolPicker';
import { CASH_SYMBOLS, buildSymbolHrefs, resolveSymbol } from '@/core/symbols';
import { serverApiGet } from '@/core/api/serverFetch';
import SessionCard from './SessionCard';

// The index behind the dated Hedging Flow permalinks. ISR-cached for an hour;
// the list only changes once per trading day.
//
// Deliberately a list of sessions that HAVE data rather than a date picker
// over the calendar — the same choice /replay and /scorecard make. A picker
// invites a reader onto an empty day and lets them conclude the feature is
// broken.

const REVALIDATE_SECONDS = 3600;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zerogex.io').replace(/\/+$/, '');

// A full regular session on the 5-minute grid is 82 bars (09:30–16:15 ET
// inclusive). The thresholds below grade against that, not against 78.
const FULL_SESSION_BARS = 82;

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
}

export const metadata: Metadata = {
  title: 'Hedging Flow — Past Sessions — ZeroGEX',
  description:
    'Every stored session of estimated dealer hedging pressure, bar by bar, with the dealer gamma structure on the same timeline.',
  alternates: { canonical: `${SITE_URL}/hedging-flow/sessions` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/hedging-flow/sessions`,
    title: 'Hedging Flow — Past Sessions — ZeroGEX',
    description: 'Dated permalinks for estimated dealer hedging pressure.',
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

async function loadSessions(symbol: string): Promise<HedgingFlowSessionList | null> {
  return serverApiGet<HedgingFlowSessionList>(
    `/api/flow/hedging/sessions?symbol=${symbol}&limit=90`,
    REVALIDATE_SECONDS,
  );
}

export default async function HedgingFlowSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const symbol = resolveSymbol((await searchParams)?.symbol);
  const data = await loadSessions(symbol);
  const sessions = data?.sessions ?? [];
  const pickerHrefs = buildSymbolHrefs((s) =>
    s === 'SPY' ? '/hedging-flow/sessions' : `/hedging-flow/sessions?symbol=${s}`,
  );

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
            No stored sessions for {symbol} yet. The snapshot is written once per analytics
            cycle, so the first one appears after the next trading day.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => {
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
        )}
      </section>

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
        pruned at 90 days — so a recomputed permalink would quietly go blank rather than
        missing. The finished 5-minute bars are written once per analytics cycle into{' '}
        <span className="font-mono">hedging_flow_5min</span> and kept, which is why a session
        from last spring still draws.
        <br />
        <br />
        Every number here remains an <strong>estimate</strong>. It assumes the passive side of
        each classified print was a market maker — an assumption that has not been validated
        against exchange-classified data. Storing a session does not promote it to an
        observation.
      </section>
    </PageShell>
  );
}
