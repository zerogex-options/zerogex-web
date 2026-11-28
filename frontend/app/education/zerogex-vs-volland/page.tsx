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
import { loadLocalizedMarkdownWithLocale } from '@/core/localizedContent';

// A head-to-head with Volland, the dealer-positioning platform that builds its
// book trade by trade and argues openly against open-interest GEX, which is
// ZeroGEX's method. The page answers that argument on the merits: both
// approaches are described in their own words, and ZeroGEX's limits are the
// ones its methodology page already publishes. Every claim about Volland comes
// from vol.land (pricing, help center, API page, terms) and is dated; every
// price is a token, so ours match the pricing page and Volland's are edited in
// one place (core/comparisonPrices.ts). tests/comparisonPrices.test.ts fails
// if a price change makes one of the page's price comparisons untrue.
export const metadata = articleMetadata('zerogex-vs-volland');

const articlePath = path.join(process.cwd(), 'content/articles/zerogex-vs-volland.md');

export default async function ZeroGexVsVollandPage() {
  const { markdown: source, locale } = await loadLocalizedMarkdownWithLocale(articlePath);
  const markdown = fillComparisonPrices(source, locale);

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 sm:py-12">
      <ArticleJsonLd slug="zerogex-vs-volland" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="zg-article-card">
        <ArticleMeta slug="zerogex-vs-volland" />
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <ArticleFaq slug="zerogex-vs-volland" />

      <RelatedArticles slug="zerogex-vs-volland" />

      <LiveLevelsCTA
        headline="See the levels before you decide"
        intro="The quickest comparison is a look: the free pages show the same gamma flip and walls the paid plans do, about 15 minutes behind, with no signup."
      />
    </div>
  );
}
