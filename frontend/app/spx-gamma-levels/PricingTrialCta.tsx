'use client';

import { TrialButton, ComparePlansButton } from './TrialCtaButtons';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './PricingTrialCta.i18n';

// The pricing/trial CTA that sits after the product preview and before the
// share block. Closes the page's conversion path with the standardized trial
// language. Kept distinct from the top LiveReadConversion block so the two read
// as "here's what's live" (top) and "here's how to start" (here), rather than
// the same pitch twice.
export default function PricingTrialCta({ symbol }: { symbol: string }) {
  const t = usePageT(dict);
  return (
    <section
      aria-labelledby="pricing-trial-heading"
      className="zg-panel"
      style={{
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
        {t('heading')}
      </h2>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-secondary)', maxWidth: 720 }}>
        {t('body')}
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
        <TrialButton location="paid_landing_footer" symbol={symbol} />
        <ComparePlansButton location="paid_landing_footer" symbol={symbol} />
      </div>
      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--color-text-secondary)', opacity: 0.85 }}>
        {t('disclaimer')}
      </p>
    </section>
  );
}
