import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, CheckCircle2, Clock, History, Lock, TrendingDown, TrendingUp } from 'lucide-react';
import { serverApiGet } from '@/core/api/serverFetch';
import { buildReportModel } from '../live-bulletin/bulletinHelpers';
import TodaysReadCard from '@/components/TodaysReadCard';
import Footer from './Footer';
import Header from './Header';

// Free, public, ~15-minute-delayed view of the derived dealer-gamma levels we
// publish on X every morning. Pure server component: ISR-cached at 900s so the
// page is naturally delayed and SEO-friendly, with zero auth wiring required.
//
// Three roles this page plays:
//   1. Ranks for "SPX gamma levels", "SPY put wall", "QQQ gamma flip today" —
//      the long-tail searches options traders run pre-market.
//   2. Gives X followers a single shareable URL that always carries the
//      current-session levels, so the daily post is a hook into something
//      that compounds.
//   3. Sits cleanly inside the derived-data zone (call/put wall STRIKES,
//      gamma flip LEVEL, max-pain, net GEX magnitudes) — no live-quote
//      streaming, so it stays licensing-clean by construction.

export const dynamic = 'force-static';
export const revalidate = 900;

const SYMBOLS = ['SPX', 'SPY', 'QQQ'] as const;
type Symbol = (typeof SYMBOLS)[number];

interface GexSummary {
  timestamp: string;
  symbol: string;
  spot_price: number;
  total_call_gex: number;
  total_put_gex: number;
  net_gex: number;
  net_gex_at_spot?: number | null;
  gamma_flip?: number | null;
  max_pain?: number | null;
  call_wall?: number | null;
  put_wall?: number | null;
  put_call_ratio?: number | null;
}

// URL stays /spx-gamma-levels because "SPX gamma levels" is the highest-volume
// intent search in this category; the title/H1/content carry SPY and QQQ so
// the page also picks up sibling searches without a slug rename.
const PAGE_TITLE = 'SPX, SPY & QQQ Gamma Levels Today — Call Wall, Put Wall & Gamma Flip';
const PAGE_DESCRIPTION =
  'Free daily SPX, SPY, and QQQ gamma levels — call wall, put wall, gamma flip, and net dealer GEX. Derived analytics, refreshed every 15 minutes. No signup required.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/spx-gamma-levels' },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: 'https://zerogex.io/spx-gamma-levels',
    siteName: 'ZeroGEX',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

function fmtPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value >= 1000) return value.toFixed(0);
  return value.toFixed(2);
}

function fmtNetGex(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '−';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtTimestampET(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(d);
  } catch {
    return iso;
  }
}

function gexRegimeLabel(netGex: number | null | undefined): {
  label: string;
  tone: 'bull' | 'bear' | 'neutral';
  body: string;
} {
  if (netGex == null || !Number.isFinite(netGex)) {
    return { label: 'No regime read', tone: 'neutral', body: 'Gamma data unavailable for this session.' };
  }
  if (netGex > 0) {
    return {
      label: 'Positive gamma (suppressed vol)',
      tone: 'bull',
      body: 'Dealers are net long gamma at spot — mean-reversion is favored, pinning is more likely, breakouts tend to stall.',
    };
  }
  return {
    label: 'Negative gamma (amplified vol)',
    tone: 'bear',
    body: 'Dealers are net short gamma at spot — moves can accelerate, walls are more brittle, trend extension is the higher-probability path.',
  };
}

