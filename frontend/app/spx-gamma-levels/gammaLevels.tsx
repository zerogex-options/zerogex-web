import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, CheckCircle2, Clock, History, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { serverApiGet } from '@/core/api/serverFetch';
import { buildReportModel, detectRegime, type RegimeKey } from '../live-bulletin/bulletinHelpers';
import TodaysReadCard from '@/components/TodaysReadCard';
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';
import LandingHeader from '@/components/LandingHeader';
import PlotOnTradingView from '@/components/PlotOnTradingView';
import PlotOnNinjaTrader from '@/components/PlotOnNinjaTrader';
import Footer from './Footer';
import ShareBlock from './ShareBlock';
import PaidFunnelAnalytics from './PaidFunnelAnalytics';
import LiveReadConversion from './LiveReadConversion';
import DashboardPreview from './DashboardPreview';
import PricingTrialCta from './PricingTrialCta';
import StickyTrialBar from './StickyTrialBar';
import GammaTerminalChart from '@/components/GammaTerminalChart';
import { loadChartSnapshot } from '@/app/chart/snapshot';
import { futuresDelayNote } from '@/core/futuresDataStatus';
import { netGexAtSpotOrNull } from '@/core/gammaRegime';
import { volatilityIndexFor } from '@/core/symbols';

// Shared, ticker-first view behind the free gamma-levels pages. One component
// renders four routes — /spx-gamma-levels, /spy-gamma-levels, /qqq-gamma-levels,
// /ndx-gamma-levels — each parameterized by its `primary` symbol so the title,
// H1, intro, Today's Read, share block, first-screen card order, and canonical
// all match the URL. The other three tickers still appear lower on every page
// and cross-link to their own dedicated pages, so they form a tight internal
// cluster.
//
// Pure server component: ISR-cached at 900s (set on each route) so the page is
// naturally delayed and SEO-friendly, with zero auth wiring required. It stays
// inside the derived-data zone (call/put wall STRIKES, gamma flip LEVEL,
// max-pain, net GEX magnitudes) — no live-quote streaming — so it is
// licensing-clean by construction.

const SITE = 'https://zerogex.io';

// A ticker whose snapshot is this far behind the freshest of the three is
// surfaced as "temporarily delayed" — so a stale SPX card (e.g. an afternoon
// index snapshot) never sits silently next to fresh SPY/QQQ cards as if they
// were the same moment. Measured relative to the freshest snapshot in the set
// (never wall-clock), so it stays deterministic inside the ISR HTML.
const STALE_THRESHOLD_MS = 90 * 60 * 1000;

const SYMBOLS = ['SPX', 'SPY', 'QQQ', 'NDX', 'ES', 'NQ'] as const;
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
  // Pin Strike — reachable 0DTE strike with the strongest modeled positive
  // (restoring) dealer gamma into expiration. Null when no meaningful pin.
  pin_strike?: number | null;
  pin_score?: number | null;
  pin_confidence?: number | null;
  pin_strike_reason?: string | null;
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

// The one place a symbol's copy actually differs: the index/ETF it tracks, woven
// into the intro's audience clause. Everything else (title, description, H1,
// intro shape) is generated from a single template below so all three pages are
// byte-for-byte identical except the ticker — no drift, and each page stays
// focused on its own symbol instead of cannibalizing its siblings' keywords.
const SYMBOL_AUDIENCE: Record<Symbol, string> = {
  SPX: 'SPX and S&P 500 options traders',
  SPY: 'SPY and S&P 500 options traders',
  QQQ: 'QQQ and Nasdaq-100 options traders',
  NDX: 'NDX and Nasdaq-100 options traders',
  ES: 'ES and S&P 500 futures traders',
  NQ: 'NQ and Nasdaq-100 futures traders',
};

// The options chain each symbol's levels are actually computed from. ES and
// NQ have no chain of their own here: their levels are the SPX / NDX
// option-derived levels carried onto the futures price axis. Saying "the ES
// options chain" on a public page would be plainly false, so the copy names
// the real source wherever the two differ.
const SYMBOL_CHAIN: Record<Symbol, Symbol> = {
  SPX: 'SPX',
  SPY: 'SPY',
  QQQ: 'QQQ',
  NDX: 'NDX',
  ES: 'SPX',
  NQ: 'NDX',
};

