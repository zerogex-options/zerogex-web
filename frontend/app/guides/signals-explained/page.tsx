import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';
import { loadLocalizedMarkdown } from '@/core/localizedContent';

export const metadata = {
  title: 'ZeroGEX Signals Explained: Score Reference & Trigger Guide',
  description:
    'Every ZeroGEX signal on one page — what each asks, the timeframe, when it fires, and what a positive, negative, or zero score actually means.',
  alternates: { canonical: '/guides/signals-explained' },
};

const guidePath = path.join(process.cwd(), 'content/guides/signals-explained.md');

export default async function SignalsExplainedGuidePage() {
  const markdown = await loadLocalizedMarkdown(guidePath);

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 sm:py-12">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: '/' },
          { name: 'Guides', url: '/guides' },
          { name: 'ZeroGEX Signals Explained', url: '/guides/signals-explained' },
        ]}
      />
      <Link href="/guides" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Guides
      </Link>

      <article className="zg-article-card">
        <div className="mb-8 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">ZeroGEX Guide • Reference</div>
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>
    </div>
  );
}
