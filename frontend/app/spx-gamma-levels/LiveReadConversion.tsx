'use client';

import { Zap } from 'lucide-react';
import { TrialButton, ComparePlansButton } from './TrialCtaButtons';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './LiveReadConversion.i18n';

// Requirement #1 — the strong conversion block placed directly after the free
// delayed levels, before the product preview and educational content. Makes the
// "these are delayed; the live read is a click away" pitch to paid visitors
// without overselling: no profit claims, just what the live dashboard adds.
export default function LiveReadConversion({ symbol }: { symbol: string }) {
  const t = usePageT(dict);
  return (
    <section
      aria-labelledby="live-read-heading"
      className="zg-panel"
      style={{
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        marginBottom: 40,
      }}
    >
      <div
        className="zg-eyebrow"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          alignSelf: 'flex-start',
          color: 'var(--color-brand-primary)',
        }}
      >
        <Zap size={12} /> {t('eyebrow')}
      </div>

      <h2
        id="live-read-heading"
        style={{ margin: 0, fontSize: 'clamp(24px, 3.2vw, 30px)', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.15 }}
      >
        {t('heading')}
      </h2>

      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-secondary)', maxWidth: 720 }}>
        {t('body')}
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
        <TrialButton location="paid_landing_hero" symbol={symbol} />
        <ComparePlansButton location="paid_landing_hero" symbol={symbol} />
      </div>

      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--color-text-secondary)', opacity: 0.85 }}>
        {t('trialNote')}
      </p>
    </section>
  );
}
