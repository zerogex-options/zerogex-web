'use client';

import PageShell from '@/components/layout/PageShell';
import GammaHeatmapCanvas from '@/components/GammaHeatmapCanvas';
import GexUnitToggle from '@/components/GexUnitToggle';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

export default function GexHeatmapPage() {
  const t = usePageT(dict);
  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">{t('heading')}</h1>
      <div className="mb-4">
        <GexUnitToggle />
      </div>
      <section className="mb-8">
        <GammaHeatmapCanvas />
      </section>
    </PageShell>
  );
}
