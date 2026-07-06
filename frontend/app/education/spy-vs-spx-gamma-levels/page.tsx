import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { ArrowRight, BarChart2 } from 'lucide-react';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import RelatedArticles from '@/components/RelatedArticles';
import { articleMetadata } from '@/core/articleRegistry';

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

      <div className="zg-feature-shell mt-8 p-6 md:p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <BarChart2 size={14} />
          Free Gamma Levels
        </div>
        <h3 className="mb-2 text-xl font-semibold text-[var(--color-text-primary)]">
          See today&apos;s SPX, SPY &amp; QQQ gamma levels side by side
        </h3>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          Each free ZeroGEX gamma-levels page leads with its own ticker&apos;s gamma flip, call wall, put wall, max pain, and net dealer GEX — then shows the other two so you can spot the levels where the books agree.
        </p>
        <Link
          href="/spy-gamma-levels"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Open free gamma levels
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
