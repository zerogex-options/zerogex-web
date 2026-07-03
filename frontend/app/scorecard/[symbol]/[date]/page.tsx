import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, TrendingDown, TrendingUp } from 'lucide-react';

import ShareCardButton from '@/components/ShareCardButton';
import SymbolPicker from '@/components/SymbolPicker';
import { buildSymbolHrefs, resolveSymbol } from '@/core/symbols';
import { serverApiGet } from '@/core/api/serverFetch';

// Public permalink for one trading day's Scorecard recap. Server-rendered,
// ISR-cached for one hour after the close (the underlying scorecard is
// immutable once the day's last signal_score row is in). The companion
// opengraph-image.tsx renders the branded 1200x630 Twitter preview that
// the 4:15 PM ET auto-tweet job links to.

const REVALIDATE_SECONDS = 3600;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zerogex.io').replace(/\/+$/, '');

interface ScorecardSignalRow {
  name: string;
  flips: number;
  scored: number;
  wins: number;
  losses: number;
  avg_directional_return: number | null;
}

interface ScorecardPayload {
  date: string;
  symbol: string;
  tz: string;
  horizon_minutes: number;
  cards: {
    total: number;
    by_action: Array<{ action: string; count: number }>;
    first_card_id: number | null;
    first_card_permalink: string | null;
  };
  signals: {
    events: ScorecardSignalRow[];
    best: ScorecardSignalRow | null;
    worst: ScorecardSignalRow | null;
  };
  regime: {
    timestamp?: string;
    composite_score?: number | null;
    normalized_score?: number | null;
    direction?: string | null;
    label?: string;
  } | null;
  tweet_text: string;
  is_empty: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(raw: string): boolean {
  if (!ISO_DATE.test(raw)) return false;
  const ts = Date.parse(`${raw}T00:00:00Z`);
  return Number.isFinite(ts);
}

function formatHumanDate(raw: string): string {
  // 2026-06-29 → "Mon, Jun 29 2026" — readable but locale-neutral.
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

function humanizeName(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const pct = value * 100;
  const sign = pct >= 0 ? '+' : '−';
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

async function loadScorecard(day: string, symbol: string): Promise<ScorecardPayload | null> {
  const qs = new URLSearchParams({ date: day, symbol }).toString();
  return serverApiGet<ScorecardPayload>(`/api/scorecard/daily?${qs}`, REVALIDATE_SECONDS);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string; date: string }>;
}): Promise<Metadata> {
  const { symbol, date } = await params;
  const sym = resolveSymbol(symbol);
  if (!isValidDate(date)) {
    return { title: 'Scorecard not found — ZeroGEX', robots: { index: false, follow: false } };
  }
  const data = await loadScorecard(date, sym);
  const human = formatHumanDate(date);
  const title = data && !data.is_empty
    ? `${sym} · ${human} Recap — ZeroGEX Scorecard`
    : `${sym} · ${human} — ZeroGEX Scorecard`;
  const description = data?.tweet_text
    ? data.tweet_text.split('\n')[0]
    : 'Daily aggregate of ZeroGEX Playbook calls + per-signal P&L. One number per day, time-stamped and shareable.';
  const url = `${SITE_URL}/scorecard/${sym}/${date}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      siteName: 'ZeroGEX',
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${url}/opengraph-image`],
    },
  };
}

