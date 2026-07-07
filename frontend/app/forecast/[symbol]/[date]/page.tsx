import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, CheckCircle2, XCircle, Magnet } from 'lucide-react';

import ShareCardButton from '@/components/ShareCardButton';
import SymbolPicker from '@/components/SymbolPicker';
import { buildSymbolHrefs, resolveSymbol } from '@/core/symbols';
import { serverApiGet } from '@/core/api/serverFetch';

// Public permalink for one trading day's Gamma Forecast Card.
//
// Dual state:
//   * Morning (07:00 ET): projected range + pin strike + regime + flagship
//     Playbook setup. Immutable until 4:01 PM when the receipt lands.
//   * Receipt (16:05 ET): same URL re-renders with actual L/H/C overlaid
//     against the morning band, plus green-check/red-X verdicts on each
//     claim (range, pin, regime).
//
// Server-rendered; ISR-cached for 30 minutes (the receipt arrives at
// 16:05 ET and we want the page to flip within an hour at most).
const REVALIDATE_SECONDS = 1800;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zerogex.io').replace(/\/+$/, '');

// A rolling hit rate over a handful of receipts is noise — with n=1 each claim
// can only read 0% or 100%. Below this many *graded* receipts we show a
// "building history" note instead of the percentage tiles, so a freshly-seeded
// symbol (or one whose history was just pruned) doesn't advertise a hollow
// track record.
const MIN_SCORED_FOR_RATES = 5;

interface ForecastMorning {
  ts: string | null;
  open_spot: number | null;
  call_wall: number | null;
  put_wall: number | null;
  gamma_flip: number | null;
  open_msi: number | null;
  regime: string | null;
  projected_low: number | null;
  projected_high: number | null;
  projected_close: number | null;
  pin_strike: number | null;
  flagship_setup: Record<string, unknown> | null;
  range_model: string | null;
  content_hash: string | null;
}

interface ForecastReceipt {
  ts: string | null;
  actual_low: number | null;
  actual_high: number | null;
  actual_close: number | null;
  range_respected: boolean | null;
  pin_hit: boolean | null;
  regime_correct: boolean | null;
  setup_outcome: Record<string, unknown> | null;
}

interface ForecastPayload {
  symbol: string;
  date: string;
  morning: ForecastMorning;
  receipt: ForecastReceipt | null;
}

