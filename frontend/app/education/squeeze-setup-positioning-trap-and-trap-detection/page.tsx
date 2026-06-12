import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import RelatedArticles from '@/components/RelatedArticles';

export const metadata = {
  title: 'Squeeze Setup, Positioning Trap & Trap Detection',
  description:
    'Squeeze Setup, Positioning Trap, and Trap Detection — three ZeroGEX Advanced Signals with the same number line answering entirely different questions.',
  alternates: { canonical: '/education/squeeze-setup-positioning-trap-and-trap-detection' },
};

const articlePath = path.join(process.cwd(), 'content/articles/squeeze-setup-positioning-trap-and-trap-detection.md');

export default function SqueezeSetupPositioningTrapAndTrapDetectionPage() {
  const markdown = fs.readFileSync(articlePath, 'utf8');

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <ArticleJsonLd slug="squeeze-setup-positioning-trap-and-trap-detection" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-10 shadow-[0_20px_60px_var(--color-info-soft)] md:px-14">
        <div className="mb-8 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">ZeroGEX Education • 6 min read</div>
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <RelatedArticles slug="squeeze-setup-positioning-trap-and-trap-detection" />

      <div className="zg-feature-shell mt-8 p-6 md:p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <Sparkles size={14} />
          Pro Plan
        </div>
        <h3 className="mb-2 text-xl font-semibold text-[var(--color-text-primary)]">
          Want the full picture?
        </h3>
        <p className="mb-3 text-sm leading-7 text-[var(--color-text-secondary)]">
          The free tier surfaces these signals as scores. Pro unlocks the full stack: per-signal historical timelines, playbook-grade triggers with entry/stop/target levels, MSI composite breakdowns, and real-time alerts the moment Squeeze Setup, Positioning Trap, or Trap Detection cross conviction thresholds.
        </p>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          If you&apos;ve ever wished you could see <em>why</em> a signal moved — not just that it did — Pro is built for that.
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
