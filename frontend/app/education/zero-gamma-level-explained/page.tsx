import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import ArticleMeta from '@/components/ArticleMeta';
import ArticleFaq from '@/components/ArticleFaq';
import RelatedArticles from '@/components/RelatedArticles';
import { articleMetadata } from '@/core/articleRegistry';
import GexMethodologyNote from '@/components/GexMethodologyNote';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import { loadLocalizedMarkdown } from '@/core/localizedContent';

// "zero gamma" / "zero gamma level" / "what is zero gamma in trading" is the
// one query cluster in Search Console that is both on-brand (the site is
// named for it) and already ranking around position 9 with no page written
// for it — the homepage and the gamma-flip explainer were catching it by
// accident. This is the dedicated answer; the flip explainer stays the
// how-to-read piece and the two cross-link.
export const metadata = articleMetadata('zero-gamma-level-explained');

const articlePath = path.join(process.cwd(), 'content/articles/zero-gamma-level-explained.md');

export default async function ZeroGammaLevelExplainedPage() {
  const markdown = await loadLocalizedMarkdown(articlePath);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <ArticleJsonLd slug="zero-gamma-level-explained" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-10 shadow-[0_20px_60px_var(--color-info-soft)] md:px-14">
        <ArticleMeta slug="zero-gamma-level-explained" />
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <ArticleFaq slug="zero-gamma-level-explained" />

      <RelatedArticles slug="zero-gamma-level-explained" />

      <GexMethodologyNote />
      <LiveLevelsCTA concept="zero gamma level" />
    </div>
  );
}
