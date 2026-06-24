import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { ArrowRight, Heart } from 'lucide-react';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import { articleMetadata } from '@/core/articleRegistry';

export const metadata = articleMetadata('announcing-folds-of-honor-pledge');

const articlePath = path.join(
  process.cwd(),
  'content/articles/announcing-folds-of-honor-pledge.md',
);

export default function AnnouncingFoldsOfHonorPledgePage() {
  const markdown = fs.readFileSync(articlePath, 'utf8');

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <ArticleJsonLd slug="announcing-folds-of-honor-pledge" />
      <Link
        href="/articles"
        className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]"
      >
        ← Back to Articles
      </Link>

      <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-10 shadow-[0_20px_60px_var(--color-info-soft)] md:px-14">
        <div className="mb-8 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
          ZeroGEX Announcement • 4 min read
        </div>
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <div className="zg-feature-shell mt-8 p-6 md:p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <Heart size={14} />
          Giving Back
        </div>
        <h3 className="mb-2 text-xl font-semibold text-[var(--color-text-primary)]">
          See the live donation tally and the full mechanics
        </h3>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          Our /giving page is the running ledger — donation totals to date, the next scheduled
          donation, and the FAQ covering exactly how the pledge works.
        </p>
        <Link
          href="/giving"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Open giving page
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
