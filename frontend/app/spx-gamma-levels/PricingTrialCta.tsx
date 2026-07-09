'use client';

import { TrialButton, ComparePlansButton } from './TrialCtaButtons';

// The pricing/trial CTA that sits after the product preview and before the
// share block. Closes the page's conversion path with the standardized trial
// language. Kept distinct from the top LiveReadConversion block so the two read
// as "here's what's live" (top) and "here's how to start" (here), rather than
// the same pitch twice.
export default function PricingTrialCta({ symbol }: { symbol: string }) {
  return (
    <section
      aria-labelledby="pricing-trial-heading"
      style={{
        border: '1px solid var(--color-brand-primary)44',
        background: 'linear-gradient(135deg, var(--color-brand-primary)10 0%, var(--color-surface) 100%)',
        borderRadius: 18,
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        marginBottom: 40,
      }}
    >
      <h2
        id="pricing-trial-heading"
        style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.3px' }}
      >
        Start your 7-day free trial
      </h2>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-secondary)', maxWidth: 720 }}>
        You&rsquo;ve seen the structural map. The live ZeroGEX dashboard adds the real-time refresh, the full GEX
        profile, the strike-by-DTE heatmap, options-flow classification, and the 13-signal Market State Index &mdash;
        the context that turns these levels into a read you can trade around.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
        <TrialButton location="paid_landing_footer" symbol={symbol} />
        <ComparePlansButton location="paid_landing_footer" symbol={symbol} />
      </div>
      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--color-text-secondary)', opacity: 0.85 }}>
        7-day free trial. No charge until day 7. Cancel anytime.
      </p>
    </section>
  );
}
