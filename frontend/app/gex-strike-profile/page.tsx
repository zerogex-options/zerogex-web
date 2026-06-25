'use client';

import MarketMakerExposures from '@/components/MarketMakerExposures';

export default function GexStrikeProfilePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">GEX Strike Profile</h1>
      <section className="mb-8">
        <MarketMakerExposures />
      </section>
    </div>
  );
}
