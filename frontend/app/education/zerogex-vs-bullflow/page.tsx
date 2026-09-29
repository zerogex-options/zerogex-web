import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import ArticleMeta from '@/components/ArticleMeta';
import ArticleFaq from '@/components/ArticleFaq';
import RelatedArticles from '@/components/RelatedArticles';
import { articleMetadata } from '@/core/articleRegistry';
import { fillComparisonPrices } from '@/core/comparisonPrices';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import { loadLocalizedMarkdown } from '@/core/localizedContent';

// A head-to-head with Bullflow, for readers who search its name. Every claim
// about Bullflow comes from its public pricing page and is dated; every price
// on the page is a token filled by core/comparisonPrices.ts, so ours always
// match the pricing page and theirs are edited in exactly one place. The prose
// states how the two price lists compare, and tests/comparisonPrices.test.ts
// fails if a price change makes one of those sentences untrue.
export const metadata = articleMetadata('zerogex-vs-bullflow');

const articlePath = path.join(process.cwd(), 'content/articles/zerogex-vs-bullflow.md');

export default async function ZeroGexVsBullflowPage() {
  const markdown = fillComparisonPrices(await loadLocalizedMarkdown(articlePath));

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 sm:py-12">
      <ArticleJsonLd slug="zerogex-vs-bullflow" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="zg-article-card">
        <ArticleMeta slug="zerogex-vs-bullflow" />
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <ArticleFaq slug="zerogex-vs-bullflow" />

      <RelatedArticles slug="zerogex-vs-bullflow" />

      <LiveLevelsCTA
        headline="See the levels before you decide"
        intro="The quickest comparison is a look: the free pages show the same gamma flip and walls the paid plans do."
      />
    </div>
  );
}
