import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';
import { loadLocalizedMarkdown } from '@/core/localizedContent';

export const metadata = {
  title: 'Gamma Flip Calculation: Before vs After (ZeroGEX Guide)',
  description:
    'How ZeroGEX locates the zero-gamma level\u00a0- from a cumulative net-GEX approximation to the spot-shift dealer gamma profile, and what you see on the platform.',
  alternates: { canonical: '/guides/gamma-flip-calculation-before-vs-after' },
};

const guidePath = path.join(process.cwd(), 'content/guides/gamma-flip-calculation-before-vs-after.md');

// The guide used to end at its last paragraph with no link anywhere, though
// the pillar, /methodology and the comparisons all link into it. These pass
// that reader on to the pages the guide is the reference for.
const NEXT_READING = [
  { href: '/education/how-to-read-a-gamma-flip', label: 'What Is a Gamma Flip?' },
  { href: '/education/zero-gamma-level-explained', label: 'What Is Zero Gamma?' },
  { href: '/methodology', label: 'Methodology & Validation' },
];

export default async function GammaFlipBeforeVsAfterGuidePage() {
  const markdown = await loadLocalizedMarkdown(guidePath);

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 sm:py-12">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: '/' },
          { name: 'Guides', url: '/guides' },
          { name: 'Gamma Flip Calculation: Before vs After', url: '/guides/gamma-flip-calculation-before-vs-after' },
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

      <LiveLevelsCTA concept="gamma flip" />
    </div>
  );
}
