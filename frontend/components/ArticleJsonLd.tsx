import { articleOgImage, getArticle, SITE_NAME, SITE_URL, SITE_DEFAULT_OG_IMAGE, type ArticleMeta } from '@/core/articleRegistry';
import BreadcrumbJsonLd, { type Crumb } from '@/components/BreadcrumbJsonLd';

type Props = {
  slug: string;
};

// Human-readable labels for the intermediate URL segments an article can sit
// under. Anything not listed falls back to the raw segment, so a new hub path
// still produces a sensible (if unstyled) crumb.
const SECTION_LABELS: Record<string, string> = {
  education: 'Education',
  guides: 'Guides',
};

// Builds the breadcrumb trail (Home › Section › Title) from an article's own
// href, so the JSON-LD hierarchy always matches the canonical URL path.
function articleCrumbs(article: ArticleMeta): Crumb[] {
  const segments = article.href.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ name: 'Home', url: '/' }];
  let acc = '';
  segments.forEach((seg, idx) => {
    acc += `/${seg}`;
    const isLast = idx === segments.length - 1;
    crumbs.push({ name: isLast ? article.title : (SECTION_LABELS[seg] ?? seg), url: acc });
  });
  return crumbs;
}

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
    <>
      <script
        type="application/ld+json"
        // The payload is built from a typed object with no user input —
        // dangerouslySetInnerHTML is correct here and standard for JSON-LD.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <BreadcrumbJsonLd items={articleCrumbs(article)} />
    </>
  );
}
