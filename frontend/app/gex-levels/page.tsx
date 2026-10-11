import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock, Lock, LockOpen } from 'lucide-react';
import LandingHeader from '@/components/LandingHeader';
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';
import LevelsEmailSignup from '@/components/LevelsEmailSignup';
import { GEX_METHODOLOGY_SHORT } from '@/components/GexMethodologyNote';
import Footer from '@/app/spx-gamma-levels/Footer';
import { ComparePlansButton, TrialButton } from '@/app/spx-gamma-levels/TrialCtaButtons';
import {
  GAMMA_LEVEL_SYMBOLS,
  REGIME_DISPLAY,
  SYMBOL_CHAIN,
  loadSnapshots,
  snapshotFreshness,
  type GammaLevelSymbol,
} from '@/app/spx-gamma-levels/gammaLevels';
import { detectRegime } from '@/app/live-bulletin/bulletinHelpers';
import { netGexAtSpotOrNull } from '@/core/gammaRegime';
import { fmtNetGex, fmtPrice, fmtTimestampET, type GexSummary } from '@/core/gexSummary';
import {
  PUBLISHER_REF,
  SITE_DEFAULT_OG_IMAGE,
  SITE_TWITTER_HANDLE,
  SITE_URL,
  WEBSITE_ID,
} from '@/core/articleRegistry';

// /gex-levels: every free GEX level ZeroGEX publishes, on one page.
//
// WHY THIS PAGE. "gex levels", "gex data", "gex charts", "free gamma exposure
// chart" and "gamma exposure dashboard" are one search intent: someone who
// wants to see the levels, across instruments, before choosing one. The six
// /<ticker>-gamma-levels pages each answer the ticker-specific version of that
// ("spx net gex current value", "qqq gex") and should keep it; this page is the
// broad entry point above them. So it is deliberately not a seventh copy of a
// ticker page: it shows the six side by side, compact, says what each level
// means in a few sentences, and sends the reader to the ticker page for depth
// (the chart, the strike detail, the share line, the track record).
//
// DATA. Exactly the reads the ticker pages make: `loadSnapshots()` from
// gammaLevels.tsx, the same delayed /api/gex/summary call per symbol, the same
// one-minute fetch cache, the same last-good fallback and the same freshness
// rules. A visit here costs the backend nothing the ticker pages have not
// already paid for, and the numbers cannot disagree with theirs.
//
// RENDERING. force-static with a one-minute revalidate, like the ticker pages,
// so the H1, the copy, the levels and every link ship in the HTML. The only
// client components are the shared header, footer, trial buttons and the email
// form, the same set the ticker pages load.

export const dynamic = 'force-static';
export const revalidate = 60; // FREE_REVALIDATE_SECONDS in core/freeDelay.ts; Next needs a literal here.

const PATH = '/gex-levels';
const PAGE_URL = `${SITE_URL}${PATH}`;
// 55 characters with the separator. The proposed title used an em dash; the
// site writes that separator as a non-breaking space and a hyphen everywhere.
const TITLE = 'GEX Levels Today - Free Gamma Exposure Charts | ZeroGEX';
const H1 = 'GEX Levels Today - Free Gamma Exposure Charts';
// 148 characters.
const DESCRIPTION =
  'View GEX levels for SPX, SPY, QQQ, NDX and ES / NQ futures: the gamma flip, call walls, put walls and net gamma exposure, free on a 15-minute delay.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: 'website',
    url: PAGE_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'ZeroGEX',
    locale: 'en_US',
    images: [{ url: SITE_DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: H1 }],
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE_TWITTER_HANDLE,
    title: TITLE,
    description: DESCRIPTION,
    images: [SITE_DEFAULT_OG_IMAGE],
  },
};

