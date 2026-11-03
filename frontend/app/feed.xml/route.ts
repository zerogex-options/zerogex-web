// https://zerogex.io/feed.xml: the education articles as RSS. Content and
// rationale live in core/rssFeed.ts; every page's <head> links here
// (app/layout.tsx) so feed readers and directories can find it.

import { ARTICLE_REGISTRY } from '@/core/articleRegistry';
import { buildRssFeed } from '@/core/rssFeed';

// Rendered per request like /llms.txt and /sitemap-dated.xml, with its own
// hour-long cache header. The feed reads only the registry, so a render costs
// nothing, and a deploy that adds an article is in the feed within the hour
// rather than behind a year-long static cache.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return new Response(buildRssFeed(Object.values(ARTICLE_REGISTRY)), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
