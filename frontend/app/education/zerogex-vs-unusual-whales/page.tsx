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

// A head-to-head with Unusual Whales, the largest retail options-flow platform,
// on the one thing the two share: gamma exposure. Unusual Whales ranks its own
// GEX methods and puts open interest, ZeroGEX's method, last; the page states
// that ranking in its words and answers it with what ZeroGEX's methodology
// already publishes, including that participant-classified data like the Cboe
// set behind its SPX True GEX supports a richer reconstruction. Every claim
// about Unusual Whales comes from its pricing page, its GEX help article and
// its API documentation, and is dated; every price is a token
// (core/comparisonPrices.ts), and tests/comparisonPrices.test.ts fails if a
// price change makes one of the page's price comparisons untrue.
export const metadata = articleMetadata('zerogex-vs-unusual-whales');

const articlePath = path.join(process.cwd(), 'content/articles/zerogex-vs-unusual-whales.md');

export default async function ZeroGexVsUnusualWhalesPage() {
  const { markdown: source, locale } = await loadLocalizedMarkdownWithLocale(articlePath);
  const markdown = fillComparisonPrices(source, locale);

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 sm:py-12">
      <ArticleJsonLd slug="zerogex-vs-unusual-whales" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="zg-article-card">
        <ArticleMeta slug="zerogex-vs-unusual-whales" />
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <ArticleFaq slug="zerogex-vs-unusual-whales" />

      <RelatedArticles slug="zerogex-vs-unusual-whales" />

      <LiveLevelsCTA
        headline="See the levels before you decide"
        intro="The quickest comparison is a look: the free pages show the same gamma flip and walls the paid plans do, about 15 minutes behind, with no signup."
      />
    </div>
  );
}