// What each symbol is, for a reader who knows the ticker but not the product.
const INSTRUMENT: Record<GammaLevelSymbol, { name: string; kind: 'Index' | 'ETF' | 'Futures' }> = {
  SPX: { name: 'S&P 500 Index', kind: 'Index' },
  SPY: { name: 'SPDR S&P 500 ETF', kind: 'ETF' },
  QQQ: { name: 'Invesco QQQ (Nasdaq-100 ETF)', kind: 'ETF' },
  NDX: { name: 'Nasdaq-100 Index', kind: 'Index' },
  ES: { name: 'E-mini S&P 500 futures', kind: 'Futures' },
  NQ: { name: 'E-mini Nasdaq-100 futures', kind: 'Futures' },
};

// Index first, then its ETF, then its futures: the order a reader scanning for
// "their" market expects, and the order the ticker pages' footer column uses.
const ORDER: readonly GammaLevelSymbol[] = ['SPX', 'SPY', 'QQQ', 'NDX', 'ES', 'NQ'];

const levelsPath = (s: GammaLevelSymbol) => `/${s.toLowerCase()}-gamma-levels`;

// The level colors, read from the theme so every palette and both modes work.
const INK = {
  call: 'var(--color-negative)',
  put: 'var(--color-positive)',
  flip: 'var(--color-warning)',
  spot: 'var(--color-text-primary)',
} as const;

// ── Level map ───────────────────────────────────────────────────────────────
// A small server-rendered chart of where spot sits against the put wall, the
// gamma flip and the call wall, with the side of the flip shaded by regime.
// Plain SVG, no client code: it is part of the HTML and costs no JavaScript.
// Drawn only from levels the snapshot actually has; with fewer than two levels
// besides spot there is nothing to place spot against, so it is omitted.