/** Sentence disclosing the derivation, for symbols that have one. */
function derivationNote(primary: Symbol): string {
  const chain = SYMBOL_CHAIN[primary];
  if (chain === primary) return '';
  // futuresDelayNote is empty once the real-time CME entitlement is live —
  // see core/futuresDataStatus.ts, which is the single switch.
  return ` ${primary} levels are derived from the ${chain} options chain and converted to ${primary} prices using the live futures basis, so they line up with the ${primary} contract you actually trade.${futuresDelayNote(primary)}`;
}

function buildSymbolContent(primary: Symbol): SymbolContent {
  const path = `/${primary.toLowerCase()}-gamma-levels`;
  return {
    path,
    shareUrl: `${SITE}${path}`,
    title: `${primary} Gamma Levels Today: Gamma Flip, Call Wall, Put Wall & Net GEX`,
    description: `Free daily ${primary} gamma levels — the ${primary} gamma flip, call wall, put wall, max pain, and net dealer GEX (Net GEX). Delayed dealer-positioning levels, refreshed every 15 minutes. No signup required.`,
    h1: `${primary} Gamma Levels Today`,
    intro: `Track today's ${primary} gamma levels — the ${primary} gamma flip, call wall, put wall, max pain, and net dealer GEX. These free levels are delayed roughly 15 minutes and help ${SYMBOL_AUDIENCE[primary]} see the key dealer-positioning zones where price may pin, reject, or accelerate before it gets there.${derivationNote(primary)}`,
  };
}

const SYMBOL_CONTENT: Record<Symbol, SymbolContent> = {
  ES: buildSymbolContent('ES'),
  NQ: buildSymbolContent('NQ'),
  SPX: buildSymbolContent('SPX'),
  SPY: buildSymbolContent('SPY'),
  QQQ: buildSymbolContent('QQQ'),
  NDX: buildSymbolContent('NDX'),
};

// Individual dedicated page for a ticker — used to cross-link the sibling cards.
function gammaPath(symbol: Symbol): string {
  return SYMBOL_CONTENT[symbol].path;
}

// Primary symbol first, then the remaining three in their canonical order.
// Drives both the share snippet and the on-page card order so the "first
// screen" matches the URL.
function symbolOrder(primary: Symbol): Symbol[] {
  return [primary, ...SYMBOLS.filter((s) => s !== primary)];
}

// Value-led meta description — the search-snippet counterpart to the "Today's
// <ticker> net GEX" answer block further down the page.
//
// Search Console (92 days to 2026-08-24) shows this page taking 23,027
// impressions at average position 7.05 and converting 0.48% of them. Position
// seven normally earns 2-3%, so the loss is happening in the snippet, not the
// ranking. The query cluster says why: "<ticker> net gex current value",
// "<ticker> net gamma exposure current", "current <ticker> net gex dollar
// gamma" — searchers want a NUMBER, and the evergreen description promised
// "levels", which reads as another explainer page. Leading with the actual
// figure makes the snippet answer the query it ranks for.
//
// Uses the same `fmtNetGex` / `fmtPrice` helpers as the visible cards, off the
// same cached snapshot, so the snippet can never contradict the page. Falls
// back to `c.description` whenever the snapshot is missing a value — a
// half-filled description with an em dash where a level should be is worse
// than the evergreen copy.
function liveDescription(primary: Symbol, data: GexSummary | null): string {
  const c = SYMBOL_CONTENT[primary];
  const netGex = netGexAtSpotOrNull(data?.net_gex_at_spot);
  const flip = data?.gamma_flip ?? null;
  if (netGex === null || flip === null) return c.description;

  // Net GEX and the flip carry the intent, so they lead and are always present.
  // The walls and max pain are additive: each is appended only if it exists,
  // and only while the whole line stays inside the ~155 characters Google
  // renders, so a wide print (NDX five-figure strikes, a $123.4M net GEX)
  // truncates the least important term instead of the sentence.
  const head = `${primary} net GEX ${fmtNetGex(netGex)} · gamma flip ${fmtPrice(flip)}`;
  const tail = `. Free ${primary} dealer-positioning levels, 15-min delayed. No signup.`;
  const optional: string[] = [];
  if (data?.call_wall != null) optional.push(`call wall ${fmtPrice(data.call_wall)}`);
  if (data?.put_wall != null) optional.push(`put wall ${fmtPrice(data.put_wall)}`);
  if (data?.max_pain != null) optional.push(`max pain ${fmtPrice(data.max_pain)}`);

  let out = head;
  for (const part of optional) {
    const next = `${out} · ${part}`;
    if (next.length + tail.length > 155) break;
    out = next;
  }
  return out + tail;
}

