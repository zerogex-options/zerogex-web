import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Magnet, TrendingUp } from 'lucide-react';

import ShareCardButton from '@/components/ShareCardButton';
import SymbolPicker from '@/components/SymbolPicker';
import { buildSymbolHrefs, resolveSymbol } from '@/core/symbols';
import { serverApiGet } from '@/core/api/serverFetch';
import { getServerT } from '@/core/localizedContent';
import StrikeProfileSnapshot from './StrikeProfileSnapshot';
import { dict } from './page.i18n';

// Permalink page for a single replay moment. /replay/{date}/snapshot/{HHMM}
// resolves the HHMM-in-ET token to an absolute UTC timestamp, fetches one
// frame, and renders a branded shareable card with the deep-link back into
// the scrubber. The companion opengraph-image.tsx generates the 1200x630
// Twitter preview.

const REVALIDATE_SECONDS = 86400;  // historical moments never change
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zerogex.io').replace(/\/+$/, '');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{4}$/;

interface FramePayload {
  symbol: string;
  requested_ts: string;
  frame_ts: string;
  summary: {
    spot: number | null;
    call_wall: number | null;
    put_wall: number | null;
    gamma_flip: number | null;
    max_pain: number | null;
    net_gex: number | null;
  } | null;
  strikes: Array<{ strike: number | null; net_gex: number | null }>;
}

