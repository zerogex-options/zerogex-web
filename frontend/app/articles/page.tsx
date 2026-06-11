import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';

export default function ArticlesPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="zg-feature-shell mb-10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <Newspaper size={14} />
          Articles
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">ZeroGEX Articles</h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          Practical market-structure education for options traders. Start with our first article on
          Gamma Exposure (GEX), then explore additional flow-focused ZeroGEX educational articles.
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

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • April 16, 2026 • 16:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          Net Volume vs Directional Flow: What Actually Matters in Options Tape?
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          Understand why raw contract counts can mislead, when directional volume adds signal, and why premium-weighted flow is often the strongest conviction metric on professional desks.
        </p>
        <Link
          href="/education/net-volume-vs-directional-flow"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • May 12, 2026 • 16:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          Trading the Close: How EOD Pressure and Trap Detection Read Dealer Hedging in Real Time
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          A technical deep-dive on two ZeroGEX™ Advanced Signals — charm-driven end-of-day drift and the failed-breakout mechanics that snap price back when dealers absorb moves. Learn how each signal is built, when it fires, and how to read them together at the inflection points that matter.
        </p>
        <Link
          href="/education/eod-pressure-and-trap-detection"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • May 13, 2026 • 16:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          Squeeze Setup, Positioning Trap & Trap Detection: Three Signals, Three Stories
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          Three ZeroGEX™ Advanced Signals that look almost identical at a glance — same [-1, +1] number line, same kinds of pivots — but answer entirely different questions: when the market is coiled, when the crowd is offside, and when a breakout just failed. Learn which trade each signal is actually pointing at, and how to read them together.
        </p>
        <Link
          href="/education/squeeze-setup-positioning-trap-and-trap-detection"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 11, 2026 • 16:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          How to Read a Gamma Flip
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          The practical intraday read on the gamma flip — what the level actually is, what changes above versus below it, how dealer hedging behavior shifts across the regime line, and how to use it as a filter rather than a signal.
        </p>
        <Link
          href="/education/how-to-read-a-gamma-flip"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 11, 2026 • 16:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          Gamma Walls Explained: Call Wall, Put Wall, and How Price Reacts
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          What gamma walls actually are, why price tends to react at the call wall and put wall, how the walls migrate through the session, and the conditions that make a wall more likely to hold versus break.
        </p>
        <Link
          href="/education/gamma-walls-explained"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 11, 2026 • 16:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          0DTE Dealer Positioning Explained
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          Why same-day expiries now dominate the intraday dealer book, how negative- and positive-gamma regimes change the tape specifically for 0DTE, and how to read SPX 0DTE flow through the dealer-hedging lens.
        </p>
        <Link
          href="/education/0dte-dealer-positioning-explained"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
