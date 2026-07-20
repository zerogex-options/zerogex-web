'use client';

import PageShell from '@/components/layout/PageShell';
import MarketMakerExposures from '@/components/MarketMakerExposures';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

export default function GexStrikeProfilePage() {
  const t = usePageT(dict);
  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      <section className="mb-8">
        <MarketMakerExposures />
      </section>
    </PageShell>
  );
}
