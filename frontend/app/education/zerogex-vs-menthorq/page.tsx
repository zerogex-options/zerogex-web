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

// A head-to-head with MenthorQ, the closest of the compared tools: the same
// kind of levels, delivered into charting platforms. Every claim about
// MenthorQ comes from its own pricing page and guides and is dated. Every price
// is a token filled by core/comparisonPrices.ts, so ours always match the
// pricing page and theirs are edited in exactly one place.
// tests/comparisonPrices.test.ts fails if a price change makes one of the
// page's price comparisons untrue.
export const metadata = articleMetadata('zerogex-vs-menthorq');

const articlePath = path.join(process.cwd(), 'content/articles/zerogex-vs-menthorq.md');

export default async function ZeroGexVsMenthorQPage() {
  const markdown = fillComparisonPrices(await loadLocalizedMarkdown(articlePath));

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 sm:py-12">
      <ArticleJsonLd slug="zerogex-vs-menthorq" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="zg-article-card">
        <ArticleMeta slug="zerogex-vs-menthorq" />
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <ArticleFaq slug="zerogex-vs-menthorq" />

      <RelatedArticles slug="zerogex-vs-menthorq" />

      <LiveLevelsCTA
        headline="See the levels before you decide"
        intro="The quickest comparison is a look: the free pages show the same gamma flip and walls the paid plans do."
      />
    </div>
  );
}
