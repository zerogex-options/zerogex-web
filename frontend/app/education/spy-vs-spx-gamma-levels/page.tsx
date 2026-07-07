import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import RelatedArticles from '@/components/RelatedArticles';
import { articleMetadata } from '@/core/articleRegistry';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';

export const metadata = articleMetadata('spy-vs-spx-gamma-levels');

const articlePath = path.join(process.cwd(), 'content/articles/spy-vs-spx-gamma-levels.md');

export default function SpyVsSpxGammaLevelsPage() {
  const markdown = fs.readFileSync(articlePath, 'utf8');

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <ArticleJsonLd slug="spy-vs-spx-gamma-levels" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-10 shadow-[0_20px_60px_var(--color-info-soft)] md:px-14">
        <div className="mb-8 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">ZeroGEX Education • 9 min read</div>
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <RelatedArticles slug="spy-vs-spx-gamma-levels" />

      <LiveLevelsCTA concept="gamma levels" />
    </div>
  );
}
