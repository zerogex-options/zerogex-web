import { NextResponse } from "next/server";
import {
  NEWS_SOURCES,
  categorizeHeadline,
  dedupeHeadlines,
  normalizeTitleKey,
  scoreImportance,
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

// The ZeroGEX backend (FastAPI) exposes the exact CNBC headline set the
// automated X post is built from at GET /api/news/headlines. We fold it into
// this same aggregator so the "Top Headlines" surface and the auto-tweet
// always agree on what's driving the tape. Honors the same env the rest of
// the server-side backend clients use (core/api/serverFetch.ts).
const BACKEND_BASE = (
  process.env.ZEROGEX_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const CNBC_SOURCE_ID = "cnbc";
const CNBC_SOURCE_NAME = "CNBC";

interface BackendHeadline {
  title: string;
  summary?: string | null;
  source?: string | null;
  link?: string | null;
  published?: string | null;
}
interface BackendNewsResponse {
  source: string;
  generated_at: string;
  count: number;
  headlines: BackendHeadline[];
}

// Pull the backend's X-desk CNBC headlines and normalize them into the same
// NewsHeadline shape the RSS path produces. Best-effort and self-bounded (a
// 6s abort, same budget as a single RSS feed): a slow/absent backend just
// means no CNBC this cycle, never a stalled or failed aggregate. importance +
// crossSourceCount are placeholders that refresh() fills once it can see the
// whole corpus.
async function fetchXDeskCnbcHeadlines(): Promise<NewsHeadline[]> {
  const token = process.env.ZEROGEX_API_TOKEN || process.env.ZEROGEX_API_KEY;
  if (!token) {
    console.warn("[api/news] CNBC backend skipped — ZEROGEX_API_TOKEN not set");
    return [];
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FEED_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BACKEND_BASE}/api/news/headlines`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[api/news] CNBC backend HTTP ${res.status}`);
      return [];
    }
    const json = (await res.json()) as BackendNewsResponse;
    const out: NewsHeadline[] = [];
    for (const h of json.headlines ?? []) {
      if (!h.title) continue;
      const publishedAtMs = h.published ? new Date(h.published).getTime() : NaN;
      if (!Number.isFinite(publishedAtMs)) continue;
      const summary = (h.summary || "").trim();
      out.push({
        id: h.link || `${CNBC_SOURCE_ID}:${h.title}`,
        title: h.title,
        url: h.link || "",
        source: h.source || CNBC_SOURCE_NAME,
        sourceId: CNBC_SOURCE_ID,
        // CNBC titles are terse; fold the dek in so categorization sees the
        // real subject ("Stocks slip" → "...as CPI runs hot" → macro).
        category: categorizeHeadline(
          summary ? `${h.title} ${summary}` : h.title,
          "markets",
        ),
        publishedAtMs,
        importance: 0,
        crossSourceCount: 1,
        summary: summary || undefined,
      });
    }
    return out;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[api/news] CNBC backend fetch failed — ${message}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

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
      // importance + crossSourceCount get filled in by refresh() once we
      // can see the full corpus across feeds. Defaults here are safe.
      out.push({
        id: it.guid || it.link || `${source.id}:${it.title}`,
        title: it.title,
        url: it.link || "",
        source: source.name,
        sourceId: source.id,
        category: categorizeHeadline(it.title, source.defaultCategory),
        publishedAtMs: it.pubDateMs,
        importance: 0,
        crossSourceCount: 1,
        summary: it.description || undefined,
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
  // RSS feeds and the backend's X-desk CNBC feed fetch concurrently; the
  // whole batch shares one wall-clock budget (each call self-aborts at
  // FEED_FETCH_TIMEOUT_MS) so one slow upstream can't drag out the refresh.
  const [rssResults, cnbcHeadlines] = await Promise.all([
    Promise.all(NEWS_SOURCES.map(fetchOne)),
    fetchXDeskCnbcHeadlines(),
  ]);
  const merged = [...rssResults.flat(), ...cnbcHeadlines];

  // Cross-source count must be computed BEFORE dedupe — once dedupe drops
  // the duplicates, the survivor wouldn't know how many wires carried it.
  const sourcesByTitle = new Map<string, Set<string>>();
  for (const h of merged) {
    const key = normalizeTitleKey(h.title);
    if (!key) continue;
    let set = sourcesByTitle.get(key);
    if (!set) {
      set = new Set();
      sourcesByTitle.set(key, set);
    }
    set.add(h.sourceId);
  }

  merged.sort((a, b) => b.publishedAtMs - a.publishedAtMs);
  const deduped = dedupeHeadlines(merged);

  const enriched = deduped.map((h) => {
    const key = normalizeTitleKey(h.title);
    const crossSourceCount = sourcesByTitle.get(key)?.size ?? 1;
    return {
      ...h,
      crossSourceCount,
      importance: scoreImportance(h.title, h.sourceId, crossSourceCount, h.summary),
    };
  });

  return { headlines: enriched.slice(0, MAX_TOTAL_ITEMS), generatedAt: Date.now() };
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