// Async because the description carries live values. The snapshot comes from
// the same 900s-cached `serverApiGet` the page component uses, so this shares
// that cache entry rather than adding a backend call, and stays compatible
// with `force-static` + `revalidate = 900` on each route.
export async function gammaMetadata(primary: Symbol): Promise<Metadata> {
  const c = SYMBOL_CONTENT[primary];
  const data = await serverApiGet<GexSummary>(
    `/api/gex/summary?symbol=${primary}&underlying=${primary}`,
    900,
  );
  const description = liveDescription(primary, data);
  return {
    title: c.title,
    description,
    alternates: { canonical: c.path },
    openGraph: {
      title: c.title,
      description,
      url: c.shareUrl,
      siteName: 'ZeroGEX',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: c.title,
      description,
    },
  };
}

// Mostly symbol-agnostic FAQ — each concept answer reads as a general
// definition, identical across all four ticker pages. The one exception is the
// net-GEX item, which is intentionally symbol-specific (e.g. "SPX net gamma
// exposure") so each page answers the exact "<ticker> net GEX today / current
// value" query it ranks for. Rendered visibly (so answer engines can quote it)
// AND mirrored into FAQPage JSON-LD below, both from this one source so they
// never drift. The wording is deliberately plain and self-contained — each
// answer stands alone as a quotable definition for question-style searches like
// "what is a gamma flip" or "what is SPX net gamma exposure right now".
function faqItems(primary: Symbol): { q: string; a: string }[] {
  return [
    {
      q: 'What are gamma levels?',
      a: 'Gamma levels are price zones where options dealer positioning may influence support, resistance, pinning, or volatility. Common levels include the gamma flip, call wall, put wall, and max pain.',
    },
    {
      q: `What is ${primary}'s net gamma exposure (net GEX) right now?`,
      a: `Today's ${primary} net GEX — the net dealer gamma across the ${SYMBOL_CHAIN[primary]} options chain, evaluated at spot and expressed as a signed dollar "gamma" figure — is shown at the top of this page and refreshed on a roughly 15-minute delay. A positive value means ${primary} is trading above its gamma flip, where dealer hedging tends to suppress volatility; a negative value means it is below the flip, where hedging tends to amplify it. The price where net GEX crosses zero is the gamma flip, also called the zero-gamma level. Net GEX is a modeled estimate, not directly observed dealer inventory.`,
    },
    {
      q: 'What is the gamma flip?',
      a: 'The gamma flip is the price level where dealer positioning may shift from positive gamma to negative gamma, or vice versa. Above or below this level, market behavior can change from more stable and mean-reverting to more volatile and directional.',
    },
    {
      q: 'What is a call wall?',
      a: 'A call wall is a strike where call gamma exposure is concentrated. It can act as an upside magnet, resistance area, or pinning zone depending on broader positioning and price action.',
    },
    {
      q: 'What is a put wall?',
      a: 'A put wall is a strike where put gamma exposure is concentrated. It can act as a downside support area, hedge-pressure zone, or acceleration level if price breaks through it.',
    },
    {
      q: 'How often are ZeroGEX gamma levels updated?',
      a: 'ZeroGEX provides delayed free gamma levels on this page. Real-time levels are available inside the ZeroGEX dashboard.',
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
  { href: '/education/gamma-walls-explained', label: 'Gamma Walls Explained: Call Wall & Put Wall' },
  { href: '/education/what-is-gex-in-trading', label: 'What Is GEX in Trading?' },
  { href: '/education/spx-net-gamma-exposure-today', label: 'SPX Net Gamma Exposure Today: Reading Net GEX' },
  { href: '/education/how-to-trade-around-gamma-flip', label: 'How Traders Use Gamma Levels' },
  { href: '/education/best-gex-tools', label: 'Best GEX Tools & Platforms: A Fair Comparison' },
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

function shareLine(symbol: Symbol, data: GexSummary | null, delayed = false): string {
  return (
    `${symbol}: spot ${fmtShareLevel(data?.spot_price)} | ` +
    `Call Wall ${fmtShareStrike(data?.call_wall)} | ` +
    `Put Wall ${fmtShareStrike(data?.put_wall)} | ` +
    `Gamma Flip ${fmtShareLevel(data?.gamma_flip)} | ` +
    `Net GEX ${fmtShareGex(netGexAtSpotOrNull(data?.net_gex_at_spot))}` +
    (delayed ? ' (delayed)' : '')
  );
}

// The share snippet is built from the same snapshots that feed the visible
// cards, so it can never drift from them. Any ticker flagged stale relative to
// the freshest is tagged "(delayed)" in its line so the pasted snapshot doesn't
// present an old ticker as current alongside fresh ones.
function buildShareSnippet(
  snapshots: Record<Symbol, GexSummary | null>,
  primary: Symbol,
  staleSymbols?: ReadonlySet<Symbol>,
): string {
  const order = symbolOrder(primary);
  return [
    ...order.map((s) => shareLine(s, snapshots[s], staleSymbols?.has(s) ?? false)),
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

// Regime shown on each ticker card. Determined the same way as the live app
// (GexRegimeHeader) and the Today's Read (buildReportModel → detectRegime):
// purely by where spot sits relative to the gamma flip, with a ±0.25% "at the
// flip" band — NOT by the sign of a net-GEX total. One shared methodology means
// the card badge, the Today's Read badge, and the dashboard header can never
// disagree for the same snapshot.
const REGIME_DISPLAY: Record<
  RegimeKey,
  { label: string; color: string; icon: 'up' | 'down' | 'flat' | 'none'; body: string }
> = {
  positive: {
    label: 'Positive gamma (suppressed vol)',
    color: 'var(--color-positive)',
    icon: 'up',
    body: 'Dealers are net long gamma at spot — mean-reversion is favored, pinning is more likely, breakouts tend to stall.',
  },
  negative: {
    label: 'Negative gamma (amplified vol)',
    color: 'var(--color-negative)',
    icon: 'down',
    body: 'Dealers are net short gamma at spot — moves can accelerate, walls are more brittle, trend extension is the higher-probability path.',
  },
  neutral: {
    label: 'At the gamma flip',
    color: 'var(--color-warning)',
    icon: 'flat',
    body: 'Spot is sitting on the gamma flip — the sign of dealer hedging is unstable here, and a small move tips the tape into the next regime.',
  },
  unresolved: {
    label: 'Gamma flip unresolved',
    color: 'var(--color-text-secondary)',
    icon: 'none',
    body: 'The dealer gamma flip couldn’t be resolved from this snapshot — read these levels as provisional.',
  },
};

// Last-good snapshot per symbol, held in process memory to ride through a brief
// upstream outage. A backend deploy bounces the API for ~30–60s (a graceful
// stop→start); if an ISR revalidation of this page fires inside that window,
// every /api/gex/summary call returns null. Without a fallback, all three cards
// render blank and — because the render still "succeeds" — that empty HTML is
// what ISR caches and serves for the next 900s, turning a 45-second deploy blip
// into a 15-minute free-page outage.
//
// Process-scoped and deliberately simple: it relies on the single-instance PM2
// fork deployment (ecosystem.config.js — instances:1, exec_mode:'fork'), so
// every render in the one Node process shares this Map. It is lost on restart,
// which only means the first render after a restart-during-outage can still
// blank — a rare, acceptable residual (and frequent process recycling is
// exactly what keeps a cached snapshot from ever getting very old, so no TTL is
// needed here). A card served from this cache is always flagged 'stale' below,
// so last-known-good is never presented as a live read.
const lastGoodSnapshots = new Map<Symbol, GexSummary>();

interface LoadedSnapshots {
  snapshots: Record<Symbol, GexSummary | null>;
  /** Symbols rendered from `lastGoodSnapshots` because this cycle's fetch failed. */
  fromCache: Set<Symbol>;
}

// Pull all four symbols in parallel. Each call is cached in the Next.js fetch
// cache at 900s, so the page itself is effectively ISR'd at the same cadence.
// A successful fetch refreshes the last-good cache; a null (missing token,
// unreachable backend, non-2xx — see serverApiGet) falls back to the last-good
// snapshot so a transient blip degrades to "delayed" instead of "unavailable".
async function loadSnapshots(): Promise<LoadedSnapshots> {
  const fromCache = new Set<Symbol>();
  const entries = await Promise.all(
    SYMBOLS.map(async (symbol) => {
      const fresh = await serverApiGet<GexSummary>(
        `/api/gex/summary?symbol=${symbol}&underlying=${symbol}`,
        900,
      );
      if (fresh) {
        lastGoodSnapshots.set(symbol, fresh);
        return [symbol, fresh] as const;
      }
      const cached = lastGoodSnapshots.get(symbol) ?? null;
      if (cached) fromCache.add(symbol);
      return [symbol, cached] as const;
    }),
  );
  return {
    snapshots: Object.fromEntries(entries) as Record<Symbol, GexSummary | null>,
    fromCache,
  };
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
// path); the other three tickers link to their own dedicated gamma-levels pages
// so the four pages cross-link into a cluster.
function SymbolCard({
  symbol,
  data,
  isPrimary,
  status = 'ok',
}: {
  symbol: Symbol;
  data: GexSummary | null;
  isPrimary: boolean;
  /** Freshness of this ticker relative to the freshest of the three. */
  status?: 'ok' | 'stale' | 'missing';
}) {
  const regime = REGIME_DISPLAY[detectRegime(data?.gamma_flip, data?.spot_price)];
  const regimeColor = regime.color;
  const href = isPrimary ? `/gamma-exposure?symbol=${symbol}` : gammaPath(symbol);
  const ctaLabel = isPrimary ? `Live ${symbol} dashboard` : `${symbol} gamma levels`;
  return (
    <Link
      href={href}
      className="zg-panel hover:!border-[var(--color-brand-primary)]"
      style={{
        padding: '28px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
        transition: 'border-color 150ms, transform 150ms',
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
            {regime.icon === 'up' ? (
              <TrendingUp size={12} />
            ) : regime.icon === 'down' ? (
              <TrendingDown size={12} />
            ) : regime.icon === 'flat' ? (
              <Minus size={12} />
            ) : null}
            {regime.label}
          </span>
        </div>
        <p style={{ margin: '10px 0 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
          {regime.body}
        </p>
        {status !== 'ok' && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 10,
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--color-warning)',
              border: '1px solid var(--color-warning)55',
              background: 'var(--color-warning)14',
            }}
          >
            <Clock size={11} />
            {symbol} data temporarily {status === 'missing' ? 'unavailable' : 'delayed'}
          </div>
        )}
      </header>

      <div>
        <LevelRow label="Reference spot (delayed)" value={fmtPrice(data?.spot_price)} hint="Approximate, snapshot ≥15 min ago" />
        <LevelRow label="Call wall" value={fmtPrice(data?.call_wall)} hint="Strike that tends to cap upside" />
        <LevelRow label="Put wall" value={fmtPrice(data?.put_wall)} hint="Strike that tends to floor downside" />
        <LevelRow label="Gamma flip" value={fmtPrice(data?.gamma_flip)} hint="Regime line — above = positive, below = negative" />
        <LevelRow label="Max pain" value={fmtPrice(data?.max_pain)} hint="Strike where the most contracts expire worthless" />
        <LevelRow label="Pin strike" value={fmtPrice(data?.pin_strike)} hint="Reachable 0DTE strike with the strongest modeled positive dealer-gamma stabilization into expiration — a modeled pinning level, not a target" />
        <LevelRow label="Net dealer GEX (at spot)" value={fmtNetGex(netGexAtSpotOrNull(data?.net_gex_at_spot))} hint="Modeled (call-positive/put-negative convention); actual dealer inventory isn't directly observable" />
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
  // Free-page data + the ~15-min-delayed chart snapshot for the page's symbol,
  // fetched in parallel. Both go through the same ISR-cached serverApiGet at
  // 900s (and the shared /api/gex/summary URL is deduped by the Next fetch
  // cache), so the added chart costs no extra latency on a warm cache.
  const [{ snapshots, fromCache }, chartSnapshot] = await Promise.all([
    loadSnapshots(),
    loadChartSnapshot(primary, '5min'),
  ]);
  const primaryData = snapshots[primary];
  const anyData = SYMBOLS.some((s) => snapshots[s] !== null);

  // Per-ticker freshness. `freshestMs` is the newest snapshot across the three;
  // any ticker more than STALE_THRESHOLD_MS behind it is flagged so its card and
  // its share line read "temporarily delayed" instead of being mixed in as
  // though it were captured at the same moment as the others. Relative to the
  // freshest snapshot (not the wall clock), so it's deterministic in ISR.
  const snapshotMs = (s: Symbol): number | null => {
    const t = snapshots[s]?.timestamp;
    if (!t) return null;
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : null;
  };
  const freshestMs = SYMBOLS.map(snapshotMs).reduce<number | null>(
    (max, ms) => (ms != null && (max == null || ms > max) ? ms : max),
    null,
  );
  const cardStatus = (s: Symbol): 'ok' | 'stale' | 'missing' => {
    if (snapshots[s] == null) return 'missing';
    // Served from the last-good cache because this cycle's fetch failed: render
    // the numbers but flag them "delayed" so a transient upstream blip never
    // reads as a live snapshot.
    if (fromCache.has(s)) return 'stale';
    const ms = snapshotMs(s);
    if (ms != null && freshestMs != null && freshestMs - ms > STALE_THRESHOLD_MS) return 'stale';
    return 'ok';
  };
  const staleSymbols = new Set<Symbol>(SYMBOLS.filter((s) => cardStatus(s) === 'stale'));

  // Daily copy/paste share snapshot — built here so it ships in the ISR HTML and
  // is passed to the interactive ShareBlock as a ready-to-post string. Stale
  // tickers are tagged in the snippet from the same freshness read as the cards.
  const shareSnippet = buildShareSnippet(snapshots, primary, staleSymbols);
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

  // Primary-symbol current reading — surfaced as an evergreen "Today's <ticker>
  // net GEX" answer block in the content zone below. Targets the "<ticker> net
  // gamma exposure current / today / value / zero-cross" query cluster with the
  // same delayed number already shown in the cards above (never a live claim).
  const primaryNetGex = netGexAtSpotOrNull(primaryData?.net_gex_at_spot);
  const primaryFlip = primaryData?.gamma_flip ?? null;
  const primarySpotPrice = primaryData?.spot_price ?? null;

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
      { '@type': 'Thing', name: `${SYMBOL_CHAIN[primary]} options` },
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
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: '/' },
          { name: content.h1, url: content.path },
        ]}
      />

      <LandingHeader />

      <main style={{ flex: 1, maxWidth: 1080, margin: '0 auto', padding: '120px 24px 80px', width: '100%' }}>
        {/* Marks the top of the paid-traffic funnel (renders nothing). */}
        <PaidFunnelAnalytics symbol={primary} />

        <header style={{ marginBottom: 36, textAlign: 'center' }}>
          <div
            className="zg-eyebrow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--color-brand-primary)',
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
              margin: '0 auto',
              maxWidth: 720,
            }}
          >
            {content.intro}
          </p>
        </header>

        {!anyData && (
          <div
            className="zg-panel"
            style={{
              padding: '24px',
              marginBottom: 24,
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

        {/* Free, ~15-min-delayed Gamma Chart for the page's symbol — price with
            the Gamma Flip, Call/Put Walls, Max Pain, and the dealer-gamma rail
            drawn inline. Rendered from a frozen server snapshot in delayed mode
            (zero client fetching), so it stays licensing-clean and static like
            the rest of the page, and sits right above Today's Read. */}
        {chartSnapshot && (
          <div style={{ marginBottom: 24 }}>
            <GammaTerminalChart snapshot={chartSnapshot} delayed />
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
                volIndex: volatilityIndexFor(primary),
                horizon: 'daily',
              })}
            />
            {cardStatus(primary) === 'stale' && (
              <p
                style={{
                  margin: '10px 2px 0',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--color-warning)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Clock size={12} />
                {primary} data is temporarily delayed — this read reflects the last available {primary} snapshot,
                not the current session.
              </p>
            )}
          </div>
        )}

        {/* Delayed-vs-live clarity strip (requirement #2): keep it unmistakable
            that these cards are the free, delayed preview and that the live
            read lives in the dashboard — placed directly against the levels so
            the distinction reads at a glance. */}
        <div
          className="zg-panel"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px 14px',
            marginBottom: 18,
            padding: '12px 16px',
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20,
            marginBottom: 40,
          }}
        >
          {order.map((symbol) => (
            <SymbolCard
              key={symbol}
              symbol={symbol}
              data={snapshots[symbol]}
              isPrimary={symbol === primary}
              status={cardStatus(symbol)}
            />
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

        {/* The auto-updating Pro counterpart: NinjaScript can make HTTP calls,
            so this one pulls the levels instead of asking for manual entry.
            The packaged one-click import only exists once a real NinjaTrader
            export has been dropped into assets/ninjatrader/ and copied in by
            `make ninjatrader-package` — which the deploy runs before the build,
            so this build-time check sees it. Absent, we offer the .cs alone
            rather than a download button that 404s. */}
        <PlotOnNinjaTrader
          hasPackage={existsSync(
            join(process.cwd(), 'public', 'ninjatrader', 'ZeroGexGammaLevels.zip'),
          )}
        />

        {/* "Today's <ticker> net GEX" — a plain-language answer for the
            "<ticker> net gamma exposure current / today / value / zero-cross"
            searches this page ranks for. Leads the evergreen content with the
            same delayed reading shown in the cards above, quotable as a
            featured snippet. Guarded on primaryData so an outage never renders a
            half-empty sentence. */}
        {primaryData && primaryNetGex != null && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px 0', letterSpacing: '-0.3px' }}>
              Today&apos;s {primary} net GEX
            </h2>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
              As of {fmtTimestampET(primaryData.timestamp)}, {primary} net gamma exposure at spot is{' '}
              <strong style={{ color: 'var(--color-text-primary)' }}>{fmtNetGex(primaryNetGex)}</strong> — a{' '}
              {primaryNetGex >= 0 ? 'positive' : 'negative'}-gamma regime.{' '}
              {primaryNetGex >= 0
                ? 'Dealers are modeled net long gamma above the flip, which tends to suppress volatility — tighter ranges, more pinning, and rallies that stall near the call wall.'
                : 'Dealers are modeled net short gamma below the flip, which tends to amplify volatility — wider ranges, extending breakouts, and trends that run.'}
              {primaryFlip != null && (
                <>
                  {' '}The zero-cross — the gamma flip, or zero-gamma level — sits at {fmtPrice(primaryFlip)}
                  {primarySpotPrice != null ? <>, with {primary} spot at {fmtPrice(primarySpotPrice)}</> : null}.
                </>
              )}
              {' '}This free reading is delayed roughly 15 minutes; for the live, session-long value, open the{' '}
              <Link href="/register" style={{ color: 'var(--color-brand-primary)' }}>ZeroGEX dashboard</Link>.
            </p>
          </section>
        )}

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
            <div className="zg-panel" style={{ padding: 22 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800 }}>Call wall</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                The strike where call-side dealer gamma piles up. Above a positive-gamma regime, price tends to
                stall here as dealers sell into rips to hedge. A break above is usually a tell that the regime
                itself is flipping.
              </p>
            </div>
            <div className="zg-panel" style={{ padding: 22 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800 }}>Put wall</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                The strike where put-side dealer gamma piles up — typically the strongest dealer-hedged support
                in a positive-gamma session. Failing below the put wall in negative gamma is one of the cleaner
                bear-trend setups in the playbook.
              </p>
            </div>
            <div className="zg-panel" style={{ padding: 22 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800 }}>Gamma flip</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                The level where the cumulative dealer-gamma curve crosses zero. Above the flip, dealers are net
                long gamma (vol-suppressing). Below it, net short gamma (vol-amplifying). The single most useful
                regime line on the dealer book.
              </p>
            </div>
            <div className="zg-panel" style={{ padding: 22 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800 }}>Max pain</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                The strike that maximizes the dollar value of options expiring worthless. Useful as an
                expiration-day magnet, but the real mechanism most days is the gamma pin around max pain, not
                writer-payout arithmetic.
              </p>
            </div>
            <div className="zg-panel" style={{ padding: 22 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800 }}>Net dealer GEX (at spot)</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                The cumulative dealer-gamma curve evaluated at the current price. Sign-consistent with the
                flip — positive means we&apos;re above it, negative means below. Magnitude says how deep into the
                regime we are.
              </p>
            </div>
            <div className="zg-panel" style={{ padding: 22 }}>
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
              className="zg-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 20,
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
                Every morning before the open we commit to a projected range, an expected-volatility
                call, and key gamma levels — hashed and immutable. Every afternoon we grade ourselves in public.
              </div>
            </Link>

            <Link
              href="/replay"
              className="zg-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 20,
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
                className="zg-panel"
                style={{ padding: 22 }}
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
