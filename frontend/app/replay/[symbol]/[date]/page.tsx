import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { serverApiGet } from '@/core/api/serverFetch';
import ShareCardButton from '@/components/ShareCardButton';
import SymbolPicker from '@/components/SymbolPicker';
import { buildSymbolHrefs, resolveSymbol } from '@/core/symbols';
import { getServerT } from '@/core/localizedContent';
import ReplayScrubber from './ReplayScrubber';
import { dict } from './page.i18n';

const REVALIDATE_SECONDS = 1800;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zerogex.io').replace(/\/+$/, '');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface ReplayFrame {
  timestamp: string;
  gamma_flip: number | null;
  call_wall: number | null;
  put_wall: number | null;
  strikes: Array<{ strike: number | null; net_gex: number | null }>;
}

interface ReplayCandle {
  timestamp: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  up_volume: number | null;
  down_volume: number | null;
  volume: number | null;
}

interface ReplayRangePayload {
  symbol: string;
  date: string;
  timeframe: string;
  is_today: boolean;
  count: number;
  frames: ReplayFrame[];
  candles: ReplayCandle[];
}

function isValidDate(raw: string): boolean {
  if (!ISO_DATE.test(raw)) return false;
  return Number.isFinite(Date.parse(`${raw}T00:00:00Z`));
}

function formatHumanDate(raw: string): string {
  try {
    const dt = new Date(`${raw}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dt);
  } catch {
    return raw;
  }
}

async function loadRange(date: string, symbol: string): Promise<ReplayRangePayload | null> {
  return serverApiGet<ReplayRangePayload>(
    `/api/replay/range?symbol=${symbol}&date=${date}&timeframe=1min`,
    REVALIDATE_SECONDS,
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string; date: string }>;
}): Promise<Metadata> {
  const { symbol, date } = await params;
  const sym = resolveSymbol(symbol);
  const human = formatHumanDate(date);
  const url = `${SITE_URL}/replay/${sym}/${date}`;
  return {
    title: `${sym} GEX Replay · ${human} — ZeroGEX`,
    description: `Scrub through ${sym}'s dealer gamma surface minute-by-minute on ${human}. Drop two pins to see the strike-by-strike delta between any moments.`,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: `${sym} GEX Replay · ${human}`,
      description: 'Per-minute scrubber over the day’s dealer gamma surface.',
      siteName: 'ZeroGEX',
    },
  };
}

export default async function ReplayDatePage({
  params,
}: {
  params: Promise<{ symbol: string; date: string }>;
}) {
  const { symbol, date } = await params;
  const sym = resolveSymbol(symbol);
  if (!isValidDate(date)) notFound();
  const t = await getServerT(dict);
  const data = await loadRange(date, sym);
  if (!data || data.frames.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-5">
          <Link
            href="/replay"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <ChevronLeft size={14} /> {t('allSessions')}
          </Link>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-8 text-sm text-[var(--color-text-secondary)]">
          {t('noFramesTitle', { sym, date: formatHumanDate(date) })} {t('noFramesBody')}
        </div>
      </main>
    );
  }
  const human = formatHumanDate(date);
  const pickerHrefs = buildSymbolHrefs((s) => `/replay/${s}/${date}`);
  const permalink = `${SITE_URL}/replay/${sym}/${date}`;
  const tweetBody = `${sym} ${date} GEX replay — scrub the dealer gamma surface minute-by-minute.`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/replay"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft size={14} /> {t('allSessions')}
        </Link>
        <ShareCardButton
          cardId={`replay:${sym}:${date}`}
          tweetText={tweetBody}
          cardUrl={permalink}
          eventName="replay_share_clicked"
        />
      </div>
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
              ZeroGEX · {t('replayLabel')}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {sym} · {human}
            </h1>
            <p className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">
              {data.count} {t('perMinuteFrames')} · {data.is_today ? t('liveToday') : t('historical')}
            </p>
          </div>
          <SymbolPicker current={sym} hrefs={pickerHrefs} />
        </div>
      </header>

      <ReplayScrubber
        symbol={sym}
        sessionDate={date}
        initialFrames={data.frames}
        initialCandles={data.candles ?? []}
        siteUrl={SITE_URL}
      />

      <section className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
        <div className="mb-1 text-[10px] uppercase tracking-[0.22em] font-bold">{t('howToUse')}</div>
        {t('howToUseBody1')} <em>{t('futureLabel')}</em> {t('howToUseBody2')} <em>{t('snapshotLabel')}</em>{' '}
        {t('howToUseBody3')}
      </section>
    </main>
  );
}
