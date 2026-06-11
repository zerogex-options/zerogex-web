/**
 * Central metadata for every education article + landing page that needs
 * SEO/structured-data treatment. Single source of truth for:
 *   - <ArticleJsonLd /> (schema.org Article structured data)
 *   - <RelatedArticles /> (the "Related reading" block on each post)
 *   - opengraph-image route handlers (per-page OG images)
 *
 * Dates match the publish dates surfaced on /articles. Keep this list in
 * sync when a new post lands; nothing breaks if a slug is missing, but
 * the JSON-LD will fall back to site defaults and the related block
 * won't render until the entry is added.
 */
export type ArticleKind = 'pillar' | 'tier1' | 'tier2' | 'article' | 'landing';

export type ArticleMeta = {
  slug: string;
  href: string;
  title: string;
  blurb: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  readMinutes: number;
  kind: ArticleKind;
};

export const SITE_URL = 'https://zerogex.io';
export const SITE_NAME = 'ZeroGEX';
export const SITE_DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export const ARTICLE_REGISTRY: Record<string, ArticleMeta> = {
  'decoding-gamma-exposure': {
    slug: 'decoding-gamma-exposure',
    href: '/education/decoding-gamma-exposure',
    title: 'Decoding Gamma Exposure — The Hidden Force Driving Markets',
    blurb:
      'How dealer hedging flows can stabilize or destabilize price action, why the gamma flip matters, and how to adapt strategy across volatility regimes.',
    description:
      'Learn how dealer hedging flows can stabilize or destabilize price action, why the gamma flip matters, and how to adapt strategy selection across volatility regimes.',
    datePublished: '2026-03-26',
    readMinutes: 15,
    kind: 'article',
  },
  'net-volume-vs-directional-flow': {
    slug: 'net-volume-vs-directional-flow',
    href: '/education/net-volume-vs-directional-flow',
    title: 'Net Volume vs Directional Flow: What Matters in Options Tape?',
    blurb:
      'Why raw contract counts can mislead, when directional volume adds signal, and why premium-weighted flow is often the strongest conviction metric on pro desks.',
    description:
      'Net volume vs directional flow explained — why raw contract counts can mislead, when directional volume adds signal, and why premium-weighted flow leads.',
    datePublished: '2026-04-16',
    readMinutes: 11,
    kind: 'article',
  },
  'eod-pressure-and-trap-detection': {
    slug: 'eod-pressure-and-trap-detection',
    href: '/education/eod-pressure-and-trap-detection',
    title: 'Trading the Close: EOD Pressure and Trap Detection',
    blurb:
      'A technical deep-dive on two ZeroGEX Advanced Signals — charm-driven end-of-day drift and the failed-breakout mechanics that snap price back when dealers absorb moves.',
    description:
      'How EOD Pressure and Trap Detection read dealer hedging in real time — charm-driven drift into the close and failed-breakout fades.',
    datePublished: '2026-05-12',
    readMinutes: 14,
    kind: 'article',
  },
  'squeeze-setup-positioning-trap-and-trap-detection': {
    slug: 'squeeze-setup-positioning-trap-and-trap-detection',
    href: '/education/squeeze-setup-positioning-trap-and-trap-detection',
    title: 'Squeeze Setup, Positioning Trap & Trap Detection',
    blurb:
      'Three ZeroGEX Advanced Signals that look almost identical — same number line, same pivots — but answer entirely different questions about the tape.',
    description:
      'Squeeze Setup, Positioning Trap, and Trap Detection — three ZeroGEX Advanced Signals with the same number line answering entirely different questions.',
    datePublished: '2026-05-13',
    readMinutes: 6,
    kind: 'article',
  },
  'how-to-read-a-gamma-flip': {
    slug: 'how-to-read-a-gamma-flip',
    href: '/education/how-to-read-a-gamma-flip',
    title: 'How to Read a Gamma Flip',
    blurb:
      'The practical intraday read on the gamma flip — what changes above versus below, how dealer hedging behavior shifts, and how to use it as a filter.',
    description:
      'How to read a gamma flip intraday — what the flip level is, what changes above vs below, and how dealer hedging behavior shifts. Gamma flip explained for SPX traders.',
    datePublished: '2026-06-11',
    readMinutes: 8,
    kind: 'tier1',
  },
  'gamma-walls-explained': {
    slug: 'gamma-walls-explained',
    href: '/education/gamma-walls-explained',
    title: 'Gamma Walls Explained: Call Wall, Put Wall, and How Price Reacts',
    blurb:
      'What gamma walls actually are, why price tends to react at the call wall and put wall, how the walls migrate, and when they hold versus break.',
    description:
      'Gamma walls explained — what call walls and put walls are, why price reacts at them, how they shift intraday, and when they hold versus break.',
    datePublished: '2026-06-11',
    readMinutes: 9,
    kind: 'tier1',
  },
  '0dte-dealer-positioning-explained': {
    slug: '0dte-dealer-positioning-explained',
    href: '/education/0dte-dealer-positioning-explained',
    title: '0DTE Dealer Positioning Explained',
    blurb:
      'Why same-day expiries dominate the intraday dealer book, how positive/negative gamma regimes change the tape for 0DTE, and how to read SPX 0DTE flow.',
    description:
      '0DTE dealer positioning explained — why dealer gamma matters most for same-day expiries, negative vs positive gamma regimes, and how to read SPX 0DTE flow.',
    datePublished: '2026-06-11',
    readMinutes: 9,
    kind: 'tier1',
  },
  'gamma-exposure-explained': {
    slug: 'gamma-exposure-explained',
    href: '/education/gamma-exposure-explained',
    title: 'Gamma Exposure (GEX) Explained: The Complete Guide',
    blurb:
      'The comprehensive read on gamma exposure — what GEX is, how dealer gamma is calculated, why regimes differ, and how the gamma flip and walls structure the tape.',
    description:
      'Gamma exposure explained from the ground up — what GEX is, how dealer gamma is calculated, what positive and negative regimes mean, and how to use it intraday.',
    datePublished: '2026-06-11',
    readMinutes: 16,
    kind: 'pillar',
  },
  'max-pain-explained': {
    slug: 'max-pain-explained',
    href: '/education/max-pain-explained',
    title: 'Max Pain Explained — and Does It Actually Work?',
    blurb:
      'The honest version of the max pain question — what it is, the theory, the evidence on whether it moves price, and why gamma is usually the real mechanism.',
    description:
      'Max pain explained honestly — what it is, the theory, and the evidence on whether it actually moves price. Does max pain work? A balanced read.',
    datePublished: '2026-06-11',
    readMinutes: 13,
    kind: 'tier2',
  },
  'vanna-and-charm-explained': {
    slug: 'vanna-and-charm-explained',
    href: '/education/vanna-and-charm-explained',
    title: 'Vanna and Charm Explained for Options Traders',
    blurb:
      'What vanna and charm are, why they drive dealer hedging flows, how vanna produces the vol-compression grind, and how charm shapes the into-close flow.',
    description:
      'Vanna and charm explained — what each Greek is, why they drive dealer hedging flows, how vanna creates the vol-compression grind, and how charm shapes the close.',
    datePublished: '2026-06-11',
    readMinutes: 14,
    kind: 'tier2',
  },
  'best-gex-tools': {
    slug: 'best-gex-tools',
    href: '/education/best-gex-tools',
    title: 'Best Gamma Exposure (GEX) Tools: A Fair Comparison',
    blurb:
      'A balanced comparison of GEX tools and gamma exposure trackers — real-time vs delayed, 0DTE coverage, methodology, signal quality, and price.',
    description:
      'Best GEX tools and gamma exposure trackers compared fairly — what matters in a GEX tool, real-time vs delayed, 0DTE coverage, methodology, signals, and price.',
    datePublished: '2026-06-11',
    readMinutes: 11,
    kind: 'article',
  },
  'real-time-gex-0dte': {
    slug: 'real-time-gex-0dte',
    href: '/real-time-gex-0dte',
    title: 'Real-Time GEX for 0DTE Traders',
    blurb:
      'Live gamma flip, call and put walls, dealer positioning, and composite signals — built for SPX/0DTE intraday flow. Free dashboard, no signup required.',
    description:
      'Real-time GEX for 0DTE traders. Live gamma flip, call and put walls, dealer positioning, and composite signals built for SPX/0DTE intraday flow. Free dashboard.',
    datePublished: '2026-06-11',
    readMinutes: 0,
    kind: 'landing',
  },
};

