'use client';

import PageShell from '@/components/layout/PageShell';
import MarketMakerExposures from '@/components/MarketMakerExposures';

export default function GexStrikeProfilePage() {
  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">GEX Strike Profile</h1>
      <section className="mb-8">
        <MarketMakerExposures />
      </section>
    </PageShell>
  );
}
