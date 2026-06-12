import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { ArrowRight, BarChart2 } from 'lucide-react';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import RelatedArticles from '@/components/RelatedArticles';
import { articleMetadata } from '@/core/articleRegistry';

export const metadata = articleMetadata('gamma-exposure-explained');

const articlePath = path.join(process.cwd(), 'content/articles/gamma-exposure-explained.md');

export default function GammaExposureExplainedPage() {
  const markdown = fs.readFileSync(articlePath, 'utf8');

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

      <RelatedArticles slug="gamma-exposure-explained" />

      <div className="zg-feature-shell mt-8 p-6 md:p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <BarChart2 size={14} />
          Free Dashboard
        </div>
        <h3 className="mb-2 text-xl font-semibold text-[var(--color-text-primary)]">
          See today&apos;s full gamma exposure read live
        </h3>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          The ZeroGEX dashboard surfaces Net GEX, the gamma flip, the call and put walls, the dealer gamma profile, and a strike-by-DTE heatmap — the full structural read in one view.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Launch the free dashboard
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
