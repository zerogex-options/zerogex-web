import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, CheckCircle2, Clock, History, TrendingDown, TrendingUp } from 'lucide-react';
import { serverApiGet } from '@/core/api/serverFetch';
import { buildReportModel } from '../live-bulletin/bulletinHelpers';
import TodaysReadCard from '@/components/TodaysReadCard';
import LandingHeader from '@/components/LandingHeader';
import PlotOnTradingView from '@/components/PlotOnTradingView';
import Footer from './Footer';
import ShareBlock from './ShareBlock';
import PaidFunnelAnalytics from './PaidFunnelAnalytics';
import LiveReadConversion from './LiveReadConversion';
import DashboardPreview from './DashboardPreview';
import PricingTrialCta from './PricingTrialCta';
import StickyTrialBar from './StickyTrialBar';

// Shared, ticker-first view behind the free gamma-levels pages. One component
// renders three routes — /spx-gamma-levels, /spy-gamma-levels, /qqq-gamma-levels
// — each parameterized by its `primary` symbol so the title, H1, intro, Today's
// Read, share block, first-screen card order, and canonical all match the URL.
// The other two tickers still appear lower on every page and cross-link to their
// own dedicated pages, so the trio forms a tight internal cluster.
//
// Pure server component: ISR-cached at 900s (set on each route) so the page is
// naturally delayed and SEO-friendly, with zero auth wiring required. It stays
// inside the derived-data zone (call/put wall STRIKES, gamma flip LEVEL,
// max-pain, net GEX magnitudes) — no live-quote streaming — so it is
// licensing-clean by construction.

const SITE = 'https://zerogex.io';

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

// Per-ticker copy. Each page leads with its own symbol so it reads as the best
// possible answer for that symbol's query ("SPY gamma levels today", "QQQ call
// wall", "SPX gamma exposure today", …) and self-canonicalizes to its own URL.
interface SymbolContent {
  path: string;
  shareUrl: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
}

const SYMBOL_CONTENT: Record<Symbol, SymbolContent> = {
  SPX: {
    path: '/spx-gamma-levels',
    shareUrl: `${SITE}/spx-gamma-levels`,
    title: 'SPX / SPY / QQQ Gamma Levels Today: Gamma Flip, Call Wall, Put Wall & Net GEX',
    description:
      'Free daily SPX gamma levels — the SPX gamma flip, call wall, put wall, max pain, and net dealer GEX (Net GEX). Delayed dealer-positioning levels for SPX, SPY and QQQ, refreshed every 15 minutes. No signup required.',
    h1: 'SPX Gamma Levels Today',
    intro:
      "Track today's SPX gamma levels, including the SPX gamma flip, call wall, put wall, max pain, and net dealer GEX. These delayed levels help SPX and S&P 500 options traders identify key dealer-positioning zones before price gets there.",
  },
  SPY: {
    path: '/spy-gamma-levels',
    shareUrl: `${SITE}/spy-gamma-levels`,
    title: 'SPY Gamma Levels Today: Gamma Flip, Call Wall, Put Wall & Net GEX',
    description:
      'Free daily SPY gamma levels — the SPY gamma flip, call wall, put wall, max pain, and net dealer GEX (Net GEX). Delayed dealer-positioning levels, refreshed every 15 minutes. No signup required.',
    h1: 'SPY Gamma Levels Today',
    intro:
      "Track today's SPY gamma levels, including the SPY gamma flip, call wall, put wall, max pain, and net dealer GEX. These delayed levels help SPY traders identify key dealer-positioning zones before price gets there.",
  },
  QQQ: {
    path: '/qqq-gamma-levels',
    shareUrl: `${SITE}/qqq-gamma-levels`,
    title: 'QQQ Gamma Levels Today: Gamma Flip, Call Wall, Put Wall & Net GEX',
    description:
      'Free daily QQQ gamma levels — the QQQ gamma flip, call wall, put wall, max pain, and net dealer GEX (Net GEX). Delayed dealer-positioning levels, refreshed every 15 minutes. No signup required.',
    h1: 'QQQ Gamma Levels Today',
    intro:
      "Track today's QQQ gamma levels, including the QQQ gamma flip, call wall, put wall, max pain, and net dealer GEX. These delayed levels help Nasdaq and QQQ traders understand where options positioning may create support, resistance, pinning, or volatility expansion.",
  },
};

// Individual dedicated page for a ticker — used to cross-link the sibling cards.
function gammaPath(symbol: Symbol): string {
  return SYMBOL_CONTENT[symbol].path;
}