export default async function ScorecardPage({
  params,
}: {
  params: Promise<{ symbol: string; date: string }>;
}) {
  const { symbol, date } = await params;
  const sym = resolveSymbol(symbol);
  if (!isValidDate(date)) notFound();
  const data = await loadScorecard(date, sym);
  if (!data) notFound();

  const human = formatHumanDate(date);
  const regimeLabel = data.regime?.label || 'unknown';
  const regimeColor =
    regimeLabel === 'short gamma' ? 'var(--color-bear)' :
    regimeLabel === 'long gamma' ? 'var(--color-bull)' :
    'var(--color-warning)';
  const scorecardUrl = `${SITE_URL}/scorecard/${sym}/${date}`;
  const pickerHrefs = buildSymbolHrefs((s) => `/scorecard/${s}/${date}`);
  const tweetBody = data.tweet_text.split('\n')[0];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/trading-signals"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft size={14} /> Trading Signals
        </Link>
        <ShareCardButton
          cardId={`${sym}:${date}`}
          tweetText={tweetBody}
          cardUrl={scorecardUrl}
          eventName="scorecard_share_clicked"
        />
      </div>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
              ZeroGEX · Scorecard
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {sym} · {human}
            </h1>
          </div>
          <SymbolPicker current={sym} hrefs={pickerHrefs} />
        </div>
        {data.is_empty ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Quiet tape. No Playbook calls were emitted and no signals flipped direction. Either a
            non-trading day or a flat session — the engine refuses to manufacture a setup just to
            have something to say.
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{tweetBody}</p>
        )}
      </header>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ScorecardStat
          label="Playbook calls"
          value={data.cards.total.toString()}
          accent="var(--color-warning)"
          hint={
            data.cards.first_card_permalink ? (
              <Link href={data.cards.first_card_permalink} className="underline">
                Open first call ↗
              </Link>
            ) : (
              'No persisted cards today'
            )
          }
        />
        <ScorecardStat
          label="Best signal (60m)"
          value={data.signals.best ? humanizeName(data.signals.best.name) : '—'}
          accent="var(--color-bull)"
          delta={data.signals.best ? formatPct(data.signals.best.avg_directional_return) : null}
        />
        <ScorecardStat
          label="Worst signal (60m)"
          value={data.signals.worst ? humanizeName(data.signals.worst.name) : '—'}
          accent="var(--color-bear)"
          delta={data.signals.worst ? formatPct(data.signals.worst.avg_directional_return) : null}
        />
      </section>

      <section
        className="mb-8 rounded-xl border-2 px-5 py-4"
        style={{ borderColor: regimeColor, background: `linear-gradient(135deg, ${regimeColor}10 0%, transparent 60%)` }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
              Closing regime
            </div>
            <div className="mt-1 text-2xl font-black uppercase tracking-tight" style={{ color: regimeColor }}>
              {regimeLabel}
            </div>
          </div>
          {typeof data.regime?.normalized_score === 'number' && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
                MSI close
              </div>
              <div className="mt-1 font-mono text-xl font-bold" style={{ color: regimeColor }}>
                {data.regime.normalized_score.toFixed(1)}
              </div>
            </div>
          )}
        </div>
      </section>

      {data.signals.events.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
            All signals · 60-minute forward return
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-[var(--color-surface-subtle)] text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                  <th className="px-4 py-2 text-left">Signal</th>
                  <th className="px-4 py-2 text-right">Flips</th>
                  <th className="px-4 py-2 text-right">Wins</th>
                  <th className="px-4 py-2 text-right">Losses</th>
                  <th className="px-4 py-2 text-right">Avg fwd return</th>
                </tr>
              </thead>
              <tbody>
                {data.signals.events.map((row) => {
                  const avg = row.avg_directional_return;
                  const color =
                    avg == null ? 'var(--color-text-secondary)' :
                    avg > 0 ? 'var(--color-bull)' :
                    avg < 0 ? 'var(--color-bear)' :
                    'var(--color-text-secondary)';
                  const Arrow = avg != null && avg > 0 ? TrendingUp : avg != null && avg < 0 ? TrendingDown : null;
                  return (
                    <tr key={row.name} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2 font-medium">{humanizeName(row.name)}</td>
                      <td className="px-4 py-2 text-right font-mono">{row.flips}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: 'var(--color-bull)' }}>{row.wins}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: 'var(--color-bear)' }}>{row.losses}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color }}>
                        {Arrow ? <Arrow size={12} className="inline mr-1 -mt-0.5" /> : null}
                        {formatPct(avg)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
        <div className="mb-1 text-[10px] uppercase tracking-[0.22em] font-bold">About this scorecard</div>
        Daily aggregate of the ZeroGEX engine&rsquo;s output for {sym}. &ldquo;Playbook calls&rdquo;
        counts every non-STAND_DOWN Action Card persisted that day; each one has its own
        /cards/{'<id>'} permalink. &ldquo;Best/Worst signal&rdquo; picks the signal whose
        direction-flip events that day produced the highest/lowest average 60-minute forward
        return on {sym}, with a 2-flip minimum so a single outlier doesn&rsquo;t crown a signal
        of the day. The receipt is immutable once written — the engine cannot retroactively edit
        a published scorecard.
      </section>
    </main>
  );
}

function ScorecardStat({
  label,
  value,
  accent,
  delta,
  hint,
}: {
  label: string;
  value: string;
  accent: string;
  delta?: string | null;
  hint?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border-2 bg-[var(--color-surface)] px-4 py-4"
      style={{ borderColor: accent }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black tracking-tight" style={{ color: accent }}>
        {value}
      </div>
      {delta && (
        <div className="mt-0.5 font-mono text-sm" style={{ color: accent }}>
          {delta}
        </div>
      )}
      {hint && <div className="mt-2 text-[11px] text-[var(--color-text-secondary)]">{hint}</div>}
    </div>
  );
}
