'use client';

import MarketMakerExposures from '@/components/MarketMakerExposures';

export default function StrikeProfilePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Strike Profile</h1>
      <MarketMakerExposures />
    </div>
  );
}
