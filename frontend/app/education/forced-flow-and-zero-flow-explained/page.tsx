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

// The concept guide for /forced-flow. The help page is the panel-by-panel
// reference; this explains what forced flow and the zero-flow level are, why
// the same zero-flow price can be a magnet or a pivot depending on the slope
// through it, and where the model stops: every figure rests on an assumed
// dealer position, and the zero-flow level has no multi-session score yet.
export const metadata = articleMetadata('forced-flow-and-zero-flow-explained');

const articlePath = path.join(process.cwd(), 'content/articles/forced-flow-and-zero-flow-explained.md');

export default async function ForcedFlowAndZeroFlowExplainedPage() {
  const markdown = await loadLocalizedMarkdown(articlePath);

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 sm:py-12">
      <ArticleJsonLd slug="forced-flow-and-zero-flow-explained" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="zg-article-card">
        <ArticleMeta slug="forced-flow-and-zero-flow-explained" />
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <ArticleFaq slug="forced-flow-and-zero-flow-explained" />

      <RelatedArticles slug="forced-flow-and-zero-flow-explained" />

      <GexMethodologyNote />
      <LiveLevelsCTA intro="Forced Flow reads best against the gamma levels price is trading around." />
    </div>
  );
}
