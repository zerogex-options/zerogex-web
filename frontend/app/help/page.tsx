import Link from 'next/link';
import {
  ArrowRight,
  LifeBuoy,
  BookOpenCheck,
  HelpCircle,
  PlayCircle,
  Search,
  Mail,
} from 'lucide-react';

export const metadata = {
  title: 'ZeroGEX Help Center: Platform Guide, FAQs & Quick Starts',
  description:
    'ZeroGEX Help Center — feature-by-feature platform walkthroughs, FAQs covering data, billing, signals, and account, plus short Quick Start video tutorials.',
  alternates: { canonical: '/help' },
};

const sections = [
  {
    href: '/help/platform',
    title: 'Platform Guide',
    description:
      'A complete tour of every page in ZeroGEX — Dashboard, Live Bulletin, Signals, Metrics, Strategy Tools, and more. Built so a new user can learn the platform without ever having to ask.',
    icon: BookOpenCheck,
    badge: 'Walkthroughs',
  },
  {
    href: '/help/faqs',
    title: 'FAQs',
    description:
      'Answers to the most common questions on data, billing, signals, account, supported symbols, refresh cadence, and the things that genuinely confuse first-time users.',
    icon: HelpCircle,
    badge: 'Quick answers',
  },
  {
    href: '/help/quickstarts',
    title: 'Quick Starts',
    description:
      'Short, focused video walkthroughs — 60-to-180-second clips that show you exactly how to read a chart, run a screen, or configure a feature. Watch and trade.',
    icon: PlayCircle,
    badge: 'Video tutorials',
  },
];

const popular = [
  { href: '/help/platform/dashboard', label: 'Reading the Dashboard' },
  { href: '/help/platform/signals-overview', label: 'How signals work end-to-end' },
  { href: '/help/faqs#data-refresh', label: 'How often does data refresh?' },
  { href: '/help/faqs#billing', label: 'Billing, refunds & cancellation' },
  { href: '/help/platform/options-calculator', label: 'Using the Strategy Builder' },
  { href: '/help/quickstarts#first-trade', label: 'Your first trade in ZeroGEX' },
];

export default function HelpCenterPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="zg-feature-shell mb-10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <LifeBuoy size={14} />
          Help Center
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">ZeroGEX Help Center</h1>
        <p className="mb-6 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          Everything you need to get the most out of ZeroGEX. Step-by-step walkthroughs for every
          page on the platform, plain-English answers to the questions traders ask most often, and
          short Quick Start videos for when you want to learn by watching.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/help/platform"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
          >
            <Search size={14} />
            Start with the Platform Guide
          </Link>
          <a
            href="mailto:support@zerogex.io"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
          >
            <Mail size={14} />
            Contact support
          </a>
        </div>
      </div>

      <div className="mb-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="zg-feature-shell group flex flex-col p-6 transition hover:border-[var(--color-warning-soft)]"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
                  <Icon size={20} />
                </span>
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{section.title}</h2>
              </div>
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
                {section.badge}
              </div>
              <p className="mb-5 flex-1 text-sm leading-7 text-[var(--color-text-secondary)]">{section.description}</p>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)] transition group-hover:text-[var(--heat-low)]">
                Explore
                <ArrowRight size={16} />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="zg-feature-shell p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
            <Search size={16} />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Popular topics</div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Most-visited help pages</h2>
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {popular.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-warning-soft)] hover:bg-[var(--color-warning-soft)]"
              >
                <span>{item.label}</span>
                <ArrowRight size={14} className="text-[var(--color-warning)] transition group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 zg-feature-shell p-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">Can&apos;t find what you need?</div>
        <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">Talk to a human</h2>
        <p className="mb-4 text-sm leading-7 text-[var(--color-text-secondary)]">
          The Help Center covers everything we&apos;ve documented so far — but real questions don&apos;t always
          fit a category. Email{' '}
          <a className="font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]" href="mailto:support@zerogex.io">
            support@zerogex.io
          </a>{' '}
          and we&apos;ll get back to you fast, usually the same trading day.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/about"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
          >
            About ZeroGEX
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/education"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
          >
            Education Hub
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
          >
            Pricing &amp; Plans
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
