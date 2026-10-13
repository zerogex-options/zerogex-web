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
        sub="Dealer gamma as a grid&nbsp;- strike against time, so concentration shows up as color."
        tooltip="The same Net GEX the strike profile plots, laid out as strike (vertical) against session time (horizontal). Bright bands are strikes carrying heavy dealer gamma. The positions behind them are fixed through the session (open interest updates once a day, after the close), so a band that brightens during the session is mostly price moving toward that strike, where its options' gamma peaks, not new positioning. A change from one session to the next does include new open interest. The unit toggle switches between $ gamma per 1% spot move and per 1 point&nbsp;- same exposure, different denominator."
        actions={<GexUnitToggle />}
      />
      <section className="mb-8">
        <GammaHeatmapCanvas />
      </section>
    </PageShell>
  );
}
