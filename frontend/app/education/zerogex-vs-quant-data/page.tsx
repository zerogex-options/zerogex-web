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

// A head-to-head with Quant Data, for readers who search its name or its
// Interval Map. Every claim about Quant Data comes from its own site, help
// center or app listings and is dated. Every price is a token filled by
// core/comparisonPrices.ts, which holds Quant Data's API plan only: its
// platform price has not been read first-hand, so the page names it nowhere.
// tests/comparisonPrices.test.ts fails if a price change makes the page's one
// price comparison untrue.
export const metadata = articleMetadata('zerogex-vs-quant-data');

const articlePath = path.join(process.cwd(), 'content/articles/zerogex-vs-quant-data.md');

export default async function ZeroGexVsQuantDataPage() {
  const markdown = fillComparisonPrices(await loadLocalizedMarkdown(articlePath));

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 sm:py-12">
      <ArticleJsonLd slug="zerogex-vs-quant-data" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="zg-article-card">
        <ArticleMeta slug="zerogex-vs-quant-data" />
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <ArticleFaq slug="zerogex-vs-quant-data" />

      <RelatedArticles slug="zerogex-vs-quant-data" />

      <LiveLevelsCTA
        headline="See the levels before you decide"
        intro="The quickest comparison is a look: the free pages show the same gamma flip and walls the paid plans do."
      />
    </div>
  );
}
