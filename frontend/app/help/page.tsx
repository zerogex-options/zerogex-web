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
import { getServerT } from '@/core/localizedContent';
import { dict } from './page.i18n';
import { dict as metaDict } from './meta.i18n';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT(metaDict);
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/help' },
  };
}

const sections = [
  {
    href: '/help/platform',
    titleKey: 'platformTitle',
    descriptionKey: 'platformDesc',
    icon: BookOpenCheck,
    badgeKey: 'platformBadge',
  },
  {
    href: '/help/faqs',
    titleKey: 'faqTitle',
    descriptionKey: 'faqDesc',
    icon: HelpCircle,
    badgeKey: 'faqBadge',
  },
  {
    href: '/help/quickstarts',
    titleKey: 'quickstartsTitle',
    descriptionKey: 'quickstartsDesc',
    icon: PlayCircle,
    badgeKey: 'quickstartsBadge',
  },
] as const;

const popular = [
  { href: '/help/platform/dashboard', labelKey: 'dashboardLabel' },
  { href: '/help/platform/signals-overview', labelKey: 'signalsLabel' },
  { href: '/help/faqs#data-refresh', labelKey: 'dataRefreshLabel' },
  { href: '/help/faqs#billing', labelKey: 'billingLabel' },
  { href: '/help/platform/options-calculator', labelKey: 'strategyBuilderLabel' },
  { href: '/help/quickstarts#first-trade', labelKey: 'firstTradeLabel' },
] as const;

export default async function HelpCenterPage() {
  const t = await getServerT(dict);
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="zg-feature-shell mb-10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <LifeBuoy size={14} />
          {t('badgeText')}
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">{t('h1Title')}</h1>
        <p className="mb-6 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          {t('introP')}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/help/platform"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
          >
            <Search size={14} />
            {t('ctaStart')}
          </Link>
          <a
            href="mailto:support@zerogex.io"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
          >
            <Mail size={14} />
            {t('ctaContact')}
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
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{t(section.titleKey)}</h2>
              </div>
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
                {t(section.badgeKey)}
              </div>
              <p className="mb-5 flex-1 text-sm leading-7 text-[var(--color-text-secondary)]">{t(section.descriptionKey)}</p>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)] transition group-hover:text-[var(--heat-low)]">
                {t('exploreLabel')}
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
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">{t('popularTopics')}</div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('mostVisited')}</h2>
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {popular.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-warning-soft)] hover:bg-[var(--color-warning-soft)]"
              >
                <span>{t(item.labelKey)}</span>
                <ArrowRight size={14} className="text-[var(--color-warning)] transition group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 zg-feature-shell p-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">{t('cantFind')}</div>
        <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">{t('talkHuman')}</h2>
        <p className="mb-4 text-sm leading-7 text-[var(--color-text-secondary)]">
          {t('supportP1')}{' '}
          <a className="font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]" href="mailto:support@zerogex.io">
            support@zerogex.io
          </a>{' '}
          {t('supportP2')}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/about"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
          >
            {t('aboutLabel')}
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/education"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
          >
            {t('educationLabel')}
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
          >
            {t('pricingLabel')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
