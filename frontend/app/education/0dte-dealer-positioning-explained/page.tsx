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

export const metadata = articleMetadata('0dte-dealer-positioning-explained');

const articlePath = path.join(process.cwd(), 'content/articles/0dte-dealer-positioning-explained.md');

export default async function ZeroDteDealerPositioningExplainedPage() {
  const markdown = await loadLocalizedMarkdown(articlePath);

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 sm:py-12">
      <ArticleJsonLd slug="0dte-dealer-positioning-explained" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="zg-article-card">
        <ArticleMeta slug="0dte-dealer-positioning-explained" />
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <ArticleFaq slug="0dte-dealer-positioning-explained" />

      <RelatedArticles slug="0dte-dealer-positioning-explained" />

      <GexMethodologyNote />
      <LiveLevelsCTA concept="dealer positioning" />
    </div>
  );
}
