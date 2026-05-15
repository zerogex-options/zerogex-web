import Link from 'next/link';
import { ArrowRight, GraduationCap } from 'lucide-react';

export default function GuidesPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="zg-feature-shell mb-10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <GraduationCap size={14} />
          Guides
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">ZeroGEX Guides</h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          Reference material you come back to — concise, structured, and built to be scanned
          while you trade.
        </p>
      </div>

      <div className="zg-feature-shell p-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Reference Guide</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          Signals: Explained
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          Every ZeroGEX signal on one page — what each one asks, the timeframe it reads, when it fires,
          and what a positive, negative, or zero score actually means. Includes the full 30-second
          matrix and the score-sign reference for both Advanced and Basic signals.
        </p>
        <Link
          href="/guides/signals-explained"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read guide
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
