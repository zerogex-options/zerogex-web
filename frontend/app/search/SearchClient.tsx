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
  { title: 'ZeroGEX — Real-Time Options Analytics', href: '/', kind: 'Home', blurb: 'Real-time gamma exposure, dealer positioning, gamma walls, and live options flow for SPX/0DTE traders.' },
  { title: 'SPX Gamma Levels Today: Gamma Flip, Call Wall, Put Wall & Net GEX', href: '/spx-gamma-levels', kind: 'Live levels', blurb: 'Free daily SPX gamma levels — the gamma flip, call wall, put wall, max pain, and net dealer GEX. Delayed 15 minutes, no signup.' },
  { title: 'SPY Gamma Levels Today: Gamma Flip, Call Wall, Put Wall & Net GEX', href: '/spy-gamma-levels', kind: 'Live levels', blurb: 'Free daily SPY gamma levels — the gamma flip, call wall, put wall, max pain, and net dealer GEX. Delayed 15 minutes, no signup.' },
  { title: 'QQQ Gamma Levels Today: Gamma Flip, Call Wall, Put Wall & Net GEX', href: '/qqq-gamma-levels', kind: 'Live levels', blurb: 'Free daily QQQ gamma levels — the gamma flip, call wall, put wall, max pain, and net dealer GEX. Delayed 15 minutes, no signup.' },
  { title: 'Real-Time GEX for 0DTE', href: '/real-time-gex-0dte', kind: 'Tool', blurb: 'Live gamma flip, call and put walls, dealer positioning, and composite signals built for SPX/0DTE intraday flow.' },
  { title: 'Pricing', href: '/pricing', kind: 'Page', blurb: 'ZeroGEX plans and pricing — free delayed levels plus real-time dashboard tiers.' },
  { title: 'Options Gamma Education Hub', href: '/education', kind: 'Hub', blurb: 'Plain-English explainers on GEX, the gamma flip, call walls, put walls, and 0DTE dealer positioning.' },
  { title: 'Options Gamma Trading Articles', href: '/articles', kind: 'Hub', blurb: 'Flow-focused breakdowns of options market structure for SPX, SPY, and QQQ traders.' },
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
          Start typing to search across explainers, live SPX / SPY / QQQ gamma levels, and tools.
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
