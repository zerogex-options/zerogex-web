import Link from 'next/link';
import { getArticle } from '@/core/articleRegistry';

// Human-readable labels for the section an article sits under, matching the
// trail <ArticleJsonLd /> emits as BreadcrumbList so the visible crumbs and
// the structured data describe the same hierarchy.
const SECTION_LABELS: Record<string, string> = {
  education: 'Education',
  guides: 'Guides',
};

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T12:00:00Z`));
  } catch {
    return iso;
  }
}

/**
 * The line above every article's H1: a visible breadcrumb plus the read time
 * and the publish / last-updated dates, all read from core/articleRegistry.ts.
 *
 * Until now the article pages hard-coded "ZeroGEX Education • N min read" and
 * showed no date at all — the dates lived only in the JSON-LD and on the
 * /articles listing. Google decides what date (if any) to print next to a
 * snippet from the visible page first, and several of the queries these pages
 * rank for are explicitly about "today" / "current" / "2026"; an undated page
 * competes for those with one hand tied. Rendering the same dates the Article
 * structured data carries also keeps the two from drifting, which is one of
 * the things Google checks before trusting the markup. The breadcrumb mirrors
 * the BreadcrumbList trail for the same reason.
 */
export default function ArticleMeta({ slug }: { slug: string }) {
  const article = getArticle(slug);
  if (!article) return null;

  const segments = article.href.split('/').filter(Boolean);
  const section = segments.length > 1 ? segments[0] : null;
  const sectionLabel = section ? (SECTION_LABELS[section] ?? section) : null;
  const sectionHref = section === 'education' ? '/articles' : `/${section}`;
  const modified = article.dateModified && article.dateModified !== article.datePublished ? article.dateModified : null;
  const crumbClass = 'hover:text-[var(--color-warning)]';

  return (
    <div className="mb-8">
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-[var(--color-text-secondary)]">
        <Link href="/" className={crumbClass}>
          Home
        </Link>
        {sectionLabel ? (
          <>
            <span className="opacity-60">/</span>
            <Link href={sectionHref} className={crumbClass}>
              {sectionLabel}
            </Link>
          </>
        ) : null}
        <span className="opacity-60">/</span>
        <span className="text-[var(--color-text-primary)]">{article.title}</span>
      </nav>
      <div className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
        ZeroGEX Education
        {article.readMinutes > 0 ? ` • ${article.readMinutes} min read` : ''}
        {' • Published '}
        <time dateTime={article.datePublished}>{fmtDate(article.datePublished)}</time>
        {modified ? (
          <>
            {' • Updated '}
            <time dateTime={modified}>{fmtDate(modified)}</time>
          </>
        ) : null}
      </div>
    </div>
  );
}
