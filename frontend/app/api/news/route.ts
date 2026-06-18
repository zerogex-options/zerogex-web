import { NextResponse } from "next/server";
import {
  NEWS_SOURCES,
  categorizeHeadline,
  dedupeHeadlines,
  type NewsHeadline,
  type NewsSource,
} from "@/core/newsHeadlines";
import { parseRss } from "@/core/rss";

// Aggregator endpoint. Pulls RSS in parallel, normalizes into NewsHeadline
// objects, dedupes, sorts newest-first, and caches the result in module
// scope so subsequent requests don't re-hit upstream feeds for ~5 minutes.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CACHE_TTL_MS = 5 * 60 * 1000;
const FEED_FETCH_TIMEOUT_MS = 6_000;
const MAX_ITEMS_PER_FEED = 20;
const MAX_TOTAL_ITEMS = 30;

interface CacheEntry {
  headlines: NewsHeadline[];
  generatedAt: number;
}

// Module-scoped cache + single-flight gate so concurrent requests don't
// stampede the upstream feeds when the cache expires.
let cache: CacheEntry | null = null;
let inFlight: Promise<CacheEntry> | null = null;

async function fetchOne(source: NewsSource): Promise<NewsHeadline[]> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FEED_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(source.rssUrl, {
      headers: {
        "user-agent": "ZeroGEX-NewsBot/1.0 (+https://zerogex.io)",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      signal: ctl.signal,
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = parseRss(xml);
    const out: NewsHeadline[] = [];
    for (const it of items.slice(0, MAX_ITEMS_PER_FEED)) {
      if (!it.title) continue;
      if (!Number.isFinite(it.pubDateMs)) continue;
      out.push({
        id: it.guid || it.link || `${source.id}:${it.title}`,
        title: it.title,
        url: it.link || "",
        source: source.name,
        category: categorizeHeadline(it.title, source.defaultCategory),
        publishedAtMs: it.pubDateMs,
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function refresh(): Promise<CacheEntry> {
  const results = await Promise.all(NEWS_SOURCES.map(fetchOne));
  const merged = results.flat();
  merged.sort((a, b) => b.publishedAtMs - a.publishedAtMs);
  const headlines = dedupeHeadlines(merged).slice(0, MAX_TOTAL_ITEMS);
  return { headlines, generatedAt: Date.now() };
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.generatedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache, {
      headers: { "cache-control": "public, max-age=60, s-maxage=300" },
    });
  }
  if (!inFlight) {
    inFlight = refresh()
      .then((entry) => {
        cache = entry;
        return entry;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  try {
    const entry = await inFlight;
    return NextResponse.json(entry, {
      headers: { "cache-control": "public, max-age=60, s-maxage=300" },
    });
  } catch {
    // If every feed errored, fall back to the last good cache (even if stale)
    // so the UI keeps showing something rather than going blank.
    if (cache) return NextResponse.json(cache);
    return NextResponse.json(
      { headlines: [], generatedAt: Date.now() },
      { status: 503 },
    );
  }
}
