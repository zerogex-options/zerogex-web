import Link from 'next/link';
import { ArrowLeft, LifeBuoy } from 'lucide-react';

export const metadata = {
  title: 'ZeroGEX Help Center: FAQs and Product Guides',
  description:
    'ZeroGEX help and how-to walkthroughs. While the help center is under construction, the Guides and Articles sections cover how every signal works.',
  alternates: { canonical: '/help' },
};

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <Link href="/education" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Hub
      </Link>

      <div className="zg-feature-shell flex flex-col items-center p-10 text-center md:p-14">
        <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
          <LifeBuoy size={26} />
        </span>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
          Under construction
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">Help Center</h1>
        <p className="max-w-xl text-sm leading-7 text-[var(--color-text-secondary)]">
          Product help, FAQs, and how-to walkthroughs are on the way. In the meantime, the
          Guides and Articles sections cover how ZeroGEX signals work and how to read them.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/guides"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
          >
            Browse Guides
          </Link>
          <Link
            href="/education"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft size={16} />
            Back to Hub
          </Link>
        </div>
      </div>
    </div>
  );
}
