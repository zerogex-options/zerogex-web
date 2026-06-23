import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';

export const metadata = {
  title: 'ZeroGEX Articles: Gamma Exposure, Dealer Hedging & Flow',
  description:
    'ZeroGEX articles — practical market-structure breakdowns for options traders. Gamma exposure, dealer hedging, vanna and charm, max pain, and signal deep-dives.',
  alternates: { canonical: '/articles' },
};

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
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 15, 2026 • 14:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          Why Do Breakouts Fail? The Structural Reason Behind Failed Breakouts
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          Failed breakouts aren&apos;t random — they&apos;re driven by dealer hedging at concentrated strikes. The three structural conditions (long-gamma regime, strengthening Net GEX, static wall) that predict the fail before you chase, and how to read them on the live tape.
        </p>
        <Link
          href="/education/why-do-breakouts-fail"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 15, 2026 • 14:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          Why Does SPY Reverse at Certain Levels?
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          SPY reversals that look random on the chart are tied to options positioning. The four kinds of options-based levels SPY actually reverses at — call wall, put wall, gamma magnet, gamma flip — and how the regime decides whether the level holds or breaks.
        </p>
        <Link
          href="/education/why-spy-reverses-at-levels"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 15, 2026 • 14:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          How to Identify Support and Resistance from Options Positioning
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          Standard S/R is psychology; options-based S/R is mechanics. The four kinds of options-based levels, why they&apos;re sturdier than chart-based S/R, the workflow for identifying them in real time, and the conditions that make them hold versus break.
        </p>
        <Link
          href="/education/options-support-and-resistance"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 15, 2026 • 14:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          How to Avoid Chasing 0DTE Moves
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          The 0DTE chase is the most expensive bad habit in retail trading. Three signs you&apos;re about to chase, the five-point structural read that overrides the instinct, and the conditions when 0DTE momentum is actually real and the chase isn&apos;t the trap.
        </p>
        <Link
          href="/education/how-to-avoid-chasing-0dte"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 15, 2026 • 14:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          How to Know If SPY Is Pinned: The Five Signs
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          Pin recognition is the cleanest day-trade filter. The five structural signs SPY is pinned today, the playbook that works in a pinned tape (fade extremes, skip middle, small size), and the conditions that break the pin.
        </p>
        <Link
          href="/education/how-to-know-if-spy-is-pinned"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 15, 2026 • 14:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          What Does Negative Gamma Mean? A Plain-English Explainer
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          Negative gamma means dealer hedging amplifies moves instead of dampening them — wider ranges, extending breakouts, broken pins. What the term refers to, how to spot a negative-gamma regime in real time, and what changes in your trading when you&apos;re in one.
        </p>
        <Link
          href="/education/what-is-negative-gamma"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 15, 2026 • 14:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          Why Does SPY Pin Near a Strike? Options Pinning Explained
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          Pinning isn&apos;t superstition — it&apos;s dealer hedging at heavy gamma strikes mechanically pulling price toward the strike. The mechanism, why it intensifies near expiry, the two pin types most traders confuse, and the conditions that make today a pin day.
        </p>
        <Link
          href="/education/why-spy-pins-near-strikes"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 15, 2026 • 14:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          How to Trade Around Gamma Flip Levels
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          The flip isn&apos;t a price level — it&apos;s a playbook switch. The three setup types each regime supports, the workflow for changing playbooks when spot crosses the flip, and what to do in the contested zone where neither playbook works cleanly.
        </p>
        <Link
          href="/education/how-to-trade-around-gamma-flip"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 12, 2026 • 18:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          EOD Pressure Signal Explained: Reading the Close
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          The trader-facing read on the EOD Pressure signal — how charm decay and pin gravity combine into a directional drift estimator for the final 90 minutes, how the four core components are weighted, and how to use the score inside the active window.
        </p>
        <Link
          href="/education/eod-pressure-explained"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 12, 2026 • 18:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          Positioning Trap Signal Explained: Fading the Crowd
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          What the Positioning Trap signal measures, why crowded options trades break, how the score combines PCR + smart-money imbalance + regime context, and how to fade the crowd at the right moment instead of being trapped with them.
        </p>
        <Link
          href="/education/positioning-trap-explained"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 12, 2026 • 18:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          Squeeze Setup Signal Explained: Reading Coiled Markets
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          The practical deep-dive on the Squeeze Setup signal — what it asks, the five inputs that drive the score, when it triggers versus stays silent, and how to use it as a precondition filter for directional breakouts.
        </p>
        <Link
          href="/education/squeeze-setup-explained"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 11, 2026 • 16:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          Best Gamma Exposure (GEX) Tools: A Fair Comparison for 2026
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          A balanced comparison of the real category of GEX/options-flow tools — real-time vs delayed, 0DTE coverage, methodology, signal quality, and price — including ZeroGEX on equal footing with the rest of the category.
        </p>
        <Link
          href="/education/best-gex-tools"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 11, 2026 • 16:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          Vanna and Charm Explained for Options Traders
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          What vanna and charm are, why they drive a meaningful share of dealer hedging flows, how vanna produces the persistent vol-compression grind, how charm shapes the predictable into-close flow, and how both interact with the gamma regime to either reinforce or invert the structural drift.
        </p>
        <Link
          href="/education/vanna-and-charm-explained"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Published • June 11, 2026 • 16:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          Max Pain Explained — and Does It Actually Work?
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          The honest version of the max pain question — what max pain is, the theory people cite for it, what the evidence actually suggests about whether it moves price, and how to use it as cross-check rather than forecast. Why the gamma magnet, not the writer-payout argument, is usually the real mechanism.
        </p>
        <Link
          href="/education/max-pain-explained"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="zg-feature-shell p-6 mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Pillar • June 11, 2026 • 16:00 UTC</div>
        <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
          Gamma Exposure (GEX) Explained: The Complete Guide
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          The comprehensive read on gamma exposure — what GEX is, how dealer gamma is calculated and signed, why positive and negative regimes behave so differently, and how the gamma flip and the walls structure the intraday tape. The central pillar for everything else in the Education section.
        </p>
        <Link
          href="/education/gamma-exposure-explained"
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