// Primary symbol first, then the remaining two in their canonical order. Drives
// both the share snippet and the on-page card order so the "first screen"
// matches the URL.
function symbolOrder(primary: Symbol): Symbol[] {
  return [primary, ...SYMBOLS.filter((s) => s !== primary)];
}

export function gammaMetadata(primary: Symbol): Metadata {
  const c = SYMBOL_CONTENT[primary];
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical: c.path },
    openGraph: {
      title: c.title,
      description: c.description,
      url: c.shareUrl,
      siteName: 'ZeroGEX',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: c.title,
      description: c.description,
    },
  };
}

// Ticker-specific FAQ. Rendered visibly (so answer engines can quote it) AND
// mirrored into FAQPage JSON-LD below, both from this one source so they never
// drift. The wording is deliberately plain and self-contained — each answer
// stands alone as a quotable definition for question-style searches like
// "what is the SPY gamma flip" or "what is a QQQ put wall".
function faqItems(primary: Symbol): { q: string; a: string }[] {
  return [
    {
      q: `What are ${primary} gamma levels?`,
      a: `${primary} gamma levels are price zones where options dealer positioning may influence support, resistance, pinning, or volatility. Common levels include the gamma flip, call wall, put wall, and max pain.`,
    },
    {
      q: `What is the ${primary} gamma flip?`,
      a: `The ${primary} gamma flip is the price level where dealer positioning may shift from positive gamma to negative gamma, or vice versa. Above or below this level, market behavior can change from more stable and mean-reverting to more volatile and directional.`,
    },
    {
      q: `What is the ${primary} call wall?`,
      a: `The ${primary} call wall is a strike where call gamma exposure is concentrated. It can act as an upside magnet, resistance area, or pinning zone depending on broader positioning and price action.`,
    },
    {
      q: `What is the ${primary} put wall?`,
      a: `The ${primary} put wall is a strike where put gamma exposure is concentrated. It can act as a downside support area, hedge-pressure zone, or acceleration level if price breaks through it.`,
    },
    {
      q: `How often are ZeroGEX ${primary} gamma levels updated?`,
      a: `ZeroGEX provides delayed free ${primary} gamma levels on this page. Real-time levels are available inside the ZeroGEX dashboard.`,
    },
  ];
}

// "Learn more" internal links to the matching education articles — the concept
// explainers behind each level. Points only at existing articles; anchor text
// mirrors the question-style intents these pages also target.
const LEARN_MORE_LINKS: { href: string; label: string }[] = [
  { href: '/education/how-to-read-a-gamma-flip', label: 'What Is a Gamma Flip?' },
  { href: '/education/what-is-a-call-wall', label: 'What Is a Call Wall?' },
  { href: '/education/what-is-a-put-wall', label: 'What Is a Put Wall?' },
  { href: '/education/what-is-gex-in-trading', label: 'What Is GEX in Trading?' },
  { href: '/education/spx-net-gamma-exposure-today', label: 'SPX Net Gamma Exposure Today: Reading Net GEX' },
  { href: '/education/how-to-trade-around-gamma-flip', label: 'How Traders Use Gamma Levels' },
  { href: '/education/spy-vs-spx-gamma-levels', label: 'SPY vs SPX Options: Which Gamma Levels Matter?' },
];

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

// ── Copy/paste share snippet ────────────────────────────────────────────────
// The shareable block is built server-side from the same ISR snapshot that
// feeds the cards below, so it stays in sync and ships inside the static HTML.
// Formatting is plain-text and platform-agnostic (ASCII +/- signs, trimmed
// decimals) so it pastes cleanly into X, StockTwits, Reddit, Discord, etc.:
//   • spot + gamma flip keep the index/ETF decimal convention (SPX whole,
//     SPY/QQQ two decimals),
//   • call/put walls are strikes → whole numbers,
//   • net GEX collapses to a signed $B/$M/$K magnitude.
// The snippet leads with the page's primary ticker and links to the page's own
// URL, so the share block matches the URL like the rest of the first screen.

function fmtShareLevel(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value >= 1000) return Math.round(value).toString();
  return value.toFixed(2);
}

function fmtShareStrike(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return Math.round(value).toString();
}

