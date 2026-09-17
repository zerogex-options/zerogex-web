import Link from 'next/link';
import { ArrowRight, BarChart2, Code2 } from 'lucide-react';

type Props = {
  /**
   * Optional concept woven into the sub-headline, e.g. "put wall" →
   * "See today's put wall in real time". Defaults to the generic
   * gamma-levels headline when omitted.
   */
  concept?: string;
  /**
   * Optional explicit headline that overrides the concept template. Use when a
   * page needs precise wording — e.g. to avoid implying "in real time" next to
   * the delayed-data offer below.
   */
  headline?: string;
  /**
   * Optional bridge sentence rendered above the free-levels description, to
   * ease the transition from the article into the CTA.
   */
  intro?: string;
};

const TICKERS = [
  { href: '/spx-gamma-levels', label: 'SPX' },
  { href: '/spy-gamma-levels', label: 'SPY' },
  { href: '/qqq-gamma-levels', label: 'QQQ' },
  { href: '/ndx-gamma-levels', label: 'NDX' },
  { href: '/es-gamma-levels', label: 'ES' },
  { href: '/nq-gamma-levels', label: 'NQ' },
] as const;

const linkClass =
  'font-medium text-[var(--color-warning)] underline-offset-2 hover:underline';

/**
 * Standardized "see it live" internal-linking block for the end of every
 * education article. It closes the definition → example → today's live level →
 * trial loop by pointing straight into the three free ticker gamma-levels
 * pages (SPX / SPY / QQQ / NDX), the live 0DTE dashboard, and the trial.
 *
 * Kept in one component so the article → levels internal-link graph stays
 * consistent across every post and is edited in exactly one place.
 */
export default function LiveLevelsCTA({ concept, headline, intro }: Props) {
  const resolvedHeadline =
    headline ??
    (concept ? `See today's ${concept} in real time` : "See today's gamma levels in real time");

  return (
    <div className="zg-feature-shell mt-8 p-6 md:p-8">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
        <BarChart2 size={14} />
        Free Gamma Levels
      </div>
      <h3 className="mb-2 text-xl font-semibold text-[var(--color-text-primary)]">{resolvedHeadline}</h3>
      {intro ? (
        <p className="mb-3 text-sm leading-7 text-[var(--color-text-secondary)]">{intro}</p>
      ) : null}
      <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
        Want to follow this throughout the trading day? View today&apos;s SPX, SPY, QQQ, and NDX gamma flip, call wall,
        put wall, and Net GEX — free, delayed roughly 15 minutes, no signup required.
      </p>
      <div className="flex flex-wrap gap-3">
        {TICKERS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
          >
            {t.label} gamma levels
            <ArrowRight size={16} />
          </Link>
        ))}
      </div>
      {/* The publisher's exit, for the one reader in this audience who is not
          here to trade. These pages rank for the definitional queries
          ("what is a gamma wall", "gex tools") that anyone WRITING about
          market structure searches first, which makes them the second-best
          place on the site to hand someone the widget — and /embed is
          otherwise reachable only from the footer and the levels pages.

          A link rather than the copy-buttons block those pages carry. That
          block earns its size by being pre-filled with the page's own symbol,
          and an article about gamma walls has no symbol: a copy button here
          would have to pick SPX arbitrarily, which is exactly the "what you
          copy is what you are looking at" property that justified it. One
          line, and the builder does the rest. */}
      <p className="mt-5 text-sm leading-7 text-[var(--color-text-secondary)]">
        {/* Inline, not a flex child: Tailwind's preflight makes svg display:block,
            and in a flex row this icon wrapped onto a line of its own above the
            sentence it belongs to. */}
        <Code2
          size={15}
          className="mr-1.5 inline align-[-2px] text-[var(--color-warning)]"
          aria-hidden="true"
        />
        Writing about this? Put the same levels on your own site with a{' '}
        <Link href="/embed" className={linkClass}>
          free embeddable card
        </Link>{' '}
        &mdash; one line of HTML, or a PNG for Substack and Discord. No account, no key.
      </p>

      <p className="mt-5 text-sm leading-7 text-[var(--color-text-secondary)]">
        Or open the live{' '}
        <Link href="/real-time-gex-0dte" className={linkClass}>
          real-time 0DTE GEX dashboard
        </Link>{' '}
        — the full gamma flip, call and put walls, dealer positioning, and the 13-signal composite.{' '}
        <Link href="/register" className={linkClass}>
          Start a free trial
        </Link>{' '}
        for the live read.
      </p>
    </div>
  );
}
