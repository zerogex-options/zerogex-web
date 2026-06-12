import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';

export const metadata = {
  title: 'ZeroGEX Signals Explained: Score Reference & Trigger Guide',
  description:
    'Every ZeroGEX signal on one page — what each asks, the timeframe, when it fires, and what a positive, negative, or zero score actually means.',
  alternates: { canonical: '/guides/signals-explained' },
};

const guidePath = path.join(process.cwd(), 'content/guides/signals-explained.md');

export default function SignalsExplainedGuidePage() {
  const markdown = fs.readFileSync(guidePath, 'utf8');

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
