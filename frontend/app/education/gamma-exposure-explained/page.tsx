import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import ArticleFaq from '@/components/ArticleFaq';
import RelatedArticles from '@/components/RelatedArticles';
import { articleMetadata } from '@/core/articleRegistry';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import { loadLocalizedMarkdown } from '@/core/localizedContent';

export const metadata = articleMetadata('gamma-exposure-explained');

const articlePath = path.join(process.cwd(), 'content/articles/gamma-exposure-explained.md');

export default async function GammaExposureExplainedPage() {
  const markdown = await loadLocalizedMarkdown(articlePath);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <ArticleJsonLd slug="gamma-exposure-explained" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-10 shadow-[0_20px_60px_var(--color-info-soft)] md:px-14">
        <div className="mb-8 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">ZeroGEX Education • 16 min read</div>
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <ArticleFaq slug="gamma-exposure-explained" />

      <RelatedArticles slug="gamma-exposure-explained" />

      <LiveLevelsCTA concept="gamma exposure" />
    </div>
  );
}
