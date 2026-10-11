import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';
import { loadLocalizedMarkdown } from '@/core/localizedContent';

export const metadata = {
  title: 'ZeroGEX Signals Explained: Score Reference & Trigger Guide',
  description:
    'Every ZeroGEX signal on one page\u00a0- what each asks, the timeframe, when it fires, and what a positive, negative, or zero score actually means.',
  alternates: { canonical: '/guides/signals-explained' },
};

const guidePath = path.join(process.cwd(), 'content/guides/signals-explained.md');

// The guide used to end at its last paragraph with no link anywhere, though
// the pillar, /methodology and the comparisons all link into it. These pass
// that reader on to the pages the guide is the reference for.
const NEXT_READING = [
  { href: '/scorecard', label: 'Every day\u2019s signal receipts' },
  { href: '/education/squeeze-setup-explained', label: 'Squeeze Setup Explained' },
  { href: '/education/positioning-trap-explained', label: 'Positioning Trap Explained' },
  { href: '/education/eod-pressure-explained', label: 'EOD Pressure Explained' },
];

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

      <nav aria-label="Keep reading" className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {NEXT_READING.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="font-semibold text-[var(--color-warning)] underline-offset-2 hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <LiveLevelsCTA />
    </div>
  );
}
