// News headlines: source list, category heuristic, palette, and formatting
// helpers. All data is consumed by /api/news (server-side) and the
// NewsHeadlinesBadge (client). Mirrors the optionsCalendar.ts split.

export type NewsCategory = "central-banks" | "macro" | "geopolitics" | "markets";

export interface NewsHeadline {
  id: string;
  title: string;
  url: string;
  source: string;
  category: NewsCategory;
  publishedAtMs: number;
}

export interface NewsSource {
  id: string;
  name: string;
  rssUrl: string;
  defaultCategory: NewsCategory;
}

// Curated set of credible, publicly accessible RSS feeds. One feed failing
// to load doesn't kill the response — the aggregator just skips it.
export const NEWS_SOURCES: readonly NewsSource[] = [
  // Central banks — direct from the institutions themselves.
  {
    id: "fed",
    name: "Federal Reserve",
    rssUrl: "https://www.federalreserve.gov/feeds/press_all.xml",
    defaultCategory: "central-banks",
  },
  {
    id: "ecb",
    name: "ECB",
    rssUrl: "https://www.ecb.europa.eu/rss/press.html",
    defaultCategory: "central-banks",
  },
  {
    id: "treasury",
    name: "US Treasury",
    rssUrl: "https://home.treasury.gov/news/press-releases/feed",
    defaultCategory: "macro",
  },
  // Markets — established financial press.
  {
    id: "cnbc-markets",
    name: "CNBC Markets",
    rssUrl: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069",
    defaultCategory: "markets",
  },
  {
    id: "cnbc-economy",
    name: "CNBC Economy",
    rssUrl: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258",
    defaultCategory: "macro",
  },
  {
    id: "marketwatch",
    name: "MarketWatch",
    rssUrl: "http://feeds.marketwatch.com/marketwatch/topstories/",
    defaultCategory: "markets",
  },
  // Geopolitics / world — major international wires.
  {
    id: "bbc-world",
    name: "BBC World",
    rssUrl: "https://feeds.bbci.co.uk/news/world/rss.xml",
    defaultCategory: "geopolitics",
  },
  {
    id: "bbc-business",
    name: "BBC Business",
    rssUrl: "https://feeds.bbci.co.uk/news/business/rss.xml",
    defaultCategory: "markets",
  },
];

// Category inference. Source-default is the fallback when no keyword matches;
// patterns are ordered so the more specific category (central banks) gets
// first pick over the more general ones (markets).
const KEYWORD_CATEGORIES: Array<{ category: NewsCategory; patterns: RegExp[] }> = [
  {
    category: "central-banks",
    patterns: [
      /\b(fed|fomc|federal reserve|powell|ecb|lagarde|boj|bank of japan|ueda|pboc|people'?s bank|boe|bank of england|bailey|snb|riksbank|interest rate|rate (?:cut|hike|decision|path)|quantitative (?:easing|tightening)|qe|qt)\b/i,
    ],
  },
  {
    category: "geopolitics",
    patterns: [
      /\b(war|ceasefire|sanctions?|election|tariffs?|trump|biden|putin|xi (?:jinping)?|nato|un security|israel|hamas|iran|ukraine|russia|china|taiwan|north korea|middle east|gaza|saudi|opec|coup|invasion|military strike|hostage)\b/i,
    ],
  },
  {
    category: "macro",
    patterns: [
      /\b(cpi|ppi|inflation|gdp|payrolls?|nonfarm|unemployment|jobless|housing starts|retail sales|pmi|ism|consumer (?:price|spending|confidence|sentiment)|recession|stagflation|economy|economic growth|industrial production|durable goods)\b/i,
    ],
  },
  {
    category: "markets",
    patterns: [
      /\b(stocks?|equities|s&p|s & p|nasdaq|dow|dax|nikkei|hang seng|ftse|treasury|treasuries|yields?|bonds?|oil|crude|brent|gold|silver|copper|bitcoin|crypto|ether|dollar|usd|eur|yen|yuan|earnings|ipo|merger|m&a)\b/i,
    ],
  },
];

export function categorizeHeadline(title: string, fallback: NewsCategory): NewsCategory {
  for (const { category, patterns } of KEYWORD_CATEGORIES) {
    if (patterns.some((p) => p.test(title))) return category;
  }
  return fallback;
}

// Dedupe by id first, then by normalized title — different wires often carry
// the same story with slightly different titles, so we keep the first (i.e.
// newest, since the caller sorts before deduping).
export function dedupeHeadlines(items: readonly NewsHeadline[]): NewsHeadline[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const out: NewsHeadline[] = [];
  for (const item of items) {
    if (item.id && seenIds.has(item.id)) continue;
    const titleKey = item.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (titleKey && seenTitles.has(titleKey)) continue;
    if (item.id) seenIds.add(item.id);
    if (titleKey) seenTitles.add(titleKey);
    out.push(item);
  }
  return out;
}

export interface CategoryPalette {
  label: string;
  bg: string;
  fg: string;
  border: string;
}

export function categoryPalette(
  category: NewsCategory,
  c: { primary: string; accent: string; coral: string; bullish: string; muted: string },
): CategoryPalette {
  switch (category) {
    case "central-banks":
      return { label: "Central Banks", bg: `${c.primary}1f`, fg: c.primary, border: `${c.primary}66` };
    case "macro":
      return { label: "Macro", bg: `${c.bullish}1a`, fg: c.bullish, border: `${c.bullish}66` };
    case "geopolitics":
      return { label: "Geopolitics", bg: `${c.coral}1f`, fg: c.coral, border: `${c.coral}66` };
    case "markets":
      return { label: "Markets", bg: `${c.accent}1f`, fg: c.accent, border: `${c.accent}66` };
  }
}

export function formatRelativeTime(nowMs: number, ms: number): string {
  if (!Number.isFinite(ms)) return "";
  const diff = Math.max(0, nowMs - ms);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
