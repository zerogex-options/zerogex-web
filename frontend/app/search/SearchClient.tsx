'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon, ArrowRight } from 'lucide-react';
import { ARTICLE_REGISTRY } from '@/core/articleRegistry';

type Entry = { title: string; href: string; blurb: string; kind: string };

// Primary tool / landing pages that aren't in the article registry. Titles
// mirror each page's own <title>/H1 so results read consistently.
const PRIMARY_PAGES: Entry[] = [
  { title: 'ZeroGEX — Real-Time Gamma Exposure (GEX) & Options Analytics', href: '/', kind: 'Home', blurb: 'Real-time gamma exposure, dealer positioning, gamma walls, and live options flow for SPX/0DTE traders.' },
  { title: 'SPX Gamma Levels Today (Free): GEX, Gamma Flip, Call & Put Walls', href: '/spx-gamma-levels', kind: 'Live levels', blurb: 'Free daily SPX gamma levels — the gamma flip, call wall, put wall, max pain, and net dealer GEX. Delayed 15 minutes, no signup.' },
  { title: 'SPY Gamma Levels Today (Free): GEX, Gamma Flip, Call & Put Walls', href: '/spy-gamma-levels', kind: 'Live levels', blurb: 'Free daily SPY gamma levels — the gamma flip, call wall, put wall, max pain, and net dealer GEX. Delayed 15 minutes, no signup.' },
  { title: 'QQQ Gamma Levels Today (Free): GEX, Gamma Flip, Call & Put Walls', href: '/qqq-gamma-levels', kind: 'Live levels', blurb: 'Free daily QQQ gamma levels — the gamma flip, call wall, put wall, max pain, and net dealer GEX. Delayed 15 minutes, no signup.' },
  { title: 'NDX Gamma Levels Today (Free): GEX, Gamma Flip, Call & Put Walls', href: '/ndx-gamma-levels', kind: 'Live levels', blurb: 'Free daily NDX gamma levels — the gamma flip, call wall, put wall, max pain, and net dealer GEX. Delayed 15 minutes, no signup.' },
  { title: 'ES Gamma Levels Today (Free): GEX, Gamma Flip, Call & Put Walls', href: '/es-gamma-levels', kind: 'Live levels', blurb: 'Free daily ES gamma levels — the gamma flip, call wall, put wall, max pain, and net dealer GEX, derived from the SPX chain on the futures price axis. Delayed, no signup.' },
  { title: 'NQ Gamma Levels Today (Free): GEX, Gamma Flip, Call & Put Walls', href: '/nq-gamma-levels', kind: 'Live levels', blurb: 'Free daily NQ gamma levels — the gamma flip, call wall, put wall, max pain, and net dealer GEX, derived from the NDX chain on the futures price axis. Delayed, no signup.' },
  { title: 'Free Gamma Chart — SPY Dealer Positioning (15-min delayed)', href: '/chart', kind: 'Tool', blurb: 'A free, ~15-minute-delayed gamma chart: price with the gamma flip, call and put walls, max pain and the dealer-gamma structure rail drawn inline.' },
  { title: 'Real-Time 0DTE GEX Dashboard: SPX, SPY, QQQ & NDX Gamma Levels', href: '/real-time-gex-0dte', kind: 'Tool', blurb: 'Live gamma flip, call and put walls, dealer positioning, and composite signals built for SPX/0DTE intraday flow.' },
  { title: 'ZeroGEX Chart Integrations — TradingView, thinkorswim, NinjaTrader & Sierra Chart', href: '/integrations', kind: 'Hub', blurb: 'Every way to plot ZeroGEX gamma levels on your own charts — free manual-entry scripts for TradingView and thinkorswim, auto-updating Pro studies for NinjaTrader 8 and Sierra Chart.' },
  { title: 'ZeroGEX Daily Gamma Levels — Free TradingView Indicator', href: '/tradingview-indicator', kind: 'Indicator', blurb: 'Free TradingView script that plots the gamma flip, call wall, put wall, and max pain as horizontal lines on SPY, SPX, QQQ, NDX, ES or NQ — with optional cross-alerts.' },
  { title: 'ZeroGEX Daily Gamma Levels — Free thinkorswim Study', href: '/thinkorswim-indicator', kind: 'Indicator', blurb: 'Free thinkScript study that plots the gamma flip, call wall, put wall, and max pain on thinkorswim desktop, web, and mobile — with optional cross-alerts.' },
  { title: 'ZeroGEX Gamma Levels — Auto-Updating NinjaTrader 8 Indicator', href: '/ninjatrader-indicator', kind: 'Indicator', blurb: 'NinjaTrader 8 indicator that draws the gamma flip, call wall, put wall, max pain, and pin strike and keeps them current by polling the ZeroGEX API. Needs a Pro API key.' },
  { title: 'ZeroGEX Gamma Levels — Auto-Updating Sierra Chart Study', href: '/sierra-chart-indicator', kind: 'Indicator', blurb: 'Sierra Chart ACSIL study that draws the gamma flip, call wall, put wall, max pain, and pin strike and keeps them current by polling the ZeroGEX API. Needs a Pro API key.' },
  { title: 'ZeroGEX Pricing: Basic & Pro Plans, 7-Day Free Trial', href: '/pricing', kind: 'Page', blurb: 'ZeroGEX plans and pricing — free delayed levels plus real-time dashboard tiers.' },
  { title: 'Gamma Exposure Education: GEX, Gamma Flip, Walls & 0DTE', href: '/education', kind: 'Hub', blurb: 'Plain-English explainers on GEX, the gamma flip, call walls, put walls, and 0DTE dealer positioning.' },
  { title: 'Options Gamma Trading Articles', href: '/articles', kind: 'Hub', blurb: 'Flow-focused breakdowns of options market structure for SPX, SPY, QQQ, and NDX traders.' },
  { title: 'About ZeroGEX', href: '/about', kind: 'Page', blurb: 'The open options analytics platform — what ZeroGEX is and how it is built.' },
];

