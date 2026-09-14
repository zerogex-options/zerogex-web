'use client';

import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import MarketMakerExposures from '@/components/MarketMakerExposures';

export default function GexStrikeProfilePage() {
  return (
    <PageShell>
      <PageHeader
        title="GEX Strike Profile"
        sub="Dealer gamma strike by strike — which levels carry the book's weight, and which are empty."
        tooltip="Net GEX per strike from the live chain, so the walls and the gamma flip are visible as shape rather than as three numbers. Read the tall bars as the strikes where dealer hedging is most concentrated, not as levels anyone is obliged to defend: a wall is where flow would be largest if price got there, and large walls break regularly on days when a catalyst supplies flow that dwarfs hedging. Modeled estimate from open interest — decision-support context, not investment advice."
      />
      <section className="mb-8">
        <MarketMakerExposures />
      </section>
    </PageShell>
  );
}
