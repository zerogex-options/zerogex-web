'use client';

import GammaHeatmapCanvas from '@/components/GammaHeatmapCanvas';
import GexUnitToggle from '@/components/GexUnitToggle';

export default function GexHeatmapPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">GEX Heatmap</h1>
      <div className="mb-4">
        <GexUnitToggle />
      </div>
      <section className="mb-8">
        <GammaHeatmapCanvas />
      </section>
    </div>
  );
}
