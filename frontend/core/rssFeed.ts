// The RSS feed of the education articles: https://zerogex.io/feed.xml
//
// WHY. The site had no feed, so a reader could not follow new articles in
// Feedly or Inoreader, blog directories that list sites by their feed had
// nothing to list, and a new article reached social only when someone posted
// it by hand (Zapier and IFTTT both start from a feed). Search Console and Bing
// Webmaster Tools also accept a feed as an extra sitemap.
//
// WHAT. One item per /education article, the same set the /articles listing
// shows, newest first. Each item carries the listing blurb, not the article:
// a summary sends the reader to the page, and a full-text feed is the easiest
// thing on the site to republish wholesale.
//
// DATES. pubDate is the publication date, never the update date: feed readers
// treat a changed pubDate as a new post, and an article's copy pass should not
// re-announce it. lastBuildDate is the newest publish-or-update date in the
// feed, not the clock, so the file only changes when an article does.
//
// Pure module, no '@/' imports: the route passes the registry in, and
// tests/rssFeed.test.ts can load this directly.

export const FEED_PATH = '/feed.xml';
export const FEED_TITLE = 'ZeroGEX Education';

const SITE_URL = 'https://zerogex.io';
const FEED_DESCRIPTION =
  'New explainers and studies on gamma exposure (GEX), dealer positioning, the gamma flip, call and put walls, and 0DTE options flow, from ZeroGEX.';
// The byline every article prints (components/ArticleMeta, PERSON_FOUNDER).
const AUTHOR = 'Michael';

/** The registry fields the feed reads (a structural subset of ArticleMeta). */
export type FeedArticle = {
  slug: string;
  href: string;
  title: string;
  blurb: string;
  datePublished: string;
  dateModified?: string;
  kind: string;
};

/** Same rule as the /articles listing: education articles, not the landings. */
export function isFeedArticle(a: FeedArticle): boolean {
  return a.href.startsWith('/education/') && a.kind !== 'landing';
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** RSS dates are RFC 822; the registry's are ISO days, which the site stamps 16:00 UTC. */
export function rfc822(isoDay: string): string {
  return new Date(`${isoDay}T16:00:00Z`).toUTCString();
}

export function buildRssFeed(registry: FeedArticle[]): string {
  const articles = registry
    .filter(isFeedArticle)
    .sort((x, y) => y.datePublished.localeCompare(x.datePublished) || x.title.localeCompare(y.title));

  const newest = articles
    .map((a) => (a.dateModified && a.dateModified > a.datePublished ? a.dateModified : a.datePublished))
    .sort()
    .at(-1);

  const items = articles
    .map((a) => {
      const url = `${SITE_URL}${a.href}`;
      return [
        '    <item>',
        `      <title>${xmlEscape(a.title)}</title>`,
        `      <link>${xmlEscape(url)}</link>`,
        `      <guid isPermaLink="true">${xmlEscape(url)}</guid>`,
        `      <pubDate>${rfc822(a.datePublished)}</pubDate>`,
        `      <dc:creator>${AUTHOR}</dc:creator>`,
        `      <description>${xmlEscape(a.blurb)}</description>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${FEED_TITLE}</title>
    <link>${SITE_URL}/articles</link>
    <description>${xmlEscape(FEED_DESCRIPTION)}</description>
    <language>en-us</language>
${newest ? `    <lastBuildDate>${rfc822(newest)}</lastBuildDate>\n` : ''}    <atom:link href="${SITE_URL}${FEED_PATH}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}
