import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';

export default function EducationPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="zg-feature-shell mb-10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <BookOpen size={14} />
          Education
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">ZeroGEX Learning Hub</h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          Practical market-structure education for options traders. Start with our first guide on
          Gamma Exposure (GEX), then revisit this section as more ZeroGEX educational articles are added.
        </p>
      </div>

      <div className="zg-feature-shell p-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • March 26, 2026 • 16:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          ZeroGEX™ Guide: Decoding Gamma Exposure — The Hidden Force Driving Market Behavior
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          Learn how dealer hedging flows can stabilize or destabilize price action, why the gamma flip matters,
          and how to adapt strategy selection across volatility regimes.
        </p>
        <Link
          href="/education/decoding-gamma-exposure"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
