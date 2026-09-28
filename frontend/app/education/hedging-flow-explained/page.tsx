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

// The reading guide for /hedging-flow. The help page is the reference for what
// each control does; this is how to read the numbers together, and where they
// stop: every figure on the page is an estimate resting on the assumption that
// a market maker took the passive side, and the article says so before it
// explains anything else. The worked example is one real session read off the
// page's own snapshot, so the claims can be checked against the picture.
export const metadata = articleMetadata('hedging-flow-explained');

const articlePath = path.join(process.cwd(), 'content/articles/hedging-flow-explained.md');

export default async function HedgingFlowExplainedPage() {
  const markdown = await loadLocalizedMarkdown(articlePath);

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 sm:py-12">
      <ArticleJsonLd slug="hedging-flow-explained" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="zg-article-card">
        <ArticleMeta slug="hedging-flow-explained" />
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <ArticleFaq slug="hedging-flow-explained" />

      <RelatedArticles slug="hedging-flow-explained" />

      <GexMethodologyNote />
      <LiveLevelsCTA intro="Hedging Flow reads best against the levels the tape is pushing into." />
    </div>
  );
}
