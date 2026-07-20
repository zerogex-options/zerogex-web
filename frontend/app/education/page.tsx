import Link from 'next/link';
import { ArrowRight, BookOpen, Newspaper, GraduationCap, LifeBuoy } from 'lucide-react';
import { getServerT } from '@/core/localizedContent';
import { dict } from './page.i18n';
import { dict as metaDict } from './meta.i18n';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT(metaDict);
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/education' },
  };
}

const sections = [
  {
    href: '/articles',
    title: 'Articles',
    description:
      'Long-form, flow-focused breakdowns of market structure — gamma exposure, dealer hedging, options tape, and the signals built on top of them.',
    icon: Newspaper,
    available: true,
  },
  {
    href: '/guides',
    title: 'Guides',
    description:
      'Reference material you come back to. Start with "Signals: Explained" — every ZeroGEX signal, what it asks, and what its score means.',
    icon: GraduationCap,
    available: true,
  },
  {
    href: '/help',
    title: 'Help',
    description:
      'Platform Guide, FAQs, and Quick Start walkthroughs for getting the most out of the ZeroGEX platform.',
    icon: LifeBuoy,
    available: true,
  },
];

export default async function EducationHubPage() {
  const t = await getServerT(dict);
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="zg-feature-shell mb-10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <BookOpen size={14} />
          {t('badge')}
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">
          {t('heroTitle')}
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          {t('heroDescription')}{' '}
          <Link
            href="/spx-gamma-levels"
            className="font-semibold text-[var(--color-warning)] underline-offset-2 hover:underline"
          >
            {t('heroLinkText')}
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
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
                {!section.available && (
                  <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                    {t('underConstruction')}
                  </span>
                )}
              </div>
              <p className="mb-5 flex-1 text-sm leading-7 text-[var(--color-text-secondary)]">{section.description}</p>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)] transition group-hover:text-[var(--heat-low)]">
                {section.available ? t('explore') : t('preview')}
                <ArrowRight size={16} />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
