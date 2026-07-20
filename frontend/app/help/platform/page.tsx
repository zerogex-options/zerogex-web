import Link from 'next/link';
import {
  ArrowRight,
  BookOpenCheck,
  LayoutDashboard,
  Radio,
  Gauge,
  LineChart,
  Calculator,
  UserCircle,
  Bell,
  Key,
  Sparkles,
  Compass,
} from 'lucide-react';
import { getServerT } from '@/core/localizedContent';
import { dict } from './page.i18n';

export const metadata = {
  title: 'ZeroGEX Platform Guide: Feature-by-Feature Walkthroughs',
  description:
    'Step-by-step product help for the ZeroGEX platform — every page, panel, and chart explained. Dashboard, Live Bulletin, Signals, Metrics, Strategy Tools, and account workflows.',
  alternates: { canonical: '/help/platform' },
};

type GuideEntry = { href: string; title: string; blurb: string };

type Section = {
  title: string;
  eyebrow: string;
  icon: typeof LayoutDashboard;
  entries: GuideEntry[];
};

const sections: Section[] = [
  {
    title: 'Getting Started',
    eyebrow: 'Start here',
    icon: Compass,
    entries: [
      {
        href: '/help/platform/getting-started',
        title: 'Your First 15 Minutes with ZeroGEX',
        blurb:
          'A guided tour from sign-up to your first read of the dashboard. What every tile means and which page to open first.',
      },
      {
        href: '/help/platform/tiers-and-access',
        title: 'Tiers, Access &amp; What Unlocks Where',
        blurb:
          'A clear map of which pages are public, Basic, and Pro — and what changes between tiers on each page.',
      },
      {
        href: '/help/platform/navigating-the-app',
        title: 'Navigating the App',
        blurb:
          'The sidebar, the symbol picker, the timeframe selector, theme toggles, and the keyboard shortcuts that speed things up.',
      },
    ],
  },
  {
    title: 'Core Pages',
    eyebrow: 'Daily-use surfaces',
    icon: LayoutDashboard,
    entries: [
      {
        href: '/help/platform/dashboard',
        title: 'Reading the Dashboard',
        blurb:
          'The first page you open every morning. Every metric tile explained, how to read the GEX regime header, and what changes between sessions.',
      },
      {
        href: '/help/platform/live-bulletin',
        title: 'Using the Live Bulletin',
        blurb:
          'The streaming feed of signal events, regime shifts, and notable flow. How items are scored, ordered, and what each row actually means.',
      },
    ],
  },
  {
    title: 'Signals',
    eyebrow: 'Composite & per-signal',
    icon: Sparkles,
    entries: [
      {
        href: '/help/platform/signals-overview',
        title: 'How Signals Work End-to-End',
        blurb:
          'The full signal model — Advanced (event-driven, triggers) vs. Basic (continuous, weight the composite). How scores combine and what the cards show you.',
      },
      {
        href: '/help/platform/composite-score',
        title: 'Composite Score',
        blurb:
          'How the composite blends all signals, how to read its sign and magnitude, and how to use it as a filter rather than a forecast.',
      },
      {
        href: '/help/platform/basic-signals-dashboard',
        title: 'Basic Signal Dashboard',
        blurb:
          'The six continuous reads — Tape Flow Bias, Skew Delta, Vanna/Charm Flow, Dealer Delta Pressure, GEX Gradient, Positioning Trap — and how they feed the composite.',
      },
      {
        href: '/help/platform/advanced-signals-dashboard',
        title: 'Advanced Signal Dashboard',
        blurb:
          'The event-driven signals — Volatility Expansion, EOD Pressure, Squeeze Setup, Trap Detection, 0DTE Position Imbalance, Gamma/VWAP Confluence, Range Break Imminence, Market Pressure.',
      },
    ],
  },
  {
    title: 'Metrics',
    eyebrow: 'Market structure',
    icon: Gauge,
    entries: [
      {
        href: '/help/platform/dealer-positioning',
        title: 'Dealer Positioning',
        blurb:
          'The full GEX surface — net GEX at spot, the gamma flip, call wall and put wall, and how to read the term structure.',
      },
      {
        href: '/help/platform/gex-summary',
        title: 'GEX Summary &amp; Greeks',
        blurb:
          'Headline GEX numbers plus delta, gamma, vanna and charm aggregates. What each tile is, why it matters, and what changes intraday.',
      },
      {
        href: '/help/platform/flow-analysis',
        title: 'Flow Analysis',
        blurb:
          'Premium-weighted and net-volume flow, smart-money buckets, the Lee-Ready aggressor split, and how to spot real conviction in the tape.',
      },
      {
        href: '/help/platform/smart-money',
        title: 'Smart Money',
        blurb:
          'The smart-money screen — what qualifies a trade as smart-money, how the C/P ratio is computed, and how to use the bias intraday.',
      },
      {
        href: '/help/platform/max-pain',
        title: 'Max Pain',
        blurb:
          'How max pain is calculated, when it acts as a magnet versus a coincidence, and how to read it next to the gamma profile.',
      },
      {
        href: '/help/platform/technicals',
        title: 'Technicals',
        blurb:
          'The intraday technical snapshot — price, candles, volatility gauges, and how the levels overlay the GEX walls.',
      },
    ],
  },
  {
    title: 'Strategy Tools',
    eyebrow: 'Build & test',
    icon: Calculator,
    entries: [
      {
        href: '/help/platform/options-calculator',
        title: 'Strategy Builder',
        blurb:
          'Build any single- or multi-leg options strategy. How the calculator prices, how greeks are computed, and how to read the P&amp;L scenarios.',
      },
      {
        href: '/help/platform/option-contracts',
        title: 'Live Options Quotes',
        blurb:
          'Browse the live chain. Filtering by expiry and moneyness, sorting columns, and how the IV surface lights the colors.',
      },
      {
        href: '/help/platform/backtesting',
        title: 'Backtesting',
        blurb:
          'How to run a backtest against historical signal scores, the parameter knobs, and how to read the equity curve and trade log.',
      },
    ],
  },
  {
    title: 'Account &amp; Billing',
    eyebrow: 'User & subscription',
    icon: UserCircle,
    entries: [
      {
        href: '/help/platform/account',
        title: 'Account Settings',
        blurb:
          'Email, password, linked sign-in providers (Google/Apple), tier and plan status, and how to manage them safely.',
      },
      {
        href: '/help/platform/billing',
        title: 'Billing &amp; Stripe Portal',
        blurb:
          'How billing works through Stripe, the difference between monthly and annual, switching tiers, payment methods, and invoices.',
      },
      {
        href: '/help/platform/referrals',
        title: 'Referrals',
        blurb:
          'How the referral program works — your code, your link, what counts as a referral, and how earned months land on your bill.',
      },
    ],
  },
  {
    title: 'Alerts &amp; Notifications',
    eyebrow: 'Stay informed',
    icon: Bell,
    entries: [
      {
        href: '/help/platform/alerts',
        title: 'Signal Alerts',
        blurb:
          'How signal triggers surface inside the platform, what fires versus what stays quiet, and how to use the Live Bulletin as your alert log.',
      },
      {
        href: '/help/platform/email-preferences',
        title: 'Email Preferences',
        blurb:
          'Marketing vs. transactional email, how verification works, and the safe way to turn each category on or off.',
      },
    ],
  },
  {
    title: 'API &amp; Data Access',
    eyebrow: 'For developers',
    icon: Key,
    entries: [
      {
        href: '/help/platform/api-access',
        title: 'API Access &amp; Keys (Pro)',
        blurb:
          'How to read the API docs, what your Pro tier unlocks, and the basic auth + rate-limit model.',
      },
      {
        href: '/help/platform/data-coverage',
        title: 'Data Coverage &amp; Refresh',
        blurb:
          'Supported symbols, market hours behavior, how often each surface updates, and what happens around holidays and half-days.',
      },
    ],
  },
  {
    title: 'Charts &amp; Reading the Data',
    eyebrow: 'Visual literacy',
    icon: LineChart,
    entries: [
      {
        href: '/help/platform/reading-charts',
        title: 'How to Read ZeroGEX Charts',
        blurb:
          'A shared visual vocabulary — colors, scales, hover behavior, legends, and the chart-specific notes for GEX profile, walls, and heatmaps.',
      },
      {
        href: '/help/platform/score-line',
        title: 'Reading the [-1, +1] Score Line',
        blurb:
          'Every signal score lives on the same number line. What sign and magnitude mean, when a 0 is a non-answer, and when to act.',
      },
    ],
  },
  {
    title: 'Streaming &amp; Performance',
    eyebrow: 'Under the hood',
    icon: Radio,
    entries: [
      {
        href: '/help/platform/streaming-and-performance',
        title: 'Streaming &amp; Performance',
        blurb:
          'How real-time updates reach your browser, what to do if a page feels stale, and the simple fixes for a slow connection.',
      },
      {
        href: '/help/platform/troubleshooting',
        title: 'Troubleshooting',
        blurb:
          'The short list — sign-in problems, missing data, stale charts, payment issues, browser caches, and when to email support.',
      },
    ],
  },
];

