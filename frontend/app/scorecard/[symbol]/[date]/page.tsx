import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, TrendingDown, TrendingUp } from 'lucide-react';

import { directionColor } from '@/components/ActionCard';
import ShareCardButton from '@/components/ShareCardButton';
import SymbolPicker from '@/components/SymbolPicker';
import { buildSymbolHrefs, resolveSymbol } from '@/core/symbols';
import { etUtcOffsetLabel, formatEtTime } from '@/core/etTimestamp';
import { humanize } from '@/core/signalHelpers';
import { serverApiGet, serverApiGetResult } from '@/core/api/serverFetch';
import DataUnavailable from '@/components/DataUnavailable';

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

interface ScorecardCardRow {
  id: number;
  timestamp: string;
  pattern: string | null;
  action: string | null;
  tier: string | null;
  direction: string | null;
  confidence: number | null;
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
    /** Every card of the day, oldest first. Absent from backends that predate
     *  the list, in which case the page falls back to the first-call link. */
    items?: ScorecardCardRow[];
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

// Returns the RESULT, not the payload — same reason as /forecast: a date with
// no scorecard and a backend that did not answer are different HTTP statuses.
async function loadScorecard(day: string, symbol: string) {
  const qs = new URLSearchParams({ date: day, symbol }).toString();
  return serverApiGetResult<ScorecardPayload>(`/api/scorecard/daily?${qs}`, REVALIDATE_SECONDS);
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
  // Metadata does not need the missing/unavailable distinction: both fall back
  // to the generic copy below, which is correct either way. Unwrap to the
  // nullable shape. The request is deduped against the page component's by the
  // Next fetch cache, so this costs nothing.
  const scorecard = await loadScorecard(date, sym);
  const data = scorecard.ok ? scorecard.data : null;
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
  const result = await loadScorecard(date, sym);
  if (!result.ok && result.reason === 'missing') notFound();
  if (!result.ok) {
    return (
      <DataUnavailable
        what={`${sym} scorecard for ${formatHumanDate(date)}`}
        backHref={sym === 'SPY' ? '/scorecard' : `/scorecard?symbol=${sym}`}
        backLabel="Daily Scorecard"
      />
    );
  }
  const data = result.data;
  const cardItems = data.cards.items ?? [];
  // The engine only runs on weekdays and DST switches on a Sunday, so one
  // offset covers every card of the day.
  const callsOffset = etUtcOffsetLabel(new Date(`${date}T12:00:00Z`));

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
          href={sym === 'SPY' ? '/scorecard' : `/scorecard?symbol=${sym}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft size={14} /> Daily Scorecard
        </Link>
        <ShareCardButton
          cardId={`${sym}:${date}`}
          tweetText={tweetBody}
          cardUrl={scorecardUrl}
          eventName="scorecard_share_clicked"
        />
      </div>

      <header className="mb-6">
        {/* Picker under the title on a phone: beside it, it squeezed the date
            heading into one-word lines and ran its last chips off screen. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] sm:tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
              ZeroGEX · Scorecard
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {sym} · {human}
            </h1>
          </div>
          {/* Six chips are ~350px: on a phone they scroll sideways, edge to
              edge, rather than run off the screen. */}
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
            <SymbolPicker current={sym} hrefs={pickerHrefs} />
          </div>
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
            cardItems.length > 0 ? (
              <a href="#playbook-calls" className="underline">
                See every call ↓
              </a>
            ) : data.cards.first_card_permalink ? (
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
        style={{ borderColor: regimeColor, background: `linear-gradient(135deg, color-mix(in srgb, ${regimeColor} 6%, transparent) 0%, transparent 60%)` }}
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

      {cardItems.length > 0 && (
        <section id="playbook-calls" className="mb-8 scroll-mt-20">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)] sm:tracking-[0.18em]">
            All Playbook calls · {data.cards.total}
          </h2>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
            Oldest first. Times are Eastern ({callsOffset}).
            {cardItems.length < data.cards.total
              ? ` Showing the first ${cardItems.length} of ${data.cards.total}.`
              : null}
          </p>
          <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            {cardItems.map((card) => {
              const color = directionColor(card.direction ?? undefined);
              const detail = [humanize(card.pattern), card.tier].filter(Boolean).join(' · ');
              return (
                <li key={card.id}>
                  <Link
                    href={`/cards/${card.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-surface-subtle)]"
                  >
                    <time
                      dateTime={card.timestamp}
                      title={card.timestamp}
                      className="w-16 shrink-0 font-mono text-xs text-[var(--color-text-secondary)] sm:w-20 sm:text-sm"
                    >
                      {formatEtTime(card.timestamp) ?? '—'}
                    </time>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold uppercase tracking-tight" style={{ color }}>
                        {humanize(card.action) || 'Action Card'}
                      </div>
                      {detail && (
                        <div className="truncate font-mono text-[11px] text-[var(--color-text-secondary)]">
                          {detail}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-sm font-bold" style={{ color }}>
                        {typeof card.confidence === 'number' ? card.confidence.toFixed(2) : '—'}
                      </div>
                      <div className="font-mono text-[11px] text-[var(--color-text-secondary)]">
                        #{card.id}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {data.signals.events.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)] sm:tracking-[0.18em]">
            All signals · {data.horizon_minutes}-minute forward return
          </h2>
          {/* Phone: one row per signal, every column still present. The
              640px table below only showed Signal / Flips / Scored on a
              phone, with the results a sideways scroll away. */}
          <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] sm:hidden">
            {data.signals.events.map((row) => {
              const avg = row.avg_directional_return;
              const unscorable = row.scored === 0 && row.flips > 0;
              const color =
                avg == null ? 'var(--color-text-secondary)' :
                avg > 0 ? 'var(--color-bull)' :
                avg < 0 ? 'var(--color-bear)' :
                'var(--color-text-secondary)';
              const Arrow = avg != null && avg > 0 ? TrendingUp : avg != null && avg < 0 ? TrendingDown : null;
              return (
                <li key={row.name} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">{humanizeName(row.name)}</span>
                    {unscorable ? (
                      <span className="shrink-0 text-xs italic text-[var(--color-text-secondary)]">not scorable</span>
                    ) : (
                      <span className="shrink-0 font-mono text-sm" style={{ color }}>
                        {Arrow ? <Arrow size={12} className="inline mr-1 -mt-0.5" /> : null}
                        {formatPct(avg)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">
                    {row.flips} flips ·{' '}
                    <span style={{ color: row.scored < row.flips ? 'var(--color-warning)' : undefined }}>
                      {row.scored} scored
                    </span>{' '}
                    · <span style={{ color: 'var(--color-bull)' }}>{row.wins}W</span>{' '}
                    <span style={{ color: 'var(--color-bear)' }}>{row.losses}L</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] sm:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-[var(--color-surface-subtle)] text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                  <th className="px-4 py-2 text-left">Signal</th>
                  <th className="px-4 py-2 text-right">Flips</th>
                  <th className="px-4 py-2 text-right">Scored</th>
                  <th className="px-4 py-2 text-right">Wins</th>
                  <th className="px-4 py-2 text-right">Losses</th>
                  <th className="px-4 py-2 text-right">Avg fwd return</th>
                </tr>
              </thead>
              <tbody>
                {data.signals.events.map((row) => {
                  const avg = row.avg_directional_return;
                  // A flip inside the forward window of the close has no
                  // same-session price to grade against, so it is counted but
                  // not scored. Signals that only fire near the close can be
                  // entirely unscorable on a given day — say that, rather than
                  // printing a dash that reads as "flat".
                  const unscorable = row.scored === 0 && row.flips > 0;
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
                      <td
                        className="px-4 py-2 text-right font-mono"
                        style={{ color: row.scored < row.flips ? 'var(--color-warning)' : undefined }}
                        title={
                          row.scored < row.flips
                            ? `${row.flips - row.scored} of ${row.flips} flips fired too close to the bell to be graded over ${data.horizon_minutes} minutes in the same session.`
                            : undefined
                        }
                      >
                        {row.scored}
                      </td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: 'var(--color-bull)' }}>{row.wins}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: 'var(--color-bear)' }}>{row.losses}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color }}>
                        {unscorable ? (
                          <span
                            className="font-sans italic text-[var(--color-text-secondary)]"
                            title={`Every flip fired within ${data.horizon_minutes} minutes of the close, so there is no same-session forward price to grade it against. This is not a flat result.`}
                          >
                            not scorable
                          </span>
                        ) : (
                          <>
                            {Arrow ? <Arrow size={12} className="inline mr-1 -mt-0.5" /> : null}
                            {formatPct(avg)}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-[13px] text-[var(--color-text-secondary)] leading-relaxed sm:p-5 sm:text-xs">
        <div className="mb-1 text-[10px] uppercase tracking-[0.22em] font-bold">About this scorecard</div>
        Daily aggregate of the ZeroGEX engine&rsquo;s output for {sym}. &ldquo;Playbook calls&rdquo;
        counts every non-STAND_DOWN Action Card persisted that day, midnight to midnight
        Eastern, so it includes calls issued before the open; each one has its own
        /cards/{'<id>'} permalink. &ldquo;Best/Worst signal&rdquo; picks the signal whose
        direction-flip events that day produced the highest/lowest average 60-minute forward
        return on {sym}, with a 2-flip minimum so a single outlier doesn&rsquo;t crown a signal
        of the day. &ldquo;Scored&rdquo; is how many of a signal&rsquo;s flips could be graded:
        the forward price always comes from the same regular session, so a flip inside the last{' '}
        {data.horizon_minutes} minutes has nothing to grade against and is counted but not scored.
        A signal that only fires near the bell can read &ldquo;not scorable&rdquo; for a whole
        session — that is an absent measurement, not a flat one. The receipt is immutable once
        written — the engine cannot retroactively edit a published scorecard.
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
