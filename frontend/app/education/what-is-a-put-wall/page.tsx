import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import RelatedArticles from '@/components/RelatedArticles';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import { articleMetadata } from '@/core/articleRegistry';
import { loadLocalizedMarkdown } from '@/core/localizedContent';

export const metadata = articleMetadata('what-is-a-put-wall');

const articlePath = path.join(process.cwd(), 'content/articles/what-is-a-put-wall.md');

export default async function PutWallPage() {
  const markdown = await loadLocalizedMarkdown(articlePath);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <ArticleJsonLd slug="what-is-a-put-wall" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-10 shadow-[0_20px_60px_var(--color-info-soft)] md:px-14">
        <div className="mb-8 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">ZeroGEX Education • 8 min read</div>
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <RelatedArticles slug="what-is-a-put-wall" />

      <LiveLevelsCTA concept="put wall" />
    </div>
  );
}