/**
 * Editorial mapping of slug → 3 related slugs. Manually curated for topical
 * coherence (the GEX pillar links to the tier-1 trio; max-pain links to
 * the pillar + gamma walls + flip; etc.). When a new article lands, add
 * an entry here and a few entries pointing to it.
 */
const RELATED_BY_SLUG: Record<string, string[]> = {
  'gamma-exposure-explained': [
    'how-to-read-a-gamma-flip',
    'gamma-walls-explained',
    '0dte-dealer-positioning-explained',
  ],
  'how-to-read-a-gamma-flip': [
    'gamma-exposure-explained',
    'gamma-walls-explained',
    '0dte-dealer-positioning-explained',
  ],
  'gamma-walls-explained': [
    'gamma-exposure-explained',
    'how-to-read-a-gamma-flip',
    '0dte-dealer-positioning-explained',
  ],
  '0dte-dealer-positioning-explained': [
    'gamma-exposure-explained',
    'how-to-read-a-gamma-flip',
    'vanna-and-charm-explained',
  ],
  'max-pain-explained': [
    'gamma-exposure-explained',
    'gamma-walls-explained',
    'how-to-read-a-gamma-flip',
  ],
  'vanna-and-charm-explained': [
    'gamma-exposure-explained',
    '0dte-dealer-positioning-explained',
    'how-to-read-a-gamma-flip',
  ],
  'best-gex-tools': [
    'gamma-exposure-explained',
    '0dte-dealer-positioning-explained',
    'how-to-read-a-gamma-flip',
  ],
  'decoding-gamma-exposure': [
    'gamma-exposure-explained',
    'how-to-read-a-gamma-flip',
    'gamma-walls-explained',
  ],
  'eod-pressure-and-trap-detection': [
    'squeeze-setup-positioning-trap-and-trap-detection',
    'vanna-and-charm-explained',
    'gamma-exposure-explained',
  ],
  'net-volume-vs-directional-flow': [
    'gamma-exposure-explained',
    'how-to-read-a-gamma-flip',
    '0dte-dealer-positioning-explained',
  ],
  'squeeze-setup-positioning-trap-and-trap-detection': [
    'eod-pressure-and-trap-detection',
    'gamma-exposure-explained',
    'how-to-read-a-gamma-flip',
  ],
};

export function getArticle(slug: string): ArticleMeta | null {
  return ARTICLE_REGISTRY[slug] ?? null;
}

export function getRelatedArticles(slug: string): ArticleMeta[] {
  const related = RELATED_BY_SLUG[slug];
  if (!related) return [];
  return related
    .map((s) => ARTICLE_REGISTRY[s])
    .filter((a): a is ArticleMeta => Boolean(a));
}
