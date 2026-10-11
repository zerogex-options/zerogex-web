import fs from 'node:fs';
import path from 'node:path';
import {
  articleOgImage,
  getArticle,
  FOUNDER_ID,
  PERSON_FOUNDER,
  PUBLISHER_REF,
  SITE_URL,
  WEBSITE_ID,
  type ArticleMeta,
} from '@/core/articleRegistry';
import BreadcrumbJsonLd, { type Crumb } from '@/components/BreadcrumbJsonLd';

// Word count of the English source, which is the copy a crawler is served (the
// translations are cookie-selected at the same URL and crawlers carry no
// cookie). Read from disk at render rather than threaded through 42 page files;
// a missing file just omits the property.
function englishWordCount(article: ArticleMeta): number | undefined {
  const match = /^\/education\/([a-z0-9-]+)$/.exec(article.href);
  if (!match) return undefined;
  try {
    const md = fs.readFileSync(path.join(process.cwd(), 'content/articles', `${match[1]}.md`), 'utf8');
    return md.split(/\s+/).filter(Boolean).length;
  } catch {
    return undefined;
  }
}

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

  const wordCount = englishWordCount(article);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: article.title,
    description: article.description,
    image: [image],
    datePublished: `${article.datePublished}T16:00:00.000Z`,
    dateModified: `${article.dateModified ?? article.datePublished}T16:00:00.000Z`,
    // The founder, by @id (SiteJsonLd emits the full Person node on every
    // page), with name and url inline so a validator reading this block alone
    // still sees a complete author. ArticleMeta prints the same byline.
    author: {
      '@type': 'Person',
      '@id': FOUNDER_ID,
      name: PERSON_FOUNDER.name,
      url: FOUNDER_ID,
    },
    publisher: PUBLISHER_REF,
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    ...(wordCount ? { wordCount } : {}),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
      isPartOf: { '@id': WEBSITE_ID },
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
