'use client';

import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import GammaHeatmapCanvas from '@/components/GammaHeatmapCanvas';
import GexUnitToggle from '@/components/GexUnitToggle';

export default function GexHeatmapPage() {
  return (
    <PageShell>
      <PageHeader
        title="GEX Heatmap"
        sub="Dealer gamma as a grid&nbsp;- strike against time, so concentration shows up as colour."
        tooltip="The same Net GEX the strike profile plots, laid out as strike (vertical) against session time (horizontal) so you can watch positioning build or erode where price is actually trading. Bright bands are strikes carrying heavy dealer gamma; a band that brightens through the session is positioning accumulating there, not price visiting it. The unit toggle switches between $ gamma per 1% spot move and per 1 point&nbsp;- same exposure, different denominator."
        actions={<GexUnitToggle />}
      />
      <section className="mb-8">
        <GammaHeatmapCanvas />
      </section>
    </PageShell>
  );
}
