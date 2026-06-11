import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import RelatedArticles from '@/components/RelatedArticles';

const articlePath = path.join(process.cwd(), 'content/articles/eod-pressure-and-trap-detection.md');

export default function EodPressureAndTrapDetectionPage() {
  const markdown = fs.readFileSync(articlePath, 'utf8');

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <ArticleJsonLd slug="eod-pressure-and-trap-detection" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-10 shadow-[0_20px_60px_var(--color-info-soft)] md:px-14">
        <div className="mb-8 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">ZeroGEX Education • 14 min read</div>
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <RelatedArticles slug="eod-pressure-and-trap-detection" />

      <div className="zg-feature-shell mt-8 p-6 md:p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <Sparkles size={14} />
          Pro Plan
        </div>
        <h3 className="mb-2 text-xl font-semibold text-[var(--color-text-primary)]">
          Want to trade these signals live?
        </h3>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          EOD Pressure and Trap Detection are part of the ZeroGEX™ Advanced Signal suite, available on the Pro plan. Get real-time scoring, full context fields, and historical score charts for both signals across SPX and major underlyings.
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Upgrade to Pro
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
