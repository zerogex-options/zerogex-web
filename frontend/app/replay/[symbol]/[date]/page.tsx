import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { serverApiGet } from '@/core/api/serverFetch';
import ShareCardButton from '@/components/ShareCardButton';
import SymbolPicker from '@/components/SymbolPicker';
import { buildSymbolHrefs, resolveSymbol } from '@/core/symbols';
import ReplayScrubber from './ReplayScrubber';

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
  const data = await loadRange(date, sym);
  if (!data || data.frames.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-5">
          <Link
            href="/replay"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <ChevronLeft size={14} /> All sessions
          </Link>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-8 text-sm text-[var(--color-text-secondary)]">
          No replayable frames for {sym} on {formatHumanDate(date)}. Either the session
          predates GEX ingestion or the analytics engine didn&rsquo;t write that day.
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
          <ChevronLeft size={14} /> All sessions
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
              ZeroGEX · GEX Replay
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {sym} · {human}
            </h1>
            <p className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">
              {data.count} per-minute frames · {data.is_today ? 'live (today)' : 'historical'}
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
        <div className="mb-1 text-[10px] uppercase tracking-[0.22em] font-bold">How to use</div>
        Drag the scrubber to any minute · use play/pause to auto-advance · the combined chart puts
        the session tape on the left and the dealer-net-GEX strike profile on the right, sharing
        the same price axis so a wick and a strike bar at the same level line up horizontally ·
        the call wall (resistance), put wall (support), and gamma flip draw as horizontal levels
        that migrate minute-by-minute as you scrub ·
        candles past the cursor ghost out and light back to full opacity as the playhead sweeps
        through them · drop pin A then pin B to see the strike-by-strike delta between two moments ·
        click <em>Snapshot this minute</em> to generate a branded permalink with an OG image you
        can share. MP4 export of arbitrary windows is on the roadmap; today you share branded
        stills of the moments that mattered.
      </section>
    </main>
  );
}
