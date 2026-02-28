/**
 * Charts Page
 * Advanced visualization of GEX and options flow data
 */

'use client';

import GammaHeatmap from '@/components/GammaHeatmap';
import OptionsFlowChart from '@/components/OptionsFlowChart';

export default function ChartsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Advanced Charts</h1>

      {/* Options Flow Chart */}
      <section className="mb-8">
        <OptionsFlowChart />
      </section>

      {/* Gamma Heatmap */}
      <section className="mb-8">
        <GammaHeatmap />
      </section>
    </div>
  );
}
