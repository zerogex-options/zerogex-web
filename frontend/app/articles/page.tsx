import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';

export const metadata = {
  title:
    'Options Gamma Trading Articles: SPX / SPY / QQQ Pinning, Gamma Flip & Dealer Flow | ZeroGEX',
  description:
    'ZeroGEX options gamma trading articles — SPX, SPY and QQQ pinning, the gamma flip, call walls, put walls, 0DTE dealer positioning, and dealer-flow deep dives. Definitions, worked examples, and today’s live levels.',
  alternates: { canonical: '/articles' },
};

type Article = {
  href: string;
  kind: string;
  title: string;
  blurb: string;
  cta?: string;
};

const ARTICLES: Article[] = [
  {
    href: '/education/why-market-makers-trade-stock',
    kind: 'Published • July 12, 2026 • 16:00 UTC',
    title: 'Why Market Makers Are Forced to Trade Stock',
    blurb:
      'Dealers don’t trade stock because they have a view — they trade it because the delta of the options they hold keeps moving on its own, and every move mechanically forces a hedge. The foundation of forced dealer flow, and why it’s the most predictable order flow in the market.',
  },
  {
    href: '/education/delta-and-its-three-children',
    kind: 'Published • July 12, 2026 • 16:00 UTC',
    title: 'Delta and Its Three Children: Gamma, Charm, and Vanna',
    blurb:
      'Delta tells a dealer how much stock to hold, but it never sits still — and it can only move three ways: with price (gamma), with time (charm), and with volatility (vanna). Why a dealer hedges the change in delta, and why you reprice the book instead of summing the greeks.',
  },
  {
    href: '/education/charm-the-clock-is-a-trader',
    kind: 'Published • July 12, 2026 • 16:00 UTC',
    title: 'Charm: The Clock Is a Trader',
    blurb:
      'Charm is the rate an option’s delta changes as time passes. It forces dealers to trade stock on a dead-flat tape — and because the clock is perfectly predictable, it’s the rare dealer flow you can forecast hours before it prints. A forecast with a deadline.',
  },
  {
    href: '/education/vanna-when-fear-fades',
    kind: 'Published • July 12, 2026 • 16:00 UTC',
    title: 'Vanna: When Fear Fades, Dealers Buy',
    blurb:
      'Vanna is the rate an option’s delta changes when implied vol changes. When priced fear drains out after an event that never delivered, vanna forces dealers into a steady bid — the “up on no news” grind that hides in the slope, not the volume.',
  },
  {
    href: '/education/why-we-dont-publish-dex',
    kind: 'Published • July 12, 2026 • 16:00 UTC',
    title: 'Why We Don’t Publish DEX',
    blurb:
      'Delta Exposure looks like the natural sibling of gamma exposure. We refuse to publish it — it measures the one greek dealers have already hedged to zero, weights the dirtiest strikes in the chain, and is loudest exactly where forced flow is weakest. What we publish instead.',
  },
  {
    href: '/education/what-is-a-put-wall',
    kind: 'Published • July 7, 2026 • 16:00 UTC',
    title: 'What Is a Put Wall? How Options Traders Use Put Walls as Dealer Support',
    blurb:
      'The put wall is the strike where put-side dealer gamma piles up — usually the sturdiest dealer-hedged support on the board. What it is, why price reacts there, how it migrates intraday, when it holds versus breaks, and how to find today’s SPX, SPY, and QQQ put walls.',
  },
  {
    href: '/education/what-is-a-call-wall',
    kind: 'Published • July 7, 2026 • 16:00 UTC',
    title: 'What Is a Call Wall? How Dealers Defend the Upside in Options',
    blurb:
      'The call wall is the strike where call-side dealer gamma concentrates — the level dealers defend on the way up. What it is, why it caps rallies in long gamma, how it migrates, when a break signals a regime change, and where to see today’s live SPX, SPY, and QQQ call walls.',
  },
  {
    href: '/education/what-is-gex-in-trading',
    kind: 'Published • July 7, 2026 • 16:00 UTC',
    title: 'What Is GEX in Trading? Gamma Exposure Explained Simply',
    blurb:
      'GEX — gamma exposure — is the one number that explains why some days pin and others trend. A plain-English, beginner-first explainer: what GEX measures, how dealer gamma moves the tape, and what positive versus negative regimes mean for your trading.',
  },
  {
    href: '/education/spx-net-gamma-exposure-today',
    kind: 'Published • July 7, 2026 • 16:00 UTC',
    title: 'SPX Net Gamma Exposure Today: How to Read Current Net GEX',
    blurb:
      '“What’s the current SPX net gamma exposure?” The answer changes every session. What net GEX is, how to read a positive versus negative reading, where the gamma-flip zero-cross sits, and how to pull up today’s live SPX net GEX in one click.',
  },
  {
    href: '/education/spy-vs-spx-gamma-levels',
    kind: 'Published • July 6, 2026 • 16:00 UTC',
    title: 'SPY vs SPX Options: Which Gamma Levels Matter?',
    blurb:
      'SPY and SPX track the same index through two separate dealer gamma books. How their gamma levels differ, how to translate a level with the ~10x ratio, which book carries more weight, and why the level that matters most is the one where the two agree.',
  },
  {
    href: '/education/announcing-folds-of-honor-pledge',
    kind: 'Published • June 24, 2026 • Announcement',
    title: 'Announcing Our 3% Pledge to Folds of Honor',
    blurb:
      'Starting today, ZeroGEX donates 3% of every subscription to Folds of Honor — funding educational scholarships for the spouses and children of fallen and disabled U.S. service members. The mechanics, the math, and the partner choice.',
    cta: 'Read announcement',
  },
  {
    href: '/education/why-do-breakouts-fail',
    kind: 'Published • June 15, 2026 • 14:00 UTC',
    title: 'Why Do Breakouts Fail? The Structural Reason Behind Failed Breakouts',
    blurb:
      "Failed breakouts aren't random — they're driven by dealer hedging at concentrated strikes. The three structural conditions (long-gamma regime, strengthening Net GEX, static wall) that predict the fail before you chase, and how to read them on the live tape.",
  },
  {
    href: '/education/why-spy-reverses-at-levels',
    kind: 'Published • June 15, 2026 • 14:00 UTC',
    title: 'Why Does SPY Reverse at Certain Levels?',
    blurb:
      'SPY reversals that look random on the chart are tied to options positioning. The four kinds of options-based levels SPY actually reverses at — call wall, put wall, gamma magnet, gamma flip — and how the regime decides whether the level holds or breaks.',
  },
  {
    href: '/education/options-support-and-resistance',
    kind: 'Published • June 15, 2026 • 14:00 UTC',
    title: 'How to Identify Support and Resistance from Options Positioning',
    blurb:
      "Standard S/R is psychology; options-based S/R is mechanics. The four kinds of options-based levels, why they're sturdier than chart-based S/R, the workflow for identifying them in real time, and the conditions that make them hold versus break.",
  },
  {
    href: '/education/how-to-avoid-chasing-0dte',
    kind: 'Published • June 15, 2026 • 14:00 UTC',
    title: 'How to Avoid Chasing 0DTE Moves',
    blurb:
      "The 0DTE chase is the most expensive bad habit in retail trading. Three signs you're about to chase, the five-point structural read that overrides the instinct, and the conditions when 0DTE momentum is actually real and the chase isn't the trap.",
  },
  {
    href: '/education/how-to-know-if-spy-is-pinned',
    kind: 'Published • June 15, 2026 • 14:00 UTC',
    title: 'How to Know If SPY Is Pinned: The Five Signs',
    blurb:
      'Pin recognition is the cleanest day-trade filter. The five structural signs SPY is pinned today, the playbook that works in a pinned tape (fade extremes, skip middle, small size), and the conditions that break the pin.',
  },
  {
    href: '/education/what-is-negative-gamma',
    kind: 'Published • June 15, 2026 • 14:00 UTC',
    title: 'What Does Negative Gamma Mean? A Plain-English Explainer',
    blurb:
      'Negative gamma means dealer hedging amplifies moves instead of dampening them — wider ranges, extending breakouts, broken pins. What the term refers to, how to spot a negative-gamma regime in real time, and what changes in your trading when you’re in one.',
  },
  {
    href: '/education/why-spy-pins-near-strikes',
    kind: 'Published • June 15, 2026 • 14:00 UTC',
    title: 'Why Does SPY Pin Near a Strike? Options Pinning Explained',
    blurb:
      "Pinning isn't superstition — it's dealer hedging at heavy gamma strikes mechanically pulling price toward the strike. The mechanism, why it intensifies near expiry, the two pin types most traders confuse, and the conditions that make today a pin day.",
  },
  {
    href: '/education/how-to-trade-around-gamma-flip',
    kind: 'Published • June 15, 2026 • 14:00 UTC',
    title: 'How to Trade Around Gamma Flip Levels',
    blurb:
      "The flip isn't a price level — it's a playbook switch. The three setup types each regime supports, the workflow for changing playbooks when spot crosses the flip, and what to do in the contested zone where neither playbook works cleanly.",
  },
  {
    href: '/education/eod-pressure-explained',
    kind: 'Published • June 12, 2026 • 18:00 UTC',
    title: 'EOD Pressure Signal Explained: Reading the Close',
    blurb:
      'The trader-facing read on the EOD Pressure signal — how charm decay and pin gravity combine into a directional drift estimator for the final 90 minutes, how the four core components are weighted, and how to use the score inside the active window.',
  },
  {
    href: '/education/positioning-trap-explained',
    kind: 'Published • June 12, 2026 • 18:00 UTC',
    title: 'Positioning Trap Signal Explained: Fading the Crowd',
    blurb:
      'What the Positioning Trap signal measures, why crowded options trades break, how the score combines PCR + smart-money imbalance + regime context, and how to fade the crowd at the right moment instead of being trapped with them.',
  },
  {
    href: '/education/squeeze-setup-explained',
    kind: 'Published • June 12, 2026 • 18:00 UTC',
    title: 'Squeeze Setup Signal Explained: Reading Coiled Markets',
    blurb:
      'The practical deep-dive on the Squeeze Setup signal — what it asks, the five inputs that drive the score, when it triggers versus stays silent, and how to use it as a precondition filter for directional breakouts.',
  },
  {
    href: '/education/best-gex-tools',
    kind: 'Published • June 11, 2026 • 16:00 UTC',
    title: 'Best Gamma Exposure (GEX) Tools: A Fair Comparison for 2026',
    blurb:
      'A balanced comparison of the real category of GEX/options-flow tools — real-time vs delayed, 0DTE coverage, methodology, signal quality, and price — including ZeroGEX on equal footing with the rest of the category.',
  },
  {
    href: '/education/vanna-and-charm-explained',
    kind: 'Published • June 11, 2026 • 16:00 UTC',
    title: 'Vanna and Charm Explained for Options Traders',
    blurb:
      'What vanna and charm are, why they drive a meaningful share of dealer hedging flows, how vanna produces the persistent vol-compression grind, how charm shapes the predictable into-close flow, and how both interact with the gamma regime to either reinforce or invert the structural drift.',
  },
  {
    href: '/education/max-pain-explained',
    kind: 'Published • June 11, 2026 • 16:00 UTC',
    title: 'Max Pain Explained — and Does It Actually Work?',
    blurb:
      'The honest version of the max pain question — what max pain is, the theory people cite for it, what the evidence actually suggests about whether it moves price, and how to use it as cross-check rather than forecast. Why the gamma magnet, not the writer-payout argument, is usually the real mechanism.',
  },
  {
    href: '/education/gamma-exposure-explained',
    kind: 'Pillar • June 11, 2026 • 16:00 UTC',
    title: 'Gamma Exposure (GEX) Explained: The Complete Guide',
    blurb:
      'The comprehensive read on gamma exposure — what GEX is, how dealer gamma is calculated and signed, why positive and negative regimes behave so differently, and how the gamma flip and the walls structure the intraday tape. The central pillar for everything else in the Education section.',
  },
  {
    href: '/education/0dte-dealer-positioning-explained',
    kind: 'Published • June 11, 2026 • 16:00 UTC',
    title: '0DTE Dealer Positioning Explained',
    blurb:
      'Why same-day expiries now dominate the intraday dealer book, how negative- and positive-gamma regimes change the tape specifically for 0DTE, and how to read SPX 0DTE flow through the dealer-hedging lens.',
  },
  {
    href: '/education/gamma-walls-explained',
    kind: 'Published • June 11, 2026 • 16:00 UTC',
    title: 'Gamma Walls Explained: Call Wall, Put Wall, and How Price Reacts',
    blurb:
      'What gamma walls actually are, why price tends to react at the call wall and put wall, how the walls migrate through the session, and the conditions that make a wall more likely to hold versus break.',
  },
  {
    href: '/education/how-to-read-a-gamma-flip',
    kind: 'Published • June 11, 2026 • 16:00 UTC',
    title: 'How to Read a Gamma Flip',
    blurb:
      'The practical intraday read on the gamma flip — what the level actually is, what changes above versus below it, how dealer hedging behavior shifts across the regime line, and how to use it as a filter rather than a signal.',
  },
  {
    href: '/education/squeeze-setup-positioning-trap-and-trap-detection',
    kind: 'Published • May 13, 2026 • 16:00 UTC',
    title: 'Squeeze Setup, Positioning Trap & Trap Detection: Three Signals, Three Stories',
    blurb:
      'Three ZeroGEX™ Advanced Signals that look almost identical at a glance — same [-1, +1] number line, same kinds of pivots — but answer entirely different questions: when the market is coiled, when the crowd is offside, and when a breakout just failed. Learn which trade each signal is actually pointing at, and how to read them together.',
  },
  {
    href: '/education/eod-pressure-and-trap-detection',
    kind: 'Published • May 12, 2026 • 16:00 UTC',
    title: 'Trading the Close: How EOD Pressure and Trap Detection Read Dealer Hedging in Real Time',
    blurb:
      'A technical deep-dive on two ZeroGEX™ Advanced Signals — charm-driven end-of-day drift and the failed-breakout mechanics that snap price back when dealers absorb moves. Learn how each signal is built, when it fires, and how to read them together at the inflection points that matter.',
  },
  {
    href: '/education/net-volume-vs-directional-flow',
    kind: 'Published • April 16, 2026 • 16:00 UTC',
    title: 'Net Volume vs Directional Flow: What Actually Matters in Options Tape?',
    blurb:
      'Understand why raw contract counts can mislead, when directional volume adds signal, and why premium-weighted flow is often the strongest conviction metric on professional desks.',
  },
];

export default function ArticlesPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="zg-feature-shell mb-10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <Newspaper size={14} />
          Articles
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">
          Options Gamma Trading Articles
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          Practical, flow-focused breakdowns of options market structure for SPX, SPY, and QQQ
          traders — gamma exposure (GEX), the gamma flip, call walls, put walls, pinning, and 0DTE
          dealer positioning. Every piece pairs the concept with a worked example and links straight
          to{' '}
          <Link
            href="/spx-gamma-levels"
            className="font-semibold text-[var(--color-warning)] underline-offset-2 hover:underline"
          >
            today’s live SPX / SPY / QQQ gamma levels
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {ARTICLES.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="zg-feature-shell p-6 block cursor-pointer transition-colors hover:border-[var(--color-warning-soft)]"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">{a.kind}</div>
            <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">{a.title}</h2>
            <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">{a.blurb}</p>
            <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)]">
              {a.cta ?? 'Read article'}
              <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
