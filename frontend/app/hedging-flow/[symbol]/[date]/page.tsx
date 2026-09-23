import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import PageShell from '@/components/layout/PageShell';
import SectionHead from '@/components/layout/SectionHead';
import BetaBadge from '@/components/BetaBadge';
import SymbolPicker from '@/components/SymbolPicker';
import DataUnavailable from '@/components/DataUnavailable';
import { CASH_SYMBOLS, buildSymbolHrefs, resolveSymbol } from '@/core/symbols';
import { serverApiGet, serverApiGetResult } from '@/core/api/serverFetch';
import { normalizeGammaRegime, normalizeHedgingFlow } from '@/core/hedgingFlowSeries';
import type { HedgingFlowPayload } from '@/hooks/useHedgingFlow';
import type { GammaRegimeSeriesPayload } from '@/hooks/useGammaRegimeSeries';
import type { GammaWeatherPayload } from '@/hooks/useGammaWeather';
import DatedHedgingFlow from './DatedHedgingFlow';

// Public permalink for one trading day's Hedging Flow session. Server-rendered
// and ISR-cached for an hour: a closed session is immutable, and the snapshot
// it reads is retention-exempt, so the page is as stable as the day it names.
//
// The reason this route can exist at all is hedging_flow_5min. The live
// pipeline reads flow_contract_facts, which `make db-prune` empties at 90
// days — a permalink recomputed from it would quietly become an empty chart
// rather than a missing one. See docs/hedging-flow-history.md.

const REVALIDATE_SECONDS = 3600;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zerogex.io').replace(/\/+$/, '');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(raw: string): boolean {
  if (!ISO_DATE.test(raw)) return false;
  return Number.isFinite(Date.parse(`${raw}T00:00:00Z`));
}

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

function formatUsd(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${(abs / 1e3).toFixed(0)}K`;
}

/**
 * The session itself, fetched on the SERVER.
 *
 * This is what makes the page a public permalink rather than a gated tool.
 * The live route's data arrives through browser calls to `/api/flow/*`, which
 * `core/api/apiTierGate` gates at Basic — so a client fetch here would leave
 * an anonymous visitor (or a crawler) looking at a header and an error, and
 * the permalink would be worth nothing to share. Server-side the request
 * carries the app's own token, exactly as `/replay/[symbol]/[date]` does.
 *
 * It also removes every client fetch from a page that could not benefit from
 * one: a finished session is immutable.
 */
async function loadFlow(symbol: string, date: string) {
  const qs = new URLSearchParams({ symbol, date });
  return serverApiGetResult<HedgingFlowPayload>(
    `/api/flow/hedging?${qs.toString()}`,
    REVALIDATE_SECONDS,
  );
}

/**
 * The 0DTE view of the same session.
 *
 * Fetched up front rather than on demand because the toggle has nothing to
 * query later: the trades a live page re-filters are pruned at 90 days, which
 * is why the snapshot materialises this scope at all. `null` back means the
 * day was not an expiry, and the toggle hides rather than offering a view that
 * would resolve to nothing.
 */
async function loadZeroDte(symbol: string, date: string) {
  const qs = new URLSearchParams({ symbol, date, expirations: date });
  return serverApiGet<HedgingFlowPayload>(
    `/api/flow/hedging?${qs.toString()}`,
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
    return {
      title: 'Session not found — ZeroGEX',
      robots: { index: false, follow: false },
    };
  }

  const human = formatHumanDate(date);
  // Deduped against the page component's identical request by the Next fetch
  // cache, so describing the session here costs nothing extra.
  const result = await loadFlow(sym, date);
  // Wire order is newest-first, so the session's closing lean is bars[0].
  const bar = result.ok ? result.data.bars?.[0] : undefined;
  const lean =
    bar && typeof bar.cum_net_usd === 'number'
      ? `${bar.cum_net_usd >= 0 ? 'Net dealer buying' : 'Net dealer selling'} ${formatUsd(
          bar.cum_net_usd,
        )}.`
      : '';

  const title = `${sym} · ${human} Hedging Flow — ZeroGEX`;
  const description =
    `Estimated dealer hedging pressure across ${sym}'s ${human} session, bar by bar, ` +
    `with the dealer gamma structure on the same timeline. ${lean}`.trim();
  const url = `${SITE_URL}/hedging-flow/${sym}/${date}`;

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
    twitter: { card: 'summary_large_image', title, description, images: [`${url}/opengraph-image`] },
  };
}