// Pull all three symbols in parallel. Each call is cached in the Next.js fetch
// cache at 900s, so the page itself is effectively ISR'd at the same cadence.
async function loadSnapshots(): Promise<Record<Symbol, GexSummary | null>> {
  const entries = await Promise.all(
    SYMBOLS.map(async (symbol) => {
      const data = await serverApiGet<GexSummary>(
        `/api/gex/summary?symbol=${symbol}&underlying=${symbol}`,
        900,
      );
      return [symbol, data] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<Symbol, GexSummary | null>;
}

function LevelRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: '14px 0',
        borderTop: '1px solid var(--border-default)',
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500 }}>{label}</div>
        {hint && (
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', opacity: 0.7, marginTop: 2 }}>
            {hint}
          </div>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function SymbolCard({ symbol, data }: { symbol: Symbol; data: GexSummary | null }) {
  const regime = gexRegimeLabel(data?.net_gex_at_spot ?? data?.net_gex);
  const regimeColor =
    regime.tone === 'bull'
      ? 'var(--color-positive)'
      : regime.tone === 'bear'
        ? 'var(--color-negative)'
        : 'var(--color-text-secondary)';
  return (
    <article
      style={{
        background: 'linear-gradient(145deg, var(--color-surface) 0%, var(--bg-active) 100%)',
        border: '1px solid var(--border-default)',
        borderRadius: 18,
        padding: '28px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <header>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--color-text-primary)', letterSpacing: '-0.5px' }}>
            {symbol}
          </h2>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: regimeColor,
              border: `1px solid ${regimeColor}55`,
              background: `${regimeColor}14`,
              borderRadius: 999,
              padding: '4px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {regime.tone === 'bull' ? <TrendingUp size={12} /> : regime.tone === 'bear' ? <TrendingDown size={12} /> : null}
            {regime.label}
          </span>
        </div>
        <p style={{ margin: '10px 0 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
          {regime.body}
        </p>
      </header>

      <div>
        <LevelRow label="Reference spot (delayed)" value={fmtPrice(data?.spot_price)} hint="Approximate, snapshot ≥15 min ago" />
        <LevelRow label="Call wall" value={fmtPrice(data?.call_wall)} hint="Strike that tends to cap upside" />
        <LevelRow label="Put wall" value={fmtPrice(data?.put_wall)} hint="Strike that tends to floor downside" />
        <LevelRow label="Gamma flip" value={fmtPrice(data?.gamma_flip)} hint="Regime line — above = positive, below = negative" />
        <LevelRow label="Max pain" value={fmtPrice(data?.max_pain)} hint="Strike where the most contracts expire worthless" />
        <LevelRow label="Net dealer GEX (at spot)" value={fmtNetGex(data?.net_gex_at_spot ?? data?.net_gex)} />
      </div>

      <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', opacity: 0.75 }}>
          Snapshot: {fmtTimestampET(data?.timestamp)}
        </span>
        <Link
          href={`/gamma-exposure?symbol=${symbol}`}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-brand-primary)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Live {symbol} dashboard
          <ArrowRight size={14} />
        </Link>
      </footer>
    </article>
  );
}

export default async function SpxGammaLevelsPage() {
  const snapshots = await loadSnapshots();
  const anyData = SYMBOLS.some((s) => snapshots[s] !== null);

  // The freshest timestamp across the three symbols is what we surface as the
  // page's "as of" line — the ISR cache holds for 900s, so any individual cell
  // may be up to ~15 minutes older than the actual server clock.
  const latestTimestamp = SYMBOLS.map((s) => snapshots[s]?.timestamp)
    .filter((t): t is string => Boolean(t))
    .sort()
    .at(-1);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: 'https://zerogex.io/spx-gamma-levels',
    isAccessibleForFree: true,
    publisher: { '@type': 'Organization', name: 'ZeroGEX', url: 'https://zerogex.io' },
    about: [
      { '@type': 'Thing', name: 'Gamma exposure (GEX)' },
      { '@type': 'Thing', name: 'Dealer hedging' },
      { '@type': 'Thing', name: 'SPX options' },
      { '@type': 'Thing', name: 'Call wall' },
      { '@type': 'Thing', name: 'Put wall' },
      { '@type': 'Thing', name: 'Gamma flip' },
    ],
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        color: 'var(--color-text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Header />

      <main style={{ flex: 1, maxWidth: 1080, margin: '0 auto', padding: '120px 24px 80px', width: '100%' }}>
        <header style={{ marginBottom: 36 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--color-brand-primary)',
              border: '1px solid var(--color-brand-primary)44',
              background: 'var(--color-brand-primary)14',
              borderRadius: 999,
              padding: '5px 14px',
              marginBottom: 18,
            }}
          >
            <Clock size={12} /> Free · Delayed ~15 minutes
          </div>
          <h1
            style={{
              fontSize: 'clamp(34px, 5vw, 52px)',
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: '-1px',
              margin: '0 0 16px 0',
            }}
          >
            SPX, SPY & QQQ Gamma Levels — Today
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: 'var(--color-text-secondary)',
              margin: 0,
              maxWidth: 720,
            }}
          >
            The dealer-positioning levels we publish on X every morning, in one place. Call wall and put wall are
            where dealer hedging tends to cap or floor price; the gamma flip is the regime line that switches the
            market between mean-reversion and trend; max pain is where the option chain has the most to gain from
            an expiration pin. Live dashboards update every few seconds — this page caches ~15 minutes behind that.
          </p>
        </header>

        {!anyData && (
          <div
            style={{
              border: '1px solid var(--border-default)',
              borderRadius: 14,
              padding: '24px',
              marginBottom: 24,
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Data is briefly unavailable — refresh in a minute, or{' '}
            <Link href="/register" style={{ color: 'var(--color-brand-primary)' }}>
              start a free trial
            </Link>{' '}
            for the live read.
          </div>
        )}

        {/* Today's Read — page-level summary for SPX (the primary symbol the
            URL ranks for). Sentence-level regime read above the per-symbol
            cards so a visitor lands on the page and gets the prose first.
            Server-side buildReportModel works fine here — no VIX available
            in the ISR snapshot path, so the expected-range field stays null
            and the card cleanly omits it. */}
        {snapshots.SPX && (
          <div style={{ marginBottom: 24 }}>
            <TodaysReadCard
              model={buildReportModel({
                symbol: 'SPX',
                spot: snapshots.SPX.spot_price ?? null,
                priorClose: null,
                summary: snapshots.SPX,
                vix: null,
                volIndex: 'VIX',
                horizon: 'daily',
              })}
            />
          </div>
        )}

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20,
            marginBottom: 40,
          }}
        >
          {SYMBOLS.map((symbol) => (
            <SymbolCard key={symbol} symbol={symbol} data={snapshots[symbol]} />
          ))}
        </section>

        <section
          style={{
            border: '1px solid var(--color-brand-primary)44',
            background: 'linear-gradient(135deg, var(--color-brand-primary)10 0%, var(--color-surface) 100%)',
            borderRadius: 18,
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            marginBottom: 48,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px' }}>
            Want the live, sub-second version?
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-secondary)', maxWidth: 720 }}>
            Levels above are intentionally delayed and refresh roughly every 15 minutes. The full ZeroGEX dashboard
            updates in real time, adds the GEX profile, strike-level heatmaps, options-flow classification, and the
            13-signal composite Market State Index. Free 7-day trial, no card required for the first session.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
            <Link
              href="/register"
              style={{
                background: 'var(--color-brand-primary)',
                color: '#ffffff',
                padding: '12px 22px',
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 800,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Start free trial <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              style={{
                border: '1px solid var(--border-default)',
                color: 'var(--color-text-primary)',
                padding: '12px 22px',
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Lock size={14} /> See what&apos;s behind the paywall
            </Link>
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 16px 0', letterSpacing: '-0.3px' }}>
            How to read these levels
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 14, padding: 22, background: 'var(--color-surface)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800 }}>Call wall</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                The strike where call-side dealer gamma piles up. Above a positive-gamma regime, price tends to
                stall here as dealers sell into rips to hedge. A break above is usually a tell that the regime
                itself is flipping.
              </p>
            </div>
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 14, padding: 22, background: 'var(--color-surface)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800 }}>Put wall</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                The strike where put-side dealer gamma piles up — typically the strongest dealer-hedged support
                in a positive-gamma session. Failing below the put wall in negative gamma is one of the cleaner
                bear-trend setups in the playbook.
              </p>
            </div>
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 14, padding: 22, background: 'var(--color-surface)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800 }}>Gamma flip</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                The level where the cumulative dealer-gamma curve crosses zero. Above the flip, dealers are net
                long gamma (vol-suppressing). Below it, net short gamma (vol-amplifying). The single most useful
                regime line on the dealer book.
              </p>
            </div>
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 14, padding: 22, background: 'var(--color-surface)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800 }}>Max pain</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                The strike that maximizes the dollar value of options expiring worthless. Useful as an
                expiration-day magnet, but the real mechanism most days is the gamma pin around max pain, not
                writer-payout arithmetic.
              </p>
            </div>
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 14, padding: 22, background: 'var(--color-surface)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800 }}>Net dealer GEX (at spot)</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                The cumulative dealer-gamma curve evaluated at the current price. Sign-consistent with the
                flip — positive means we&apos;re above it, negative means below. Magnitude says how deep into the
                regime we are.
              </p>
            </div>
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 14, padding: 22, background: 'var(--color-surface)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800 }}>One catch</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                These are derived analytics, intentionally delayed. They&apos;re great for context and for the daily
                X read; they&apos;re not enough on their own for active trading. Pair them with intraday flow,
                vanna/charm, and the regime signals on the live dashboard.
              </p>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px 0', letterSpacing: '-0.3px' }}>
            Related reading
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            <li>
              <Link href="/education/gamma-exposure-explained" style={{ color: 'var(--color-brand-primary)' }}>
                Gamma Exposure (GEX) Explained: The Complete Guide
              </Link>
            </li>
            <li>
              <Link href="/education/gamma-walls-explained" style={{ color: 'var(--color-brand-primary)' }}>
                Gamma Walls Explained: Call Wall, Put Wall, and How Price Reacts
              </Link>
            </li>
            <li>
              <Link href="/education/how-to-read-a-gamma-flip" style={{ color: 'var(--color-brand-primary)' }}>
                How to Read a Gamma Flip
              </Link>
            </li>
            <li>
              <Link href="/education/max-pain-explained" style={{ color: 'var(--color-brand-primary)' }}>
                Max Pain Explained — and Does It Actually Work?
              </Link>
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px' }}>
            Two free tools coming soon
          </h2>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            In private beta. Both will be free — no login required.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            <div
              aria-disabled="true"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 20,
                borderRadius: 14,
                border: '1px dashed var(--border-default)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                opacity: 0.55,
                cursor: 'not-allowed',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--color-surface-subtle, rgba(255,255,255,0.05))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <CheckCircle2 size={20} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Gamma Forecast</div>
                <div
                  style={{
                    marginLeft: 'auto',
                    padding: '2px 8px',
                    borderRadius: 999,
                    border: '1px solid var(--border-default)',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Coming soon
                </div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                Every morning at 7 AM ET we commit to a projected range, pin strike, and regime call —
                hashed and immutable. Every afternoon we grade ourselves in public.
              </div>
            </div>

            <div
              aria-disabled="true"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 20,
                borderRadius: 14,
                border: '1px dashed var(--border-default)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                opacity: 0.55,
                cursor: 'not-allowed',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--color-surface-subtle, rgba(255,255,255,0.05))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <History size={20} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>GEX Replay</div>
                <div
                  style={{
                    marginLeft: 'auto',
                    padding: '2px 8px',
                    borderRadius: 999,
                    border: '1px solid var(--border-default)',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Coming soon
                </div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                Scrub through any past session minute-by-minute. Watch walls shift, gamma flip drift,
                and per-strike GEX migrate. Drop two pins to see the delta between any two moments.
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            border: '1px solid var(--color-brand-primary)44',
            background: 'linear-gradient(135deg, var(--color-brand-primary)10 0%, var(--color-surface) 100%)',
            borderRadius: 18,
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            marginBottom: 32,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.3px' }}>
            Ready to trade the live read?
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-secondary)', maxWidth: 720 }}>
            You&apos;ve seen the structural map. The live ZeroGEX dashboard adds the real-time refresh, the
            full GEX profile, the strike-by-DTE heatmap, options-flow classification, and the 13-signal
            Market State Index — the context that turns these levels into a tradeable read. 7-day free
            trial, no card to get started.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
            <Link
              href="/register"
              style={{
                background: 'var(--color-brand-primary)',
                color: '#ffffff',
                padding: '12px 22px',
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 800,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Start 7-day free trial <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              style={{
                border: '1px solid var(--border-default)',
                color: 'var(--color-text-primary)',
                padding: '12px 22px',
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Compare plans
            </Link>
          </div>
        </section>

        <p
          style={{
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            opacity: 0.7,
            lineHeight: 1.7,
            margin: '32px 0 0 0',
          }}
        >
          {latestTimestamp ? `Snapshot timestamp (ET): ${fmtTimestampET(latestTimestamp)}. ` : ''}
          Levels on this page are derived analytics rebuilt from a market-data snapshot that is intentionally
          held back ~15 minutes from the live ZeroGEX feed. Provided for informational purposes only — not
          investment advice. Options trading involves significant risk.
        </p>
      </main>

      <Footer />
    </div>
  );
}
