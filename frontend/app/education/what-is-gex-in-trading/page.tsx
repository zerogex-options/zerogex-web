import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import ArticleMeta from '@/components/ArticleMeta';
import ArticleFaq from '@/components/ArticleFaq';
import RelatedArticles from '@/components/RelatedArticles';
import GexMethodologyNote from '@/components/GexMethodologyNote';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import { articleMetadata } from '@/core/articleRegistry';
import { loadLocalizedMarkdown } from '@/core/localizedContent';

export const metadata = articleMetadata('what-is-gex-in-trading');

const articlePath = path.join(process.cwd(), 'content/articles/what-is-gex-in-trading.md');

export default async function GexInTradingPage() {
  const markdown = await loadLocalizedMarkdown(articlePath);

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 sm:py-12">
      <ArticleJsonLd slug="what-is-gex-in-trading" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="zg-article-card">
        <ArticleMeta slug="what-is-gex-in-trading" />
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <ArticleFaq slug="what-is-gex-in-trading" />

      <RelatedArticles slug="what-is-gex-in-trading" />

      <GexMethodologyNote />
      <LiveLevelsCTA concept="gamma exposure" />
    </div>
  );
}
