import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';
import { loadLocalizedMarkdown } from '@/core/localizedContent';

export const metadata = {
  title: 'Methodology & Validation | ZeroGEX',
  description:
    'What ZeroGEX observes, what it models, and how the models are tested. The dealer-positioning convention, its limitations, and how we evaluate whether it works.',
  alternates: { canonical: '/methodology' },
};

// The permanent, linkable answer to "what does ZeroGEX actually claim?".
// Markdown-backed like /guides so the prose can be reviewed as prose and
// translated per-locale (methodology.<locale>.md) without touching the route.
const methodologyPath = path.join(process.cwd(), 'content/methodology.md');

export default async function MethodologyPage() {
  const markdown = await loadLocalizedMarkdown(methodologyPath);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: '/' },
          { name: 'Methodology & Validation', url: '/methodology' },
        ]}
      />

      <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-10 shadow-[0_20px_60px_var(--color-info-soft)] md:px-14">
        <div className="mb-8 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
          ZeroGEX • Transparency
        </div>
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <div className="mt-8 text-center">
        <Link
          href="/guides"
          className="text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]"
        >
          Browse the ZeroGEX guides →
        </Link>
      </div>
    </div>
  );
}