// Full search index: primary pages + every registered education article.
const INDEX: Entry[] = [
  ...PRIMARY_PAGES,
  ...Object.values(ARTICLE_REGISTRY).map((a) => ({
    title: a.title,
    href: a.href,
    blurb: a.blurb,
    kind: 'Article',
  })),
];

function search(query: string): Entry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const scored = INDEX
    .map((e) => {
      const title = e.title.toLowerCase();
      const hay = `${title} ${e.blurb.toLowerCase()}`;
      // Every term must appear somewhere; rank by title hits + prefix bonus.
      if (!terms.every((t) => hay.includes(t))) return null;
      let s = 0;
      for (const t of terms) if (title.includes(t)) s += 10;
      if (title.startsWith(terms[0])) s += 5;
      return { e, s };
    })
    .filter((x): x is { e: Entry; s: number } => x !== null)
    .sort((a, b) => b.s - a.s);
  return scored.map((x) => x.e);
}

export default function SearchClient() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const results = useMemo(() => search(query), [query]);
  const trimmed = query.trim();

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-[var(--color-text-primary)]">Search</h1>
      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
        Search ZeroGEX education, live gamma levels, and tools.
      </p>

      <div className="relative mb-8">
        <SearchIcon
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
        />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try “put wall”, “gamma flip”, “0DTE”…"
          aria-label="Search ZeroGEX"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--bg-card)] py-3 pl-11 pr-4 text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-warning-soft)]"
        />
      </div>

      {trimmed === '' ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Start typing to search across explainers, live SPX / SPY / QQQ / NDX gamma levels, and tools.
        </p>
      ) : results.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          No matches for “{trimmed}”. Try a broader term like “gamma”, “put wall”, or “GEX”, or browse the{' '}
          <Link href="/education" className="font-semibold text-[var(--color-warning)] hover:underline">
            Education Hub
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
            {results.length} result{results.length === 1 ? '' : 's'}
          </div>
          <div className="flex flex-col gap-3">
            {results.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="zg-feature-shell group flex flex-col p-5 transition hover:border-[var(--color-warning-soft)]"
              >
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
                  {r.kind}
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{r.title}</h2>
                  <ArrowRight
                    size={15}
                    className="shrink-0 text-[var(--color-warning)] opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </div>
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{r.blurb}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
