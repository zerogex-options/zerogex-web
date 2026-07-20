import type { Metadata } from 'next';
import Link from 'next/link';

import { serverApiGet } from '@/core/api/serverFetch';
import SymbolPicker from '@/components/SymbolPicker';
import { buildSymbolHrefs, resolveSymbol } from '@/core/symbols';
import { getServerT } from '@/core/localizedContent';
import { dict } from './page.i18n';

type ServerT = (key: string, vars?: Record<string, string | number>) => string;

// Landing page for /forecast — lists every trading day the writer has
// committed a daily_forecast row for, links to /forecast/[date]. Mirrors
// the /replay landing page pattern.  ISR-cached hourly; new dates only
// arrive after the 07:00 writer + 16:05 receipt cycle each trading day.

const REVALIDATE_SECONDS = 3600;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zerogex.io').replace(/\/+$/, '');

interface ForecastDateEntry {
  date: string;
  regime: string | null;
  has_receipt: boolean;
  range_respected: boolean | null;
  pin_hit: boolean | null;
  regime_correct: boolean | null;
  expected_vol_state: string | null;
  vol_state_correct: boolean | null;
}

interface ForecastDateList {
  symbol: string;
  count: number;
  dates: ForecastDateEntry[];
}

export const metadata: Metadata = {
  title: 'Gamma Forecast — ZeroGEX',
  description:
    'Every morning we commit to a projected range, an expected-volatility call, and key gamma levels with touch odds — never a direction call — then grade ourselves at 4 PM. Browse the receipts.',
  alternates: { canonical: `${SITE_URL}/forecast` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/forecast`,
    title: 'Gamma Forecast — ZeroGEX',
    description: 'Daily 7 AM commitments graded against realized 4 PM close.',
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

function humanizeRegime(raw: string | null, t: ServerT): string {
  if (!raw) return t('unknownRegime');
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

// The receipt landed but at least one verdict came back false — flag it
// so the picker can lead with the days we called wrong (they're the most
// interesting).
function verdictSummary(entry: ForecastDateEntry, t: ServerT): { label: string; tone: string } {
  if (!entry.has_receipt) return { label: t('pendingLabel'), tone: 'var(--color-text-secondary)' };
  const flags = [entry.range_respected, entry.vol_state_correct];
  const graded = flags.filter((f) => f != null);
  const wins = graded.filter((f) => f === true).length;
  if (graded.length === 0) return { label: t('ungradedLabel'), tone: 'var(--color-text-secondary)' };
  if (wins === graded.length) {
    return { label: t('cleanLabel', { wins, graded: graded.length }), tone: 'var(--color-bull)' };
  }
  if (wins === 0) {
    return { label: t('missedLabel', { wins: 0, graded: graded.length }), tone: 'var(--color-bear)' };
  }
  return { label: t('mixedLabel', { wins, graded: graded.length }), tone: 'var(--color-warning)' };
}

async function loadDates(symbol: string): Promise<ForecastDateList | null> {
  return serverApiGet<ForecastDateList>(
    `/api/forecast/available-dates?symbol=${symbol}&limit=60`,
    REVALIDATE_SECONDS,
  );
}

export default async function ForecastLanding({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const t = await getServerT(dict);
  const symbol = resolveSymbol((await searchParams)?.symbol);
  const data = await loadDates(symbol);
  const entries = data?.dates ?? [];
  const pickerHrefs = buildSymbolHrefs((s) => (s === 'SPY' ? '/forecast' : `/forecast?symbol=${s}`));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
              {t('kicker')}
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {t('heading')}
            </h1>
          </div>
          <SymbolPicker current={symbol} hrefs={pickerHrefs} />
        </div>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {t('intro', { symbol })}
        </p>
      </header>

      <section>
        {entries.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
            {t('emptyState', { symbol })}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => {
              const verdict = verdictSummary(entry, t);
              return (
                <li key={entry.date}>
                  <Link
                    href={`/forecast/${symbol}/${entry.date}`}
                    className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 transition-colors hover:bg-[var(--color-surface-subtle)]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-semibold">{formatHumanDate(entry.date)}</div>
                      <div
                        className="text-[10px] uppercase tracking-[0.18em] font-bold"
                        style={{ color: verdict.tone }}
                      >
                        {verdict.label}
                      </div>
                    </div>
                    <div
                      className="mt-1 font-mono text-[11px]"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      {humanizeRegime(entry.expected_vol_state, t)} {t('volSuffix')}
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
        {t('aboutPart1')} <span className="font-mono">daily_forecast</span> {t('aboutPart2')}{' '}
        <span className="font-mono">underlying_quotes</span> {t('aboutPart3')}
      </section>
    </main>
  );
}
