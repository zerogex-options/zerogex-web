import { SITE_URL } from '@/core/articleRegistry';

type Item = {
  /** Site-relative (or absolute) URL of the listed item. */
  href: string;
  /** Human-readable name — article title or section name. */
  name: string;
};

type Props = {
  items: Item[];
  /** Optional stable @id fragment so two lists on one page don't collide. */
  id?: string;
};

/**
 * Renders a schema.org ItemList of internal links, for hub / listing pages
 * (/articles, /education) that previously shipped no structured data. Lets
 * search engines read the page as a curated collection instead of a generic
 * page.
 *
 * The list MUST mirror the visible on-page links — Google discards structured
 * data that describes content a user can't see. Build both from the same
 * source array at the call site so they can't drift.
 */
export default function ItemListJsonLd({ items, id }: Props) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    ...(id ? { '@id': `${SITE_URL}${id}` } : {}),
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: item.href.startsWith('http') ? item.href : `${SITE_URL}${item.href}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      // Built from typed props with no user input — matches ArticleJsonLd.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