export default async function HedgingFlowSessionPage({
  params,
}: {
  params: Promise<{ symbol: string; date: string }>;
}) {
  const { symbol, date } = await params;
  const sym = resolveSymbol(symbol);
  if (!isValidDate(date)) notFound();

  // The one distinction this page has to get right. `serverApiGet` returns
  // null both for "this day has nothing" and "the API never answered", and a
  // hard 404 served during a crawl costs the URL its place in the index —
  // which is what tests/datedPermalinks.test.ts exists to prevent. Only a
  // real "missing" (the symbol itself is unknown) is a 404; an outage renders
  // a holding page that says so.
  const result = await loadFlow(sym, date);
  if (!result.ok && result.reason === 'missing') notFound();
  if (!result.ok) {
    return (
      <DataUnavailable
        what={`${sym} hedging flow for ${formatHumanDate(date)}`}
        backHref="/hedging-flow/sessions"
        backLabel="Past sessions"
      />
    );
  }

  const human = formatHumanDate(date);
  const empty = (result.data.bars?.length ?? 0) === 0;
  const pickerHrefs = buildSymbolHrefs((s) => `/hedging-flow/${s}/${date}`);

  // The three companions, in parallel, and only once the session is known to
  // exist — an empty day is not worth three more round trips.
  const [zeroDte, regime, weather] = empty
    ? [null, null, null]
    : await Promise.all([
        loadZeroDte(sym, date),
        serverApiGet<GammaRegimeSeriesPayload>(
          `/api/gex/regime-series?symbol=${sym}&date=${date}`,
          REVALIDATE_SECONDS,
        ),
        // A 409 here is "no bar carried both series that day", which
        // serverApiGet flattens to null. That is a state the panel renders as
        // a sentence, not an error.
        serverApiGet<GammaWeatherPayload>(
          `/api/gex/weather?symbol=${sym}&date=${date}`,
          REVALIDATE_SECONDS,
        ),
      ]);

  // Only the empty state renders a header here — when there IS a session the
  // client component owns it, because the 0DTE toggle shares that row and the
  // toggle is state.
  const emptyHeader = (
    <SectionHead
      eyebrow="Options Flow · Past session"
      title={
        <span className="inline-flex items-center gap-2.5">
          Hedging Flow
          <BetaBadge size="md" />
        </span>
      }
      sub={
        <>
          {sym} · {human}.
        </>
      }
      actions={<SymbolPicker current={sym} hrefs={pickerHrefs} symbols={CASH_SYMBOLS} />}
    />
  );

  return (
    <PageShell>
      <div className="mb-5">
        <Link
          href="/hedging-flow/sessions"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] max-sm:min-h-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronLeft size={14} /> Past sessions
        </Link>
      </div>

      {empty ? (
        <>
          {emptyHeader}
          <p className="mt-8 text-sm italic" style={{ color: 'var(--text-secondary)' }}>
            No hedging flow is stored for {sym} on {human}. Sessions before the snapshot was
            deployed were never written, and a market holiday has nothing to write —{' '}
            <Link href="/hedging-flow/sessions" className="underline">
              the session list
            </Link>{' '}
            shows every day that does have one.
          </p>
        </>
      ) : (
        <DatedHedgingFlow
          symbol={sym}
          sessionDateKey={date}
          humanDate={human}
          pickerHrefs={pickerHrefs}
          all={normalizeHedgingFlow(result.data)}
          zeroDte={normalizeHedgingFlow(zeroDte)}
          regime={normalizeGammaRegime(regime)}
          weather={weather}
          weatherNotReady={weather === null}
        />
      )}
    </PageShell>
  );
}
