import type { Metadata } from 'next';
import Link from 'next/link';

import { serverApiGet } from '@/core/api/serverFetch';
import SymbolPicker from '@/components/SymbolPicker';
import { buildSymbolHrefs, resolveSymbol } from '@/core/symbols';
import { getServerT } from '@/core/localizedContent';
import { dict } from './page.i18n';

// Landing page for /replay — lists the recent trading days that have
// replayable GEX data and links to /replay/[date]. ISR-cached for an
// hour; the session list only changes once per trading day.

const REVALIDATE_SECONDS = 3600;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zerogex.io').replace(/\/+$/, '');

interface ReplaySession {
  date: string;
  bar_count: number;
  first_ts: string | null;
  last_ts: string | null;
}

interface ReplaySessionList {
  symbol: string;
  count: number;
  sessions: ReplaySession[];
}

export const metadata: Metadata = {
  title: 'GEX Replay — ZeroGEX',
  description:
    'Scrub through any past session to watch dealer gamma positioning shift minute-by-minute. The historical viewer no other GEX tool ships.',
  alternates: { canonical: `${SITE_URL}/replay` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/replay`,
    title: 'GEX Replay — ZeroGEX',
    description: 'Per-minute scrubber over historical dealer gamma surfaces.',
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

function sessionTone(bars: number): 'full' | 'partial' | 'thin' {
  if (bars >= 380) return 'full';
  if (bars >= 120) return 'partial';
  return 'thin';
}

async function loadSessions(symbol: string): Promise<ReplaySessionList | null> {
  return serverApiGet<ReplaySessionList>(
    `/api/replay/sessions?symbol=${symbol}&limit=60`,
    REVALIDATE_SECONDS,
  );
}

export default async function ReplayLanding({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const t = await getServerT(dict);
  const symbol = resolveSymbol((await searchParams)?.symbol);
  const data = await loadSessions(symbol);
  const sessions = data?.sessions ?? [];
  const pickerHrefs = buildSymbolHrefs((s) => (s === 'SPY' ? '/replay' : `/replay?symbol=${s}`));
  const toneLabels: Record<'full' | 'partial' | 'thin', string> = {
    full: t('fullSession'),
    partial: t('partial'),
    thin: t('thin'),
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
              ZeroGEX · GEX Replay
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {t('heading')}
            </h1>
          </div>
          <SymbolPicker current={symbol} hrefs={pickerHrefs} />
        </div>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {t('intro', { count: String(sessions.length || '90') })}
        </p>
      </header>

      <section>
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
            {t('noSessions', { symbol })}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => {
              const toneKey = sessionTone(session.bar_count);
              const tone =
                toneKey === 'full' ? 'var(--color-bull)' :
                toneKey === 'partial' ? 'var(--color-warning)' :
                'var(--color-text-secondary)';
              return (
                <li key={session.date}>
                  <Link
                    href={`/replay/${symbol}/${session.date}`}
                    className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 transition-colors hover:bg-[var(--color-surface-subtle)]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-semibold">{formatHumanDate(session.date)}</div>
                      <div
                        className="text-[10px] uppercase tracking-[0.18em] font-bold"
                        style={{ color: tone }}
                      >
                        {toneLabels[toneKey]}
                      </div>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-[var(--color-text-secondary)]">
                      {session.bar_count} bars
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
        <div className="mb-1 text-[10px] uppercase tracking-[0.22em] font-bold">{t('aboutHeading')}</div>
        {t('aboutPre')}{' '}
        <span className="font-mono">gex_summary</span> {t('aboutMid')}{' '}
        <span className="font-mono">gex_by_strike</span> {t('aboutPost')}
      </section>
    </main>
  );
}
