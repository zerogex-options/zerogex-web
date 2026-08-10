'use client';

import PageShell from '@/components/layout/PageShell';
import GammaShiftLadder from '@/components/GammaShiftLadder';
import GexUnitToggle from '@/components/GexUnitToggle';
import StrikeFilterToggle from '@/components/StrikeFilterToggle';

export default function GammaShiftPage() {
  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gamma Shift</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Everyone else shows where dealer gamma sits <em>right now</em>. Gamma Shift shows how it{' '}
          <strong>changed</strong> between two points in time at every strike — so you can see which
          walls are <span style={{ color: 'var(--color-bull)' }}>building</span> and which are{' '}
          <span style={{ color: 'var(--color-bear)' }}>eroding</span> before price confirms it. Pick
          the two moments with the presets, or drag the A and B handles across the session.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <GexUnitToggle />
        <StrikeFilterToggle />
      </div>

      <section className="mb-8">
        <GammaShiftLadder />
      </section>
    </PageShell>
  );
}