function fmtShareGex(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';
  const trim = (x: number, dp: number) => parseFloat(x.toFixed(dp)).toString();
  if (abs >= 1e9) return `${sign}$${trim(abs / 1e9, 2)}B`;
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6, 1)}M`;
  if (abs >= 1e3) return `${sign}$${trim(abs / 1e3, 0)}K`;
  return `${sign}$${Math.round(abs)}`;
}

function shareLine(symbol: Symbol, data: GexSummary | null): string {
  return (
    `${symbol}: spot ${fmtShareLevel(data?.spot_price)} | ` +
    `Call Wall ${fmtShareStrike(data?.call_wall)} | ` +
    `Put Wall ${fmtShareStrike(data?.put_wall)} | ` +
    `Gamma Flip ${fmtShareLevel(data?.gamma_flip)} | ` +
    `Net GEX ${fmtShareGex(data?.net_gex_at_spot ?? data?.net_gex)}`
  );
}

function buildShareSnippet(snapshots: Record<Symbol, GexSummary | null>, primary: Symbol): string {
  const order = symbolOrder(primary);
  return [
    `${order.join(' / ')} gamma levels from ZeroGEX:`,
    ...order.map((s) => shareLine(s, snapshots[s])),
    'Free delayed levels:',
    SYMBOL_CONTENT[primary].shareUrl,
  ].join('\n');
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

// The primary ticker's card links deeper to its live dashboard (the conversion
// path); the other two tickers link to their own dedicated gamma-levels pages so
// the three pages cross-link into a cluster.
function SymbolCard({ symbol, data, isPrimary }: { symbol: Symbol; data: GexSummary | null; isPrimary: boolean }) {
  const regime = gexRegimeLabel(data?.net_gex_at_spot ?? data?.net_gex);
  const regimeColor =
    regime.tone === 'bull'
      ? 'var(--color-positive)'
      : regime.tone === 'bear'
        ? 'var(--color-negative)'
        : 'var(--color-text-secondary)';
  const href = isPrimary ? `/gamma-exposure?symbol=${symbol}` : gammaPath(symbol);
  const ctaLabel = isPrimary ? `Live ${symbol} dashboard` : `${symbol} gamma levels`;
  return (
    <Link
      href={href}
      style={{
        background: 'linear-gradient(145deg, var(--color-surface) 0%, var(--bg-active) 100%)',
        border: '1px solid var(--border-default)',
        borderRadius: 18,
        padding: '28px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
        transition: 'border-color 150ms, transform 150ms',
      }}
      className="hover:!border-[var(--color-brand-primary)]"
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
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-brand-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {ctaLabel}
          <ArrowRight size={14} />
        </span>
      </footer>
    </Link>
  );
}

export default async function GammaLevelsView({ primary }: { primary: Symbol }) {
  const content = SYMBOL_CONTENT[primary];
  const order = symbolOrder(primary);
  const snapshots = await loadSnapshots();
  const primaryData = snapshots[primary];
  const anyData = SYMBOLS.some((s) => snapshots[s] !== null);

  // Daily copy/paste share snapshot — built here so it ships in the ISR HTML and
  // is passed to the interactive ShareBlock as a ready-to-post string.
  const shareSnippet = buildShareSnippet(snapshots, primary);
  const shareHasData = SYMBOLS.some((s) => {
    const spot = snapshots[s]?.spot_price;
    return typeof spot === 'number' && Number.isFinite(spot);
  });

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
    name: content.title,
    description: content.description,
    url: content.shareUrl,
    isAccessibleForFree: true,
    publisher: { '@type': 'Organization', name: 'ZeroGEX', url: SITE },
    about: [
      { '@type': 'Thing', name: 'Gamma exposure (GEX)' },
      { '@type': 'Thing', name: 'Dealer hedging' },
      { '@type': 'Thing', name: `${primary} options` },
      { '@type': 'Thing', name: 'Call wall' },
      { '@type': 'Thing', name: 'Put wall' },
      { '@type': 'Thing', name: 'Gamma flip' },
    ],
  };

  const faqs = faqItems(primary);
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <LandingHeader />

      <main style={{ flex: 1, maxWidth: 1080, margin: '0 auto', padding: '120px 24px 80px', width: '100%' }}>
        {/* Marks the top of the paid-traffic funnel (renders nothing). */}
        <PaidFunnelAnalytics symbol={primary} />

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
            <Clock size={12} /> Free preview · Delayed ~15 minutes
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
            {content.h1}
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
            {content.intro}
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

        {/* Today's Read — page-level summary for the primary symbol the URL
            ranks for. Sentence-level regime read above the per-symbol cards so a
            visitor lands on the page and gets the prose first. Server-side
            buildReportModel works fine here — no VIX available in the ISR
            snapshot path, so the expected-range field stays null and the card
            cleanly omits it. */}
        {primaryData && (
          <div style={{ marginBottom: 24 }}>
            <TodaysReadCard
              model={buildReportModel({
                symbol: primary,
                spot: primaryData.spot_price ?? null,
                priorClose: null,
                summary: primaryData,
                vix: null,
                volIndex: 'VIX',
                horizon: 'daily',
              })}
            />
          </div>
        )}

        {/* Delayed-vs-live clarity strip (requirement #2): keep it unmistakable
            that these cards are the free, delayed preview and that the live
            read lives in the dashboard — placed directly against the levels so
            the distinction reads at a glance. */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px 14px',
            marginBottom: 18,
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid var(--border-default)',
            background: 'var(--color-surface)',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            <Clock size={13} style={{ color: 'var(--color-brand-primary)' }} />
            Free preview · delayed approximately 15 minutes
          </span>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            Live real-time levels are available inside the{' '}
            <Link href="/register" style={{ color: 'var(--color-brand-primary)', fontWeight: 600 }}>
              ZeroGEX dashboard
            </Link>
            .
          </span>
        </div>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20,
            marginBottom: 40,
          }}
        >
          {order.map((symbol) => (
            <SymbolCard key={symbol} symbol={symbol} data={snapshots[symbol]} isPrimary={symbol === primary} />
          ))}
        </section>

        {/* Conversion block (requirement #1): directly after the free delayed
            levels, before the product preview and educational content. */}
        <LiveReadConversion symbol={primary} />

        {/* Product preview + benefits (requirement #5). */}
        <DashboardPreview symbol={primary} />

        {/* Pricing/trial CTA (requirement #6/#7 copy standard). */}
        <PricingTrialCta symbol={primary} />

        {/* Share block (requirement #4): moved down here, below the conversion
            path, so it stays useful for organic/social visitors without
            distracting paid visitors from the signup step. */}
        <ShareBlock
          symbol={primary}
          snippet={shareSnippet}
          shareUrl={content.shareUrl}
          hasData={shareHasData}
          asOf={latestTimestamp ? fmtTimestampET(latestTimestamp) : null}
        />

        {/* ── Education & reference ─────────────────────────────────────────
            Everything below is the indexable, evergreen content that keeps this
            page ranking as a free levels / informational page (requirement
            #10). It sits under the conversion path, not instead of it. */}

        {/* Free-indicator funnel: hand the trader a way to plot today's numbers
            on their own chart, then route them to the live dashboard. Shared by
            all three ticker pages via this GammaLevelsView. */}
        <PlotOnTradingView />

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
            Learn more
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            {LEARN_MORE_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} style={{ color: 'var(--color-brand-primary)' }}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px' }}>
            Two free tools nobody else ships
          </h2>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            No login required. Bookmark either — the URL stays valid every day.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            <Link
              href="/forecast"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 20,
                borderRadius: 14,
                border: '1px solid var(--border-default)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                textDecoration: 'none',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--color-surface-subtle, rgba(255,255,255,0.05))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-brand-primary)',
                  }}
                >
                  <CheckCircle2 size={20} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Daily Forecast</div>
                <div
                  style={{
                    marginLeft: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'color-mix(in srgb, var(--color-brand-accent) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-brand-accent) 33%, transparent)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--color-brand-accent)',
                    lineHeight: 1.1,
                  }}
                >
                  Beta
                </div>
                <ArrowRight size={16} style={{ color: 'var(--color-text-secondary)' }} />
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
                Every morning at 7 AM ET we commit to a projected range, pin strike, and regime call —
                hashed and immutable. Every afternoon we grade ourselves in public.
              </div>
            </Link>

            <Link
              href="/replay"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 20,
                borderRadius: 14,
                border: '1px solid var(--border-default)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                textDecoration: 'none',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--color-surface-subtle, rgba(255,255,255,0.05))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-brand-primary)',
                  }}
                >
                  <History size={20} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Daily Replay</div>
                <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)' }} />
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
                Scrub through any past session minute-by-minute. Watch walls shift, gamma flip drift,
                and per-strike GEX migrate. Drop two pins to see the delta between any two moments.
              </div>
            </Link>
          </div>
        </section>

        <section style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 16px 0', letterSpacing: '-0.3px' }}>
            Frequently asked questions
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {faqs.map((f) => (
              <div
                key={f.q}
                style={{
                  border: '1px solid var(--border-default)',
                  borderRadius: 14,
                  padding: 22,
                  background: 'var(--color-surface)',
                }}
              >
                <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {f.q}
                </h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                  {f.a}
                </p>
              </div>
            ))}
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

      {/* Sticky mobile-first trial CTA (requirement #3). Appears after the
          visitor scrolls past the first screen; dismissible for the session. */}
      <StickyTrialBar symbol={primary} />
    </div>
  );
}