interface RollingStats {
  symbol: string;
  window: number;
  n_scored: number;
  range_respected_rate: number | null;
  pin_hit_rate: number | null;
  regime_correct_rate: number | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

function humanizeRegime(value: string | null): string {
  if (!value) return 'Unknown';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function fmtPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
}

function fmtPct(rate: number | null): string {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(0)}%`;
}

async function loadForecast(day: string, symbol: string): Promise<ForecastPayload | null> {
  const qs = new URLSearchParams({ symbol }).toString();
  return serverApiGet<ForecastPayload>(`/api/forecast/${day}?${qs}`, REVALIDATE_SECONDS);
}

async function loadStats(symbol: string): Promise<RollingStats | null> {
  return serverApiGet<RollingStats>(
    `/api/forecast/stats/rolling?symbol=${symbol}&window=30`,
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
  if (!isValidDate(date)) {
    return { title: 'Forecast not found — ZeroGEX', robots: { index: false, follow: false } };
  }
  const data = await loadForecast(date, sym);
  const human = formatHumanDate(date);
  const url = `${SITE_URL}/forecast/${sym}/${date}`;
  const hasReceipt = data?.receipt != null;
  const titleHead = hasReceipt ? 'Receipt' : 'Forecast';
  const title = data
    ? `${sym} · ${human} ${titleHead} — ZeroGEX`
    : `${sym} · ${human} Forecast — ZeroGEX`;
  const description = data
    ? hasReceipt
      ? `Receipt for ${sym} on ${human}. Range ${data.receipt!.range_respected ? '✓ held' : '✗ broken'} · Pin ${data.receipt!.pin_hit ? '✓ hit' : '✗ missed'}.`
      : `${sym} morning forecast: range ${fmtPrice(data.morning.projected_low)}–${fmtPrice(data.morning.projected_high)}, pin ${fmtPrice(data.morning.pin_strike)}, regime ${humanizeRegime(data.morning.regime)}.`
    : 'Daily ZeroGEX Gamma Forecast Card — 7 AM commitment, 4 PM receipt.';
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

export default async function ForecastPage({
  params,
}: {
  params: Promise<{ symbol: string; date: string }>;
}) {
  const { symbol, date } = await params;
  const sym = resolveSymbol(symbol);
  if (!isValidDate(date)) notFound();
  const [data, stats] = await Promise.all([loadForecast(date, sym), loadStats(sym)]);
  if (!data) notFound();

  const morning = data.morning;
  const receipt = data.receipt;
  const human = formatHumanDate(date);
  const regimeLabel = humanizeRegime(morning.regime);
  const permalink = `${SITE_URL}/forecast/${sym}/${date}`;
  const pickerHrefs = buildSymbolHrefs((s) => `/forecast/${s}/${date}`);
  const tweetBody = receipt
    ? `${sym} ${date} receipt — range ${receipt.range_respected ? 'held' : 'broken'}, pin ${receipt.pin_hit ? 'hit' : 'missed'}, regime ${receipt.regime_correct ? 'correct' : 'wrong'}.`
    : `${sym} ${date} forecast — range ${fmtPrice(morning.projected_low)}–${fmtPrice(morning.projected_high)}, pin ${fmtPrice(morning.pin_strike)}, regime ${regimeLabel}.`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/spx-gamma-levels"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft size={14} /> Gamma Levels
        </Link>
        <ShareCardButton
          cardId={`${sym}:${date}`}
          tweetText={tweetBody}
          cardUrl={permalink}
          eventName="forecast_share_clicked"
        />
      </div>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
              ZeroGEX · {receipt ? 'Forecast Receipt' : 'Morning Forecast'}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {sym} · {human}
            </h1>
            <p className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">
              {receipt
                ? `Committed ${morning.ts} · Receipt ${receipt.ts}`
                : `Committed ${morning.ts} · receipt at 4:05 PM ET`}
            </p>
          </div>
          <SymbolPicker current={sym} hrefs={pickerHrefs} />
        </div>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Projected range"
          value={`${fmtPrice(morning.projected_low)} – ${fmtPrice(morning.projected_high)}`}
          accent="var(--color-accent)"
          verdict={receipt ? (receipt.range_respected ? 'held' : 'broken') : null}
          hint={(() => {
            const parts: string[] = [];
            // Show the asymmetric ± % move so it's obvious how much
            // room the model is claiming in each direction.  Spot is
            // the anchor; bands are relative to it in either direction.
            if (
              morning.open_spot != null
              && morning.projected_low != null
              && morning.projected_high != null
              && Number.isFinite(morning.open_spot)
              && morning.open_spot > 0
            ) {
              const downPct = ((morning.open_spot - morning.projected_low) / morning.open_spot) * 100;
              const upPct = ((morning.projected_high - morning.open_spot) / morning.open_spot) * 100;
              parts.push(`−${downPct.toFixed(2)}% / +${upPct.toFixed(2)}%`);
            }
            if (receipt) {
              parts.push(`Actual: ${fmtPrice(receipt.actual_low)} – ${fmtPrice(receipt.actual_high)}`);
            } else {
              parts.push('Walls · VIX/VXN · ATR blend · MSI-lean');
            }
            return parts.join(' · ');
          })()}
        />
        <Stat
          label="Pin strike"
          value={fmtPrice(morning.pin_strike)}
          accent="var(--color-accent)"
          icon={Magnet}
          verdict={receipt && morning.pin_strike != null ? (receipt.pin_hit ? 'held' : 'broken') : null}
          hint={
            receipt
              ? `Closed ${fmtPrice(receipt.actual_close)}`
              : morning.pin_strike != null
                ? 'Within $1 of close = pin held'
                : 'No pin candidate today'
          }
        />
        <Stat
          label="Regime"
          value={regimeLabel}
          accent="var(--color-accent)"
          verdict={
            receipt && receipt.regime_correct != null
              ? receipt.regime_correct ? 'held' : 'broken'
              : null
          }
          hint={
            receipt
              ? receipt.regime_correct == null
                ? 'Transition — not graded'
                : receipt.regime_correct
                  ? 'Realized vol matched regime call'
                  : 'Realized vol contradicted regime call'
              : morning.open_msi != null
                ? `Opening MSI ${morning.open_msi.toFixed(1)}`
                : null
          }
        />
      </section>

      <section
        className="mb-8 rounded-xl border-2 px-5 py-4"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 text-xs">
          <Anchor label="Open spot" value={fmtPrice(morning.open_spot)} />
          <Anchor label="Call wall" value={fmtPrice(morning.call_wall)} />
          <Anchor label="Put wall" value={fmtPrice(morning.put_wall)} />
          <Anchor label="Gamma flip" value={fmtPrice(morning.gamma_flip)} />
        </div>
      </section>

      {morning.flagship_setup && (
        <section className="mb-8 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
            Flagship Playbook setup
          </div>
          <div className="mt-1 text-xl font-black tracking-tight">
            {humanizeRegime(String(morning.flagship_setup.action ?? '—'))}
          </div>
          {typeof morning.flagship_setup.pattern === 'string' && (
            <div className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">
              {humanizeRegime(morning.flagship_setup.pattern)}
            </div>
          )}
          {typeof (morning.flagship_setup as { id?: number }).id === 'number' && (
            <Link
              href={`/cards/${(morning.flagship_setup as { id: number }).id}`}
              className="mt-2 inline-block text-xs underline text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              View full Action Card permalink ↗
            </Link>
          )}
        </section>
      )}

      {stats && stats.n_scored > 0 && (
        <section className="mb-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
          <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)] mb-3">
            {stats.n_scored >= MIN_SCORED_FOR_RATES
              ? `Rolling ${stats.window}-day hit rate (n=${stats.n_scored})`
              : `Rolling ${stats.window}-day track record`}
          </div>
          {stats.n_scored >= MIN_SCORED_FOR_RATES ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <HitRate label="Range respected" rate={stats.range_respected_rate} />
              <HitRate label="Pin within $1" rate={stats.pin_hit_rate} />
              <HitRate label="Regime correct" rate={stats.regime_correct_rate} />
            </div>
          ) : (
            <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Building history — {stats.n_scored} graded{' '}
              {stats.n_scored === 1 ? 'receipt' : 'receipts'} so far. A rolling hit rate needs at
              least {MIN_SCORED_FOR_RATES} graded days to mean anything, so we hold it back until
              then rather than show a rate a single session could swing to 0% or 100%.
            </div>
          )}
        </section>
      )}

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
        <div className="mb-1 text-[10px] uppercase tracking-[0.22em] font-bold">About this forecast</div>
        Daily commitment for {sym} written at 7:00 AM ET. The projected range is anchored on the
        open spot and bounded by the GEX call/put walls with a 10% safety expansion; event days
        (FOMC / CPI / NFP) get a 1.5× stretch. The pin strike is GEX max pain when published or
        the nearest strike to spot otherwise. The regime label comes from the opening MSI composite
        score (long gamma ≥ +0.15, short gamma ≤ −0.15, transition otherwise). The receipt is
        written once at 4:05 PM ET from the day&rsquo;s actual cash-session OHLC and is immutable
        thereafter — the engine cannot retroactively edit a published commitment.
        <br />
        <br />
        Model: <span className="font-mono">{morning.range_model ?? 'heuristic_v1'}</span>
        {morning.content_hash && (
          <>
            {' '}· hash <span className="font-mono">{morning.content_hash.slice(0, 12)}</span>
          </>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
  verdict,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  accent: string;
  verdict: 'held' | 'broken' | null;
  hint?: string | null;
  icon?: typeof Magnet;
}) {
  const VerdictIcon =
    verdict === 'held' ? CheckCircle2 : verdict === 'broken' ? XCircle : null;
  const verdictColor =
    verdict === 'held' ? 'var(--color-bull)' : verdict === 'broken' ? 'var(--color-bear)' : null;
  return (
    <div className="rounded-xl border-2 bg-[var(--color-surface)] px-4 py-4" style={{ borderColor: accent }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
        {Icon ? <Icon size={11} /> : null}
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xl font-black tracking-tight" style={{ color: accent }}>
        {value}
        {VerdictIcon && verdictColor && (
          <VerdictIcon size={20} style={{ color: verdictColor }} />
        )}
      </div>
      {hint && <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{hint}</div>}
    </div>
  );
}

function Anchor({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function HitRate({ label, rate }: { label: string; rate: number | null }) {
  const color =
    rate == null ? 'var(--color-text-secondary)' :
    rate >= 0.7 ? 'var(--color-bull)' :
    rate >= 0.5 ? 'var(--color-warning)' :
    'var(--color-bear)';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl font-bold" style={{ color }}>
        {fmtPct(rate)}
      </div>
    </div>
  );
}
