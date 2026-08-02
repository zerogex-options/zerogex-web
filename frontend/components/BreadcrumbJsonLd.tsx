import { SITE_URL } from '@/core/articleRegistry';

export type Crumb = { name: string; url: string };

/**
 * Renders a schema.org BreadcrumbList JSON-LD block.
 *
 * Breadcrumb rich results replace the raw URL under a result's title with a
 * "Home › Section › Page" trail. That both lifts CTR (a cleaner, more
 * navigable SERP snippet) and reinforces the site's hierarchy for crawlers and
 * answer engines. Emitted alongside a page's existing Article / WebPage / FAQ
 * nodes — it does not replace them.
 *
 * `items` is the ordered trail from the site root to the current page. Relative
 * urls (e.g. "/education/x") are resolved against SITE_URL; already-absolute
 * urls are passed through unchanged. The final item is the current page.
 */
export default function BreadcrumbJsonLd({ items }: { items: Crumb[] }) {
  if (!items.length) return null;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url.startsWith('http') ? c.url : `${SITE_URL}${c.url}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      // Payload is built from typed props with no user input —
      // dangerouslySetInnerHTML is correct here and matches ArticleJsonLd /
      // SiteJsonLd.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
