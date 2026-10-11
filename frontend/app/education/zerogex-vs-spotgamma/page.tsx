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

// A head-to-head with SpotGamma, the research-led vendor most searchers name
// first ("spotgamma alternative", "spotgamma free alternative"). Every claim
// about SpotGamma comes from its own site and checkout pages and is dated; its
// pricing grid contradicted its checkout forms when it was checked, so the
// prices are the forms' (see core/comparisonPrices.ts). Every price is a token,
// so ours always match the pricing page and theirs are edited in exactly one
// place. tests/comparisonPrices.test.ts fails if a price change makes one of
// the page's price comparisons untrue.
export const metadata = articleMetadata('zerogex-vs-spotgamma');

const articlePath = path.join(process.cwd(), 'content/articles/zerogex-vs-spotgamma.md');

export default async function ZeroGexVsSpotGammaPage() {
  const markdown = fillComparisonPrices(await loadLocalizedMarkdown(articlePath));

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 sm:py-12">
      <ArticleJsonLd slug="zerogex-vs-spotgamma" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="zg-article-card">
        <ArticleMeta slug="zerogex-vs-spotgamma" />
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <ArticleFaq slug="zerogex-vs-spotgamma" />

      <RelatedArticles slug="zerogex-vs-spotgamma" />

      <LiveLevelsCTA
        headline="See the levels before you decide"
        intro="The quickest comparison is a look: the free pages show the same gamma flip and walls the paid plans do, for all six symbols."
      />
    </div>
  );
}