export default async function PlatformGuidePage() {
  const t = await getServerT(dict);
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/help" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        {t('backToHelp')}
      </Link>

      <div className="zg-feature-shell mb-10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <BookOpenCheck size={14} />
          {t('badge')}
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">{t('heading')}</h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          {t('intro')}
        </p>
      </div>

      <div className="space-y-10">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.title}>
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
                  <Icon size={18} />
                </span>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">{section.eyebrow}</div>
                  <h2 className="text-xl font-semibold text-[var(--color-text-primary)]" dangerouslySetInnerHTML={{ __html: section.title }} />
                </div>
              </div>

              <div className="space-y-3">
                {section.entries.map((entry) => (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    className="zg-feature-shell group flex flex-col gap-2 p-5 transition hover:border-[var(--color-warning-soft)] sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="flex-1">
                      <h3
                        className="mb-1 text-base font-semibold text-[var(--color-text-primary)]"
                        dangerouslySetInnerHTML={{ __html: entry.title }}
                      />
                      <p
                        className="text-sm leading-6 text-[var(--color-text-secondary)]"
                        dangerouslySetInnerHTML={{ __html: entry.blurb }}
                      />
                    </div>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)] transition group-hover:text-[var(--heat-low)] sm:pt-1">
                      {t('readLabel')}
                      <ArrowRight size={14} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
