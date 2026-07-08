'use client';

import { Zap } from 'lucide-react';
import { TrialButton, ComparePlansButton } from './TrialCtaButtons';

// Requirement #1 — the strong conversion block placed directly after the free
// delayed levels, before the product preview and educational content. Makes the
// "these are delayed; the live read is a click away" pitch to paid visitors
// without overselling: no profit claims, just what the live dashboard adds.
export default function LiveReadConversion({ symbol }: { symbol: string }) {
  return (
    <section
      aria-labelledby="live-read-heading"
      style={{
        border: '1px solid var(--color-brand-primary)55',
        background: 'linear-gradient(135deg, var(--color-brand-primary)14 0%, var(--color-surface) 100%)',
        borderRadius: 18,
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        marginBottom: 40,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          alignSelf: 'flex-start',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--color-brand-primary)',
          border: '1px solid var(--color-brand-primary)44',
          background: 'var(--color-brand-primary)14',
          borderRadius: 999,
          padding: '5px 14px',
        }}
      >
        <Zap size={12} /> Live dashboard
      </div>

      <h2
        id="live-read-heading"
        style={{ margin: 0, fontSize: 'clamp(24px, 3.2vw, 30px)', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.15 }}
      >
        These are the delayed free levels. Want the live read?
      </h2>

      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-secondary)', maxWidth: 720 }}>
        ZeroGEX updates in real time and adds the full GEX profile, strike-by-strike heatmaps, option flow, dealer
        positioning, and Market State signals for SPY, SPX, and QQQ &mdash; so you know the levels that matter before
        price gets there.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
        <TrialButton location="paid_landing_hero" symbol={symbol} />
        <ComparePlansButton location="paid_landing_hero" symbol={symbol} />
      </div>

      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--color-text-secondary)', opacity: 0.85 }}>
        7-day free trial. No charge until day 7. Cancel anytime.
      </p>
    </section>
  );
}