function hhmmToIsoUtc(date: string, hhmm: string): string | null {
  if (!ISO_DATE.test(date) || !HHMM.test(hhmm)) return null;
  const hh = Number.parseInt(hhmm.slice(0, 2), 10);
  const mm = Number.parseInt(hhmm.slice(2, 4), 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  // Construct an absolute timestamp by formatting the requested HH:MM
  // through the ET zone — Intl.DateTimeFormat anchors the date.
  // We round-trip via a UTC isostring; the backend resolves at-or-before.
  // The backend snaps to the nearest available frame, so a slight offset
  // doesn't matter for correctness.
  try {
    // 13:30 UTC == 09:30 EDT == 09:30 EST without the offset… so we
    // need a real ET → UTC conversion. The simplest portable way is to
    // assemble an "ET wall-clock" Date by parsing with Intl ZoneInfo
    // via a known anchor; here we use the Etc/GMT trick: build a UTC
    // timestamp, ask Intl what its ET wall-clock reads, then back-solve.
    const anchorUtc = new Date(`${date}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00Z`);
    const partsEt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(anchorUtc);
    const get = (t: string) => Number.parseInt(partsEt.find((p) => p.type === t)?.value ?? '0', 10);
    const etHour = get('hour');
    const etMinute = get('minute');
    // Offset in minutes between anchor-UTC's ET wall-clock and the requested ET wall-clock.
    const deltaMin = (etHour * 60 + etMinute) - (hh * 60 + mm);
    const targetUtc = new Date(anchorUtc.getTime() - deltaMin * 60_000);
    return targetUtc.toISOString();
  } catch {
    return null;
  }
}

function formatHumanDate(raw: string): string {
  try {
    const dt = new Date(`${raw}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      timeZone: 'UTC',
    }).format(dt);
  } catch {
    return raw;
  }
}

function formatTimeEt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/New_York', hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fmtPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
}

async function loadFrame(date: string, hhmm: string, symbol: string): Promise<FramePayload | null> {
  const iso = hhmmToIsoUtc(date, hhmm);
  if (iso == null) return null;
  const qs = new URLSearchParams({ symbol, ts: iso }).toString();
  return serverApiGet<FramePayload>(`/api/replay/frame?${qs}`, REVALIDATE_SECONDS);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string; date: string; time: string }>;
}): Promise<Metadata> {
  const { symbol, date, time } = await params;
  const sym = resolveSymbol(symbol);
  const url = `${SITE_URL}/replay/${sym}/${date}/snapshot/${time}`;
  const human = formatHumanDate(date);
  const minute = `${time.slice(0, 2)}:${time.slice(2, 4)} ET`;
  return {
    title: `${sym} GEX @ ${minute} · ${human} — ZeroGEX`,
    description: `Dealer gamma surface for ${sym} at ${minute} on ${human}. One-click snapshot from the ZeroGEX Replay player.`,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: `${sym} GEX @ ${minute} · ${human}`,
      description: 'Snapshot from the ZeroGEX historical replay.',
      siteName: 'ZeroGEX',
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630, alt: `${sym} GEX snapshot` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${sym} GEX @ ${minute} · ${human}`,
      images: [`${url}/opengraph-image`],
    },
  };
}

export default async function ReplaySnapshotPage({
  params,
}: {
  params: Promise<{ symbol: string; date: string; time: string }>;
}) {
  const { symbol, date, time } = await params;
  const t = await getServerT(dict);
  const sym = resolveSymbol(symbol);
  if (!ISO_DATE.test(date) || !HHMM.test(time)) notFound();
  const frame = await loadFrame(date, time, sym);
  if (!frame) notFound();

  const minute = `${time.slice(0, 2)}:${time.slice(2, 4)} ET`;
  const human = formatHumanDate(date);
  const permalink = `${SITE_URL}/replay/${sym}/${date}/snapshot/${time}`;
  const pickerHrefs = buildSymbolHrefs((s) => `/replay/${s}/${date}/snapshot/${time}`);
  const tweetBody = `${sym} GEX surface at ${minute} on ${human}.`;
  const summary = frame.summary;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/replay/${sym}/${date}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft size={14} /> {t('backToPlayer')}
        </Link>
        <ShareCardButton
          cardId={`${sym}:${date}:${time}`}
          tweetText={tweetBody}
          cardUrl={permalink}
          eventName="replay_share_clicked"
        />
      </div>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
              {t('replaySnapshot')}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {sym} · {human} @ {minute}
            </h1>
            <p className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">
              {t('frameLabel', { frameTime: formatTimeEt(frame.frame_ts), requestedTime: formatTimeEt(frame.requested_ts) })}
            </p>
          </div>
          <SymbolPicker current={sym} hrefs={pickerHrefs} />
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('spot')} value={fmtPrice(summary?.spot)} accent="var(--color-text-primary)" icon={TrendingUp} />
        <Stat label={t('callWall')} value={fmtPrice(summary?.call_wall)} accent="var(--color-bear)" />
        <Stat label={t('putWall')} value={fmtPrice(summary?.put_wall)} accent="var(--color-bull)" />
        <Stat label={t('gammaFlip')} value={fmtPrice(summary?.gamma_flip)} accent="var(--color-warning)" />
      </section>

      {summary?.max_pain != null && (
        <section className="mb-6 rounded-xl border-2 border-[var(--color-warning)] bg-[var(--color-surface)] px-5 py-4">
          <div className="flex items-baseline gap-2 text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
            <Magnet size={11} /> {t('maxPainLabel')}
          </div>
          <div className="mt-1 text-3xl font-black tracking-tight">
            {fmtPrice(summary.max_pain)}
          </div>
        </section>
      )}

      <section className="mb-6">
        <StrikeProfileSnapshot
          strikes={frame.strikes}
          spot={summary?.spot ?? null}
          gammaFlip={summary?.gamma_flip ?? null}
          callWall={summary?.call_wall ?? null}
          putWall={summary?.put_wall ?? null}
        />
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
        <div className="mb-1 text-[10px] uppercase tracking-[0.22em] font-bold">{t('aboutTitle')}</div>
        {t('aboutText1')} {' '}
        <span className="font-mono">gex_summary</span> {t('aboutText2')}{' '}
        <span className="font-mono">gex_by_strike</span> {t('aboutText3')}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon?: typeof TrendingUp;
}) {
  return (
    <div className="rounded-xl border-2 bg-[var(--color-surface)] px-4 py-4" style={{ borderColor: accent }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
        {Icon ? <Icon size={11} /> : null}
        {label}
      </div>
      <div className="mt-1 text-xl font-black tracking-tight" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}
