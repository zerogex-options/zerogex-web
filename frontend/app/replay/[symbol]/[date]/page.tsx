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
  max_pain: number | null;
  // Pin Strike (+ confidence) ride along per minute so the scrubber can draw
  // the pin line; null on rows written before pin_strike shipped.
  pin_strike: number | null;
  pin_confidence: number | null;
  // call_gex / put_gex are the same per-strike dealer gamma columns net_gex is
  // sourced from (gex_by_strike); optional so the scrubber's Split / Combined
  // views light up when the payload carries them and cleanly fall back to the
  // Net-only view when it doesn't.
  strikes: Array<{
    strike: number | null;
    net_gex: number | null;
    call_gex?: number | null;
    put_gex?: number | null;
    // Per-expiration shares of this strike's call / put bar (fractions summing
    // to 1), aligned positionally to the payload's `expirations` legend. Only
    // present when the request opts in, and only for strikes the mix covers.
    call_shares?: number[] | null;
    put_shares?: number[] | null;
  }>;
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
  // Nearest-first expiration legend the per-strike share arrays index into; the
  // trailing entry may be the literal "far" (a catch-all for everything past
  // the API's expiration cap). Absent unless include_expirations was requested.
  expirations?: string[];
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
  // include_expirations attaches the per-strike expiration mix that colour-
  // grades each gamma bar by time-to-expiry (nearest boldest → furthest
  // faintest). It costs a second session-wide scan server-side, which is why
  // it's opt-in — this page draws the gradient, so it opts in; the pair-
  // comparison scrubber reads the same endpoint without it.
  return serverApiGet<ReplayRangePayload>(
    `/api/replay/range?symbol=${symbol}&date=${date}&timeframe=1min&include_expirations=true`,
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
  // Two different things, and they used to print the same sentence.
  //
  // `data === null` is `serverApiGet` reporting that the CALL failed — the
  // backend was unreachable, the token is missing, the frames read timed out
  // (the API answers 503 for that specifically). Nothing was learned about the
  // session. `data.frames.length === 0` is the API answering successfully that
  // the session has no frames.
  //
  // Collapsing the two meant a backend outage rendered as a confident claim
  // about our own ingestion — the visitor is told the data was never written,
  // and a screenshot of it rules nothing out for whoever gets asked why the
  // replay is blank. The reason lands in the Next.js server log either way
  // (see `serverApiGet`); this just stops the page from overstating it.
  if (!data || data.frames.length === 0) {
    const unavailable = !data;
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
          {unavailable ? (
            <>
              Couldn&rsquo;t load the {sym} replay for {formatHumanDate(date)} just now — the
              data service didn&rsquo;t answer. This is on our side, not a gap in the session.
              Refresh in a moment, or{' '}
              <Link href="/replay" className="underline hover:text-[var(--color-text-primary)]">
                pick another session
              </Link>
              .
            </>
          ) : (
            <>
              No replayable frames for {sym} on {formatHumanDate(date)}. Either the session
              predates GEX ingestion or the analytics engine didn&rsquo;t write that day.
            </>
          )}
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
        expirations={data.expirations ?? []}
      />

      <section className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
        <div className="mb-1 text-[10px] uppercase tracking-[0.22em] font-bold">How to use</div>
        Drag the scrubber to any minute · use play/pause to auto-advance · the combined chart puts
        the session tape on the left and the dealer-net-GEX strike profile on the right, sharing
        the same price axis so a wick and a strike bar at the same level line up horizontally ·
        the call wall (resistance), put wall (support), and gamma flip draw as horizontal levels
        that migrate minute-by-minute as you scrub ·
        toggle the strike profile between <em>Split</em> (call vs. put gamma), <em>Net</em>, and
        <em>Combined</em> (the split with the purple net bar overlaid) — same views as the Strike
        Profile chart ·
        candles past the cursor ghost out and light back to full opacity as the playhead sweeps
        through them — or hit <em>Future</em> to hide everything ahead of the playhead for an
        as-it-happened tape · drop pin A then pin B to see the strike-by-strike delta between two moments ·
        click <em>Snapshot this minute</em> to generate a branded permalink with an OG image you
        can share. MP4 export of arbitrary windows is on the roadmap; today you share branded
        stills of the moments that mattered.
      </section>
    </main>
  );
}
