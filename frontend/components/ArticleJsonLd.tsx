import { articleOgImage, getArticle, SITE_NAME, SITE_URL, SITE_DEFAULT_OG_IMAGE } from '@/core/articleRegistry';

type Props = {
  slug: string;
};

/**
 * Renders a schema.org Article JSON-LD block for a registered article.
 * Returns null if the slug isn't in the registry — keeps the call sites
 * trivially safe to drop in without worrying about uncovered routes.
 *
 * Uses the per-route `opengraph-image` convention when one exists at
 * the matching path; otherwise falls back to the site default OG image.
 * Since the file convention auto-generates an /opengraph-image route,
 * pointing to that URL is enough — no need to detect existence.
 */
export default function ArticleJsonLd({ slug }: Props) {
  const article = getArticle(slug);
  if (!article) return null;

  const url = `${SITE_URL}${article.href}`;
  const image = articleOgImage(article);

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: [image],
    datePublished: `${article.datePublished}T16:00:00.000Z`,
    dateModified: `${article.dateModified ?? article.datePublished}T16:00:00.000Z`,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: SITE_DEFAULT_OG_IMAGE,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };

  return (
    <script
      type="application/ld+json"
      // The payload is built from a typed object with no user input —
      // dangerouslySetInnerHTML is correct here and standard for JSON-LD.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
