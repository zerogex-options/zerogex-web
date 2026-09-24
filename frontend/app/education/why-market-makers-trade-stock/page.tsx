import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import ArticleMeta from '@/components/ArticleMeta';
import RelatedArticles from '@/components/RelatedArticles';
import { articleMetadata } from '@/core/articleRegistry';
import GexMethodologyNote from '@/components/GexMethodologyNote';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import { loadLocalizedMarkdown } from '@/core/localizedContent';

export const metadata = articleMetadata('why-market-makers-trade-stock');

const articlePath = path.join(process.cwd(), 'content/articles/why-market-makers-trade-stock.md');

export default async function WhyMarketMakersTradeStockPage() {
  const markdown = await loadLocalizedMarkdown(articlePath);

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 sm:py-12">
      <ArticleJsonLd slug="why-market-makers-trade-stock" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="zg-article-card">
        <ArticleMeta slug="why-market-makers-trade-stock" />
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <RelatedArticles slug="why-market-makers-trade-stock" />

      <GexMethodologyNote />
      <LiveLevelsCTA
        headline="See today's dealer positioning and hedge pressure"
        intro="ZeroGEX recalculates dealer positioning and potential hedge pressure throughout the trading day as price, time, and implied volatility change."
      />
    </div>
  );
}
