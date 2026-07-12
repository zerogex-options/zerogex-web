'use client';

import PageShell from '@/components/layout/PageShell';
import GammaHeatmapCanvas from '@/components/GammaHeatmapCanvas';
import GexUnitToggle from '@/components/GexUnitToggle';

export default function GexHeatmapPage() {
  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">GEX Heatmap</h1>
      <div className="mb-4">
        <GexUnitToggle />
      </div>
      <section className="mb-8">
        <GammaHeatmapCanvas />
      </section>
    </PageShell>
  );
}
