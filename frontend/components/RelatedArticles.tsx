import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { getRelatedArticles } from '@/core/articleRegistry';

type Props = {
  slug: string;
};

/**
 * Renders an editorially-curated "Related reading" block at the end of an
 * article. Returns null when the slug has no related entries — safe to
 * drop in everywhere.
 *
 * Curation lives in core/articleRegistry.ts (RELATED_BY_SLUG). Pulls 2–3
 * related articles, styles them with the existing zg-feature-shell tile
 * pattern, and routes through Next Link.
 */
export default function RelatedArticles({ slug }: Props) {
  const related = getRelatedArticles(slug);
  if (related.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
          <BookOpen size={16} />
        </span>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Related reading</div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Keep going</h2>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((article) => (
          <Link
            key={article.slug}
            href={article.href}
            className="zg-feature-shell group flex h-full flex-col p-5 transition hover:border-[var(--color-warning-soft)]"
          >
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
              {labelFor(article.kind)}
              {article.readMinutes > 0 ? ` • ${article.readMinutes} min` : ''}
            </div>
            <h3 className="mb-2 text-base font-semibold leading-snug text-[var(--color-text-primary)]">
              {article.title}
            </h3>
            <p className="mb-4 flex-1 text-sm leading-6 text-[var(--color-text-secondary)]">
              {article.blurb}
            </p>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)] transition group-hover:text-[var(--heat-low)]">
              Read <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function labelFor(kind: string): string {
  switch (kind) {
    case 'pillar':
      return 'Pillar Guide';
    case 'tier1':
      return 'Practical Guide';
    case 'tier2':
      return 'Deep Dive';
    case 'landing':
      return 'Product';
    default:
      return 'Article';
  }
}
