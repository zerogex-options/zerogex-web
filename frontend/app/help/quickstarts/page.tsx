import Link from 'next/link';
import { ArrowLeft, ArrowRight, PlayCircle, Clock, Bookmark } from 'lucide-react';
import { getServerT } from '@/core/localizedContent';
import { dict } from './page.i18n';
import { dict as metaDict } from './meta.i18n';
import type { Metadata } from 'next';

type T = (key: string, vars?: Record<string, string | number>) => string;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT(metaDict);
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/help/quickstarts' },
  };
}

type Walkthrough = {
  id: string;
  title: string;
  blurb: string;
  duration: string;
  level: 'New trader' | 'Returning' | 'Advanced';
  tag: string;
  status: 'live' | 'coming-soon';
  href?: string;
};

type Track = {
  id: string;
  title: string;
  blurb: string;
  walkthroughs: Walkthrough[];
};

const tracks: Track[] = [
  {
    id: 'first-trade',
    title: 'Onboarding',
    blurb: 'Your first 15 minutes — sign up, orient, find the page you need.',
    walkthroughs: [
      {
        id: 'tour',
        title: 'ZeroGEX in 90 seconds',
        blurb: 'A high-altitude tour of the platform — the sidebar, the dashboard, the signals, the bulletin. Watch this first.',
        duration: '1:30',
        level: 'New trader',
        tag: 'Orientation',
        status: 'coming-soon',
      },
      {
        id: 'first-trade',
        title: 'Your first trade in ZeroGEX',
        blurb: 'From the morning open to a structured trade on SPX — the workflow a working ZeroGEX user runs daily.',
        duration: '3:10',
        level: 'New trader',
        tag: 'Workflow',
        status: 'coming-soon',
      },
      {
        id: 'sign-up-and-set-up',
        title: 'Sign up, verify, and configure preferences',
        blurb: 'The account setup happy path — Google or email, email verification, theme, default symbol.',
        duration: '1:45',
        level: 'New trader',
        tag: 'Account',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'dashboard-and-bulletin',
    title: 'Dashboard &amp; Bulletin',
    blurb: 'The two pages you keep open all day.',
    walkthroughs: [
      {
        id: 'reading-dashboard',
        title: 'Reading the Dashboard in 30 seconds',
        blurb: 'The discipline of a morning read — regime, net GEX, walls, composite, trade bias. The right order.',
        duration: '2:20',
        level: 'New trader',
        tag: 'Dashboard',
        status: 'coming-soon',
      },
      {
        id: 'bulletin-tour',
        title: 'Live Bulletin tour',
        blurb: 'Filtering by symbol and signal family, reading a trigger row, using it as your day\'s audit log.',
        duration: '2:00',
        level: 'New trader',
        tag: 'Live Bulletin',
        status: 'coming-soon',
      },
      {
        id: 'regime-cues',
        title: 'Spotting regime changes early',
        blurb: 'The cues that say "we are about to flip" — heatmap migration, vol expansion, walls drifting.',
        duration: '2:45',
        level: 'Returning',
        tag: 'Dashboard',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'signals',
    title: 'Signals',
    blurb: 'Reading the score line, the cards, and the triggers.',
    walkthroughs: [
      {
        id: 'score-line',
        title: 'Reading the [-1, +1] score line',
        blurb: 'Sign, magnitude, when a 0 is a non-answer, and the trade-bias chip that changes the meaning of the score.',
        duration: '2:30',
        level: 'New trader',
        tag: 'Signals',
        status: 'coming-soon',
      },
      {
        id: 'basic-vs-advanced',
        title: 'Basic vs Advanced signals',
        blurb: 'Why some signals trigger and some just weight the composite. How the distinction changes how you use them.',
        duration: '2:15',
        level: 'New trader',
        tag: 'Signals',
        status: 'coming-soon',
      },
      {
        id: 'composite-walkthrough',
        title: 'Using the Composite Score',
        blurb: 'How to read the MSI gauge, the contributing-signals panel, and when the composite is unhelpful.',
        duration: '2:50',
        level: 'Returning',
        tag: 'Composite Score',
        status: 'coming-soon',
      },
      {
        id: 'eod-pressure',
        title: 'Trading the close with EOD Pressure',
        blurb: 'The 14:30 → 15:45 ramp, the trigger, and the trade bias chip in the final 90 minutes.',
        duration: '3:00',
        level: 'Returning',
        tag: 'EOD Pressure',
        status: 'coming-soon',
      },
      {
        id: 'squeeze-setup',
        title: 'Squeeze Setup: coiled markets',
        blurb: 'What "coiled" means, the five inputs that drive the score, and when to use it as a precondition filter.',
        duration: '2:40',
        level: 'Returning',
        tag: 'Squeeze Setup',
        status: 'coming-soon',
      },
      {
        id: 'trap-detection',
        title: 'Trap Detection: fading failed breakouts',
        blurb: 'Reading the score after a break of the call wall or put wall — when the snap-back is the trade.',
        duration: '2:55',
        level: 'Returning',
        tag: 'Trap Detection',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'metrics',
    title: 'Metrics &amp; Structure',
    blurb: 'The structural pages — GEX, flow, max pain, technicals.',
    walkthroughs: [
      {
        id: 'dealer-positioning-tour',
        title: 'Dealer Positioning tour',
        blurb: 'The GEX profile, the walls chart, the strike × DTE heatmap, and what the regime header tells you.',
        duration: '3:00',
        level: 'New trader',
        tag: 'Dealer Positioning',
        status: 'coming-soon',
      },
      {
        id: 'reading-the-flip',
        title: 'Reading the gamma flip',
        blurb: 'How to interpret distance-to-flip, why it matters, and how dealer behavior changes when you cross.',
        duration: '2:35',
        level: 'Returning',
        tag: 'Dealer Positioning',
        status: 'coming-soon',
      },
      {
        id: 'flow-analysis',
        title: 'Flow Analysis in practice',
        blurb: 'Premium-weighted flow vs. net volume vs. directional flow — when each matters and why.',
        duration: '2:50',
        level: 'Returning',
        tag: 'Flow',
        status: 'coming-soon',
      },
      {
        id: 'smart-money',
        title: 'Reading the Smart Money screen',
        blurb: 'What qualifies as smart money, the C/P ratio, and how to use the bias intraday.',
        duration: '2:30',
        level: 'Returning',
        tag: 'Smart Money',
        status: 'coming-soon',
      },
      {
        id: 'max-pain',
        title: 'Max Pain: magnet or coincidence?',
        blurb: 'When max pain is reliable, when it is not, and how to read it next to the wall structure.',
        duration: '2:20',
        level: 'New trader',
        tag: 'Max Pain',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'strategy',
    title: 'Strategy Tools',
    blurb: 'Building, pricing, and stress-testing positions.',
    walkthroughs: [
      {
        id: 'strategy-builder',
        title: 'Strategy Builder walkthrough',
        blurb: 'Building a vertical, a calendar, and a 1-by-2 — and reading the P&amp;L surface for each.',
        duration: '3:10',
        level: 'Returning',
        tag: 'Strategy Builder',
        status: 'coming-soon',
      },
      {
        id: 'live-chain',
        title: 'Browsing the live options chain',
        blurb: 'Filtering, sorting, IV-surface coloring, and how to spot where OI is stacked.',
        duration: '2:15',
        level: 'New trader',
        tag: 'Live Options Quotes',
        status: 'coming-soon',
      },
      {
        id: 'backtest-a-rule',
        title: 'Running your first backtest',
        blurb: 'Setting up a single-signal rule, reading the equity curve, and the out-of-sample discipline.',
        duration: '3:20',
        level: 'Advanced',
        tag: 'Backtesting',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'account-and-billing',
    title: 'Account &amp; Billing',
    blurb: 'The administrative basics.',
    walkthroughs: [
      {
        id: 'manage-subscription',
        title: 'Managing your subscription',
        blurb: 'Upgrading from Basic to Pro, switching to annual, updating payment method, and cancelling cleanly.',
        duration: '1:50',
        level: 'New trader',
        tag: 'Billing',
        status: 'coming-soon',
      },
      {
        id: 'linked-providers',
        title: 'Linking Google or Apple sign-in',
        blurb: 'Adding a sign-in provider, setting a password as fallback, and safely unlinking.',
        duration: '1:30',
        level: 'New trader',
        tag: 'Account',
        status: 'coming-soon',
      },
      {
        id: 'referrals',
        title: 'Using your referral code',
        blurb: 'Where to find it, how credits land on your bill, and the rules of the program.',
        duration: '1:40',
        level: 'New trader',
        tag: 'Referrals',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'api',
    title: 'API &amp; Developer',
    blurb: 'For Pro subscribers using the data programmatically.',
    walkthroughs: [
      {
        id: 'api-keys',
        title: 'Generating an API key',
        blurb: 'The Pro key flow — generation, scoping, rotation, and the "copy now" pitfall.',
        duration: '1:35',
        level: 'Advanced',
        tag: 'API',
        status: 'coming-soon',
      },
      {
        id: 'first-api-call',
        title: 'Your first API call',
        blurb: 'A working request against the GEX summary endpoint, with rate-limit handling and a JSON walkthrough.',
        duration: '3:00',
        level: 'Advanced',
        tag: 'API',
        status: 'coming-soon',
      },
    ],
  },
];

function levelStyle(level: Walkthrough['level']) {
  switch (level) {
    case 'New trader':
      return 'border-[var(--color-bull)] text-[var(--color-bull)] bg-[var(--color-bull-soft)]';
    case 'Returning':
      return 'border-[var(--color-warning)] text-[var(--color-warning)] bg-[var(--color-warning-soft)]';
    case 'Advanced':
      return 'border-[var(--color-info)] text-[var(--color-info)] bg-[var(--color-info-soft)]';
  }
}

function WalkthroughCard({ wt, t }: { wt: Walkthrough; t: T }) {
  const isComingSoon = wt.status === 'coming-soon';
  return (
    <div
      id={wt.id}
      className={`zg-feature-shell group flex flex-col overflow-hidden transition ${
        isComingSoon ? '' : 'hover:border-[var(--color-warning-soft)]'
      }`}
    >
      <div className="relative flex aspect-video items-center justify-center border-b border-[var(--color-border)] bg-gradient-to-br from-[var(--color-warning-soft)] via-[var(--bg-card)] to-[var(--color-info-soft)]">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-warning-soft)] bg-[var(--bg-card)] text-[var(--color-warning)] shadow-sm">
          <PlayCircle size={32} />
        </span>
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--bg-card)] px-2.5 py-1 text-[10px] font-semibold text-[var(--color-text-secondary)]">
          <Clock size={10} />
          {wt.duration}
        </div>
        {isComingSoon && (
          <div className="absolute left-3 top-3 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
            {t('comingSoon')}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${levelStyle(wt.level)}`}>
            {wt.level}
          </span>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
            {wt.tag}
          </span>
        </div>
        <h3 className="mb-2 text-base font-semibold text-[var(--color-text-primary)]" dangerouslySetInnerHTML={{ __html: wt.title }} />
        <p className="mb-4 flex-1 text-sm leading-6 text-[var(--color-text-secondary)]" dangerouslySetInnerHTML={{ __html: wt.blurb }} />
        {isComingSoon ? (
          <div className="text-xs font-semibold text-[var(--color-text-secondary)]">
            {t('recordingNotice')}
          </div>
        ) : wt.href ? (
          <Link
            href={wt.href}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]"
          >
            {t('watch')}
            <ArrowRight size={14} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default async function QuickStartsPage() {
  const t = await getServerT(dict);
  const totalCount = tracks.reduce((sum, track) => sum + track.walkthroughs.length, 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/help" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        <ArrowLeft size={14} />
        {t('backToHelp')}
      </Link>

      <div className="zg-feature-shell mb-10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <PlayCircle size={14} />
          {t('badge')}
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">{t('heroTitle')}</h1>
        <p className="mb-6 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          {t('heroDescription')}
        </p>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="rounded-full border border-[var(--color-border)] bg-[var(--bg-card)] px-3 py-1.5 font-semibold text-[var(--color-text-secondary)]">
            {t('totalCount', { count: totalCount })}
          </div>
          <div className="rounded-full border border-[var(--color-border)] bg-[var(--bg-card)] px-3 py-1.5 font-semibold text-[var(--color-text-secondary)]">
            {t('trackCount', { count: tracks.length })}
          </div>
          <div className="rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1.5 font-semibold text-[var(--color-warning)]">
            <Bookmark size={11} className="-mt-0.5 mr-1 inline" />
            {t('bookmarkThisPage')}
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] p-5">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">{t('rollingLaunchTitle')}</h3>
        <p className="text-sm leading-6 text-[var(--color-text-primary)]">
          {t('rollingLaunchIntro')}
          <Link href="/help/platform" className="font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
            {t('platformGuide')}
          </Link>
          {t('rollingLaunchMid')}
          <Link href="/help/faqs" className="font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
            {t('faqs')}
          </Link>
          {t('rollingLaunchEnd')}
        </p>
      </div>

      <div className="space-y-10">
        {tracks.map((track) => (
          <section key={track.id} id={track.id}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]" dangerouslySetInnerHTML={{ __html: track.title }} />
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{track.blurb}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {track.walkthroughs.map((wt) => (
                <WalkthroughCard key={wt.id} wt={wt} t={t} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="zg-feature-shell mt-12 p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">{t('requestTitle')}</h2>
        <p className="mb-4 text-sm leading-7 text-[var(--color-text-secondary)]">
          {t('requestBodyStart')}
          <a className="font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]" href="mailto:support@zerogex.io">
            support@zerogex.io
          </a>
          {t('requestBodyEnd')}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/help/platform"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)]"
          >
            {t('platformGuide')}
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/help/faqs"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            {t('faqs')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
