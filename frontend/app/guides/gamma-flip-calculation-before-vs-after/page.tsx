import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import { loadLocalizedMarkdown } from '@/core/localizedContent';

export const metadata = {
  title: 'Gamma Flip Calculation: Before vs After (ZeroGEX Guide)',
  description:
    'How ZeroGEX locates the zero-gamma level — the move from a cumulative net-GEX approximation to the spot-shift dealer gamma profile, and what you see on the platform.',
  alternates: { canonical: '/guides/gamma-flip-calculation-before-vs-after' },
};

const guidePath = path.join(process.cwd(), 'content/guides/gamma-flip-calculation-before-vs-after.md');

export default async function GammaFlipBeforeVsAfterGuidePage() {
  const markdown = await loadLocalizedMarkdown(guidePath);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/guides" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Guides
      </Link>

      <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-10 shadow-[0_20px_60px_var(--color-info-soft)] md:px-14">
        <div className="mb-8 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">ZeroGEX Guide • Reference</div>
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>
    </div>
  );
}