function LevelMap({ symbol, data }: { symbol: GammaLevelSymbol; data: GexSummary | null }) {
  const spot = finite(data?.spot_price);
  const flip = finite(data?.gamma_flip);
  const call = finite(data?.call_wall);
  const put = finite(data?.put_wall);
  const levels = [put, flip, call].filter((v): v is number => v != null);
  if (spot == null || levels.length < 2) return null;

  const lo = Math.min(spot, ...levels);
  const hi = Math.max(spot, ...levels);
  const pad = (hi - lo) * 0.08 || spot * 0.002;
  const min = lo - pad;
  const max = hi + pad;
  const W = 300;
  const H = 34;
  const x = (v: number) => ((v - min) / (max - min)) * W;

  const label = [
    `${symbol} reference spot ${fmtPrice(spot)}`,
    flip != null ? `${spot >= flip ? 'above' : 'below'} the gamma flip at ${fmtPrice(flip)}` : null,
    put != null ? `put wall ${fmtPrice(put)}` : null,
    call != null ? `call wall ${fmtPrice(call)}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <title>{label}</title>
      {flip != null && (
        <>
          <rect x={0} y={10} width={x(flip)} height={14} fill={`color-mix(in srgb, var(--color-negative) 12%, transparent)`} />
          <rect x={x(flip)} y={10} width={W - x(flip)} height={14} fill={`color-mix(in srgb, var(--color-positive) 12%, transparent)`} />
        </>
      )}
      <line x1={0} x2={W} y1={17} y2={17} stroke="var(--color-border)" strokeWidth={1} />
      {put != null && <rect x={x(put) - 1.5} y={8} width={3} height={18} rx={1} fill={INK.put} />}
      {call != null && <rect x={x(call) - 1.5} y={8} width={3} height={18} rx={1} fill={INK.call} />}
      {flip != null && <rect x={x(flip) - 1} y={6} width={2} height={22} fill={INK.flip} />}
      <polygon points={`${x(spot) - 5},0 ${x(spot) + 5},0 ${x(spot)},7`} fill={INK.spot} />
      <line x1={x(spot)} x2={x(spot)} y1={7} y2={27} stroke={INK.spot} strokeWidth={1.5} />
    </svg>
  );
}

function finite(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

// ── Instrument panel ────────────────────────────────────────────────────────

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 6 }}
    />
  );
}

function InstrumentPanel({
  symbol,
  data,
  status,
}: {
  symbol: GammaLevelSymbol;
  data: GexSummary | null;
  status: 'ok' | 'stale' | 'missing';
}) {
  const regime = REGIME_DISPLAY[detectRegime(data?.gamma_flip, data?.spot_price)];
  const chain = SYMBOL_CHAIN[symbol];
  const rows: { label: string; value: string; color?: string }[] = [
    { label: 'Reference spot (delayed)', value: fmtPrice(data?.spot_price), color: INK.spot },
    { label: 'Gamma flip', value: fmtPrice(data?.gamma_flip), color: INK.flip },
    { label: 'Call wall', value: fmtPrice(data?.call_wall), color: INK.call },
    { label: 'Put wall', value: fmtPrice(data?.put_wall), color: INK.put },
    { label: 'Net GEX (at spot)', value: fmtNetGex(netGexAtSpotOrNull(data?.net_gex_at_spot)) },
  ];
  return (
    <article className="zg-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.4px' }}>{symbol}</h3>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: regime.color }}>
            {regime.label}
          </span>
        </div>
        <div style={{ marginTop: 2, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {INSTRUMENT[symbol].name}
          {chain !== symbol ? ` · levels from the ${chain} options chain` : ''}
        </div>
        {status !== 'ok' && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 8,
              padding: '3px 9px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--color-warning)',
              border: '1px solid color-mix(in srgb, var(--color-warning) 33%, transparent)',
            }}
          >
            <Clock size={11} /> {symbol} data temporarily {status === 'missing' ? 'unavailable' : 'delayed'}
          </div>
        )}
      </header>

      <LevelMap symbol={symbol} data={data} />

      <dl style={{ margin: 0, display: 'grid', gap: 6 }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
            <dt style={{ color: 'var(--color-text-secondary)' }}>
              {row.color ? <Swatch color={row.color} /> : null}
              {row.label}
            </dt>
            <dd style={{ margin: 0, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <footer style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>As of {fmtTimestampET(data?.timestamp)}</span>
        <Link
          href={levelsPath(symbol)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--color-brand-primary)' }}
        >
          {symbol} gamma levels <ArrowRight size={14} />
        </Link>
      </footer>
    </article>
  );
}

// ── Copy ────────────────────────────────────────────────────────────────────
// Each definition is short on purpose and ends at the article that covers it
// in full, so this page explains enough to read the panels above without
// becoming a second copy of the education library.

const CONCEPTS: { term: string; body: string; href: string; more: string }[] = [
  {
    term: 'Gamma exposure (GEX)',
    body: 'An estimate of how much stock options dealers would have to buy or sell as price moves, built from the open interest on the option chain. ZeroGEX models it under the standard convention: dealers long the calls customers sell and short the puts they buy. It is a model, not observed dealer inventory.',
    href: '/education/what-is-gex-in-trading',
    more: 'What is GEX in trading?',
  },
  {
    term: 'Gamma flip',
    body: 'The price where modeled net dealer gamma changes sign. Above it, dealer hedging tends to lean against moves; below it, hedging tends to add to them. It is a regime line, not a support or resistance level, and ZeroGEX leaves it blank when the chain has no crossing it can stand behind.',
    href: '/education/how-to-read-a-gamma-flip',
    more: 'What is a gamma flip?',
  },
  {
    term: 'Call wall',
    body: 'The strike above spot where call-side dealer gamma is most concentrated. Hedging there can slow a rally, and price may stall or pin near it, but a call wall is a zone to watch, not a ceiling: walls break, and they move through the session.',
    href: '/education/what-is-a-call-wall',
    more: 'What is a call wall?',
  },
  {
    term: 'Put wall',
    body: 'The strike below spot where put-side dealer gamma is most concentrated. In a positive-gamma session hedging tends to lean against a decline into it; in negative gamma a break below it can see hedging add to the move.',
    href: '/education/what-is-a-put-wall',
    more: 'What is a put wall?',
  },
  {
    term: 'Positive vs. negative gamma',
    body: 'When modeled dealers are net long gamma (spot above the flip), they tend to sell rallies and buy dips, which can damp volatility. When they are net short gamma (below the flip), they tend to trade with the move, which can amplify it. Neither says which way price goes next.',
    href: '/education/what-is-negative-gamma',
    more: 'What is negative gamma?',
  },
  {
    term: 'Net GEX',
    body: 'Modeled dealer gamma summed across the whole chain and evaluated at the current price, shown as dollars per 1% move. Its sign matches the side of the flip spot is on; its size says how deep into that regime the book is.',
    href: '/education/spx-net-gamma-exposure-today',
    more: 'SPX net GEX today, explained',
  },
];

// Every item is checked against content/help/platform/tiers-and-access.md and
// the pricing page; keep them in step.
const FREE_FEATURES: { label: string; href: string }[] = [
  { label: 'These levels for SPX, SPY, QQQ, NDX, ES and NQ, about 15 minutes delayed', href: '/spx-gamma-levels' },
  { label: 'The Gamma Terminal: a SPY gamma chart with strike ladders, delayed', href: '/chart' },
  { label: 'GEX Replay: scrub any recent session minute by minute', href: '/replay' },
  { label: 'The daily forecast and its graded track record', href: '/track-record' },
  { label: 'TradingView and thinkorswim indicators', href: '/integrations' },
  { label: 'A free daily levels email', href: '#levels-email' },
];

const PAID_FEATURES: { label: string; href: string }[] = [
  { label: 'Basic: live levels, recomputed about once a minute through the session', href: '/real-time-gex-0dte' },
  { label: 'Basic: the Gamma Terminal live, on every symbol', href: '/pricing' },
  { label: 'Basic: the dashboards, GEX heatmap, strike profile, flow and hedging-flow pages, and the Basic Signals', href: '/pricing' },
  { label: 'Pro: Advanced Signals, Trade Bias and the Composite Score', href: '/guides/signals-explained' },
  { label: 'Pro: API access and the auto-updating NinjaTrader and Sierra Chart studies', href: '/integrations' },
];

const RESOURCES: { group: string; links: { href: string; label: string }[] }[] = [
  {
    group: 'Levels by instrument',
    links: [
      { href: '/spx-gamma-levels', label: 'SPX gamma levels' },
      { href: '/spy-gamma-levels', label: 'SPY gamma levels' },
      { href: '/qqq-gamma-levels', label: 'QQQ gamma levels' },
      { href: '/ndx-gamma-levels', label: 'NDX gamma levels' },
      { href: '/es-gamma-levels', label: 'ES futures gamma levels' },
      { href: '/nq-gamma-levels', label: 'NQ futures gamma levels' },
    ],
  },
  {
    group: 'Free tools',
    links: [
      { href: '/chart', label: 'Gamma Terminal (free, delayed)' },
      { href: '/replay', label: 'GEX Replay' },
      { href: '/forecast', label: 'Daily gamma forecast' },
      { href: '/track-record', label: 'Forecast track record' },
      { href: '/embed', label: 'Gamma levels widget for your site' },
    ],
  },
  {
    group: 'Learn',
    links: [
      { href: '/education/gamma-exposure-explained', label: 'Gamma exposure (GEX) explained' },
      { href: '/education/gamma-walls-explained', label: 'Gamma walls: call wall and put wall' },
      { href: '/education/zero-gamma-level-explained', label: 'What is zero gamma?' },
      { href: '/education/0dte-dealer-positioning-explained', label: '0DTE dealer positioning' },
      { href: '/education/how-often-do-gamma-walls-break', label: 'How often gamma walls break' },
      { href: '/methodology', label: 'Methodology and validation' },
    ],
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What are GEX levels?',
    a: 'GEX levels are the prices where modeled options-dealer gamma exposure is concentrated or changes sign: the gamma flip, the call wall and the put wall, plus net GEX at the current price. Traders use them to see where dealer hedging may damp a move, add to it, or pin price nearby. They are estimates built from open interest, not guaranteed support or resistance and not predictions.',
  },
  {
    q: 'What is a gamma flip?',
    a: 'The gamma flip is the price where modeled net dealer gamma crosses zero. Above it, hedging tends to lean against moves; below it, hedging tends to add to them. When the option chain has no crossing close enough to spot to be tradable, ZeroGEX publishes no flip rather than a level it cannot stand behind.',
  },
  {
    q: 'How are call walls and put walls interpreted?',
    a: 'The call wall is the strike above spot with the most call-side dealer gamma, and the put wall the strike below spot with the most put-side gamma. Price often reacts near them because hedging is heaviest there, but walls do break and they move through the day. Read them as zones to plan around, alongside the gamma regime, not as levels that will hold.',
  },
  {
    q: 'Are ZeroGEX gamma levels free?',
    a: 'Yes. The levels on this page and on the six instrument pages are free with no account, on a delay of about 15 minutes. Live levels, every symbol in the Gamma Terminal, the dashboards and the signals are on the paid Basic and Pro plans; Basic monthly starts with a 7-day free trial.',
  },
  {
    q: 'How often are the levels updated?',
    a: 'This page refreshes through the session and shows each level with its own as-of time, at least 15 minutes behind the market. Inside the paid dashboard the same levels are recomputed about once a minute during the regular session.',
  },
  {
    q: 'Why are the ES and NQ levels based on SPX and NDX?',
    a: 'ZeroGEX computes the futures levels from the SPX and NDX option chains and converts them to ES and NQ prices at fair value, so they sit on the contract you trade. They can be slightly off when the futures trade rich or cheap to fair value.',
  },
];

export default async function GexLevelsPage() {
  const { snapshots, fromCache } = await loadSnapshots();
  const { cardStatus, latestTimestamp } = snapshotFreshness(snapshots, fromCache);
  const anyData = GAMMA_LEVEL_SYMBOLS.some((s) => snapshots[s] != null);

  const webPageLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': PAGE_URL,
    name: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    isPartOf: { '@id': WEBSITE_ID },
    publisher: PUBLISHER_REF,
    // The freshest snapshot on the page, so the date a crawler reads is the
    // as-of time a reader sees.
    ...(latestTimestamp ? { dateModified: latestTimestamp } : {}),
    about: [
      { '@type': 'Thing', name: 'Gamma exposure (GEX)' },
      { '@type': 'Thing', name: 'Gamma flip' },
      { '@type': 'Thing', name: 'Call wall' },
      { '@type': 'Thing', name: 'Put wall' },
    ],
    // The six instrument pages this one exists to route readers to.
    relatedLink: ORDER.map((s) => `${SITE_URL}${levelsPath(s)}`),
  };
  // FAQPage markup mirrors the visible FAQ below from the same array. Google
  // shows FAQ rich results only for a few authoritative sites now, so this is
  // not expected to produce one; it is kept because it is valid, matches the
  // page exactly, and is how the rest of the site marks up its FAQs.
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  const sectionHeading = { fontSize: 26, fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.3px' } as const;
  const sectionLead = { margin: '0 0 20px 0', fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-secondary)', maxWidth: 760 } as const;
  const linkStyle = { color: 'var(--color-brand-primary)' } as const;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text-primary)', display: 'flex', flexDirection: 'column' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <BreadcrumbJsonLd items={[{ name: 'Home', url: '/' }, { name: 'GEX Levels', url: PATH }]} />

      <LandingHeader />

      <main className="px-4 pt-[92px] pb-16 sm:px-6 sm:pt-[120px] sm:pb-20" style={{ flex: 1, maxWidth: 1080, margin: '0 auto', width: '100%' }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 18 }}>
          <Link href="/" style={{ color: 'inherit' }}>Home</Link>
          <span style={{ opacity: 0.6 }}> / </span>
          <span style={{ color: 'var(--color-text-primary)' }}>GEX Levels</span>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <header style={{ marginBottom: 40, textAlign: 'center' }}>
          <div className="zg-eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--color-brand-primary)', marginBottom: 18 }}>
            <Clock size={12} /> Free · Delayed ~15 minutes · No signup
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 50px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1px', margin: '0 0 16px 0' }}>
            {H1}
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--color-text-secondary)', margin: '0 auto', maxWidth: 740 }}>
            GEX levels are the prices where modeled options-dealer gamma is concentrated or changes sign: the gamma flip, the
            call wall and the put wall. Traders use them to see where dealer hedging may damp a move, add to it, or pin price
            nearby, and to plan around those zones rather than predict them. Below are today&apos;s levels for SPX, SPY, QQQ, NDX
            and the ES and NQ futures.
          </p>
          <p style={{ margin: '14px 0 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {latestTimestamp
              ? `Levels as of ${fmtTimestampET(latestTimestamp)}, at least 15 minutes behind the market.`
              : 'Levels are temporarily unavailable; the free pages refresh on their own once the data returns.'}
          </p>
          {/* A plain wrapping row, not .zg-lctas: on a phone that class turns any
              link directly inside it into a block, which breaks a link that is
              itself the button (as TrialButton is). */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 26, justifyContent: 'center' }}>
            <Link href="/spx-gamma-levels" className="zg-btn zg-btn--primary" style={{ padding: '12px 22px', fontSize: 14 }}>
              View Free Gamma Levels <ArrowRight size={16} />
            </Link>
            <Link href="/chart" className="zg-btn zg-btn--secondary" style={{ padding: '12px 22px', fontSize: 14 }}>
              Explore the Gamma Terminal
            </Link>
            <TrialButton label="Unlock Live Data" location="gex_levels_hero" symbol="ALL" />
          </div>
        </header>

        {/* ── Instrument overview ──────────────────────────────────────── */}
        <section id="instruments" aria-labelledby="instruments-heading" style={{ marginBottom: 48 }}>
          <h2 id="instruments-heading" style={sectionHeading}>Today&apos;s GEX levels by instrument</h2>
          <p style={sectionLead}>
            Each bar places the delayed reference spot (the marker) against the put wall, the gamma flip and the call wall;
            the shading shows the positive-gamma side of the flip in green and the negative side in red. Open an instrument
            for its full levels, the gamma chart and the strike detail.
          </p>
          {!anyData && (
            <p className="zg-panel" style={{ padding: 16, fontSize: 14, color: 'var(--color-text-secondary)' }}>
              The levels could not be loaded just now. Each instrument page below has the same data and will show it as soon
              as it is back.
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
            {ORDER.map((s) => (
              <InstrumentPanel key={s} symbol={s} data={snapshots[s]} status={cardStatus(s)} />
            ))}
          </div>

          {/* The same numbers as one table: the shape an answer engine or a
              screen reader takes them in most easily, and one quotable row per
              instrument with its own as-of time. */}
          <div style={{ marginTop: 24, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              <caption style={{ textAlign: 'left', fontSize: 13, fontWeight: 700, padding: '0 0 8px 0' }}>
                GEX levels at a glance (delayed about 15 minutes)
              </caption>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)' }}>
                  {['Instrument', 'Reference spot', 'Gamma flip', 'Call wall', 'Put wall', 'Net GEX', 'As of'].map((h) => (
                    <th key={h} scope="col" style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ORDER.map((s) => {
                  const d = snapshots[s];
                  return (
                    <tr key={s}>
                      <th scope="row" style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                        <Link href={levelsPath(s)} style={linkStyle}>{s}</Link>
                      </th>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)' }}>{fmtPrice(d?.spot_price)}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)' }}>{fmtPrice(d?.gamma_flip)}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)' }}>{fmtPrice(d?.call_wall)}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)' }}>{fmtPrice(d?.put_wall)}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)' }}>{fmtNetGex(netGexAtSpotOrNull(d?.net_gex_at_spot))}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{fmtTimestampET(d?.timestamp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div id="levels-email" style={{ marginBottom: 48, scrollMarginTop: 96 }}>
          <LevelsEmailSignup symbol="SPX" />
        </div>

        {/* ── Understanding GEX levels ─────────────────────────────────── */}
        <section aria-labelledby="concepts-heading" style={{ marginBottom: 48 }}>
          <h2 id="concepts-heading" style={sectionHeading}>Understanding GEX levels</h2>
          <p style={sectionLead}>
            Every number above is an estimate of dealer positioning, not a guaranteed support or resistance level and not a
            forecast. These are the short versions; each links to the full explainer.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 14 }}>
            {CONCEPTS.map((c) => (
              <div key={c.term} className="zg-panel" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800 }}>{c.term}</h3>
                <p style={{ margin: '0 0 10px 0', fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>{c.body}</p>
                <Link href={c.href} style={{ ...linkStyle, fontSize: 13, fontWeight: 700 }}>
                  {c.more}
                </Link>
              </div>
            ))}
          </div>
          <p style={{ margin: '18px 0 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)', maxWidth: 820 }}>
            How these levels are computed: {GEX_METHODOLOGY_SHORT} The full method, and how it is tested, is in the{' '}
            <Link href="/methodology" style={linkStyle}>methodology</Link>; every daily forecast built on it is graded in public on
            the <Link href="/track-record" style={linkStyle}>track record</Link>.
          </p>
        </section>

        {/* ── Free vs. subscriber ──────────────────────────────────────── */}
        <section aria-labelledby="plans-heading" style={{ marginBottom: 48 }}>
          <h2 id="plans-heading" style={sectionHeading}>Free levels vs. live data</h2>
          <p style={sectionLead}>
            The delayed levels are free and stay free. Paying members get the same model live, on every symbol, with the
            tools built on it.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 16 }}>
            {[
              { title: 'Free, no account', icon: LockOpen, items: FREE_FEATURES },
              { title: 'Basic and Pro plans', icon: Lock, items: PAID_FEATURES },
            ].map((col) => (
              <div key={col.title} className="zg-panel" style={{ padding: 22 }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <col.icon size={16} aria-hidden="true" /> {col.title}
                </h3>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, fontSize: 14, lineHeight: 1.55 }}>
                  {col.items.map((item) => (
                    <li key={item.label}>
                      <Link href={item.href} style={{ color: 'var(--color-text-primary)' }}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
            <TrialButton label="Start the 7-day free trial" location="gex_levels_plans" symbol="ALL" />
            <ComparePlansButton location="gex_levels_plans" symbol="ALL" />
          </div>
          <p style={{ margin: '10px 0 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
            The free trial comes with Basic monthly; every other plan has a 7-day money-back guarantee.
          </p>
        </section>

        {/* ── Related resources ────────────────────────────────────────── */}
        <section aria-labelledby="resources-heading" style={{ marginBottom: 48 }}>
          <h2 id="resources-heading" style={sectionHeading}>Related resources</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 20, marginTop: 12 }}>
            {RESOURCES.map((group) => (
              <div key={group.group}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                  {group.group}
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} style={{ ...linkStyle, fontSize: 14 }}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section id="faq" aria-labelledby="faq-heading" style={{ marginBottom: 24, scrollMarginTop: 96 }}>
          <h2 id="faq-heading" style={sectionHeading}>Frequently asked questions</h2>
          <div style={{ display: 'grid', gap: 18, marginTop: 12 }}>
            {FAQ.map((f) => (
              <div key={f.q}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: 17, fontWeight: 700 }}>{f.q}</h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--color-text-secondary)', marginTop: 32 }}>
          Educational information only, not investment advice. Levels are modeled estimates derived from a delayed snapshot of
          the option chain and can be wrong or out of date.
        </p>
      </main>

      <Footer />
    </div>
  );
}
