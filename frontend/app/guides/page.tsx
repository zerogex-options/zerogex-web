import Link from 'next/link';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { getServerT } from '@/core/localizedContent';
import { dict } from './page.i18n';
import { dict as metaDict } from './meta.i18n';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT(metaDict);
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/guides' },
  };
}

export default async function GuidesPage() {
  const t = await getServerT(dict);
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="zg-feature-shell mb-10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <GraduationCap size={14} />
          {t('badge')}
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">{t('title')}</h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          {t('intro')}
        </p>
      </div>

      <div className="space-y-6">
        <div className="zg-feature-shell p-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">{t('referenceGuide')}</div>
          <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
            {t('signalsTitle')}
          </h2>
          <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
            {t('signalsBody')}
          </p>
          <Link
            href="/guides/signals-explained"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
          >
            {t('readGuide')}
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="zg-feature-shell p-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">{t('referenceGuide')}</div>
          <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
            {t('gammaFlipTitle')}
          </h2>
          <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
            {t('gammaFlipBody')}
          </p>
          <Link
            href="/guides/gamma-flip-calculation-before-vs-after"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)] transition hover:bg-[var(--color-warning-soft)]"
          >
            {t('readGuide')}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
