'use client';

import { Check, Minus } from 'lucide-react';

// Side-by-side feature comparison surfaced on /pricing and /founding. The
// source of truth for what each tier actually unlocks is the route table in
// frontend/core/auth.ts and the nav config in frontend/core/navigation.ts —
// keep these rows in sync with those when access rules change.
const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  accent: 'var(--color-brand-accent)',
  border: 'var(--border-default)',
};

type Row = { feature: string; basic: boolean; pro: boolean };
type Section = { heading: string; rows: Row[] };

const SECTIONS: Section[] = [
  {
    heading: 'Dashboard & Live Feed',
    rows: [
      { feature: 'Real-time Dashboard', basic: true, pro: true },
      { feature: 'Live Bulletin (streaming signal events)', basic: true, pro: true },
    ],
  },
  {
    heading: 'Basic Signals',
    rows: [
      { feature: 'Tape Flow Bias', basic: true, pro: true },
      { feature: 'Skew Delta', basic: true, pro: true },
      { feature: 'Vanna / Charm Flow', basic: true, pro: true },
      { feature: 'Dealer Delta Pressure', basic: true, pro: true },
      { feature: 'GEX Gradient', basic: true, pro: true },
      { feature: 'Positioning Trap', basic: true, pro: true },
    ],
  },
  {
    heading: 'Advanced Signals',
    rows: [
      { feature: 'Composite Score (blended read across signals)', basic: false, pro: true },
      { feature: 'Volatility Expansion', basic: false, pro: true },
      { feature: 'EOD Pressure', basic: false, pro: true },
      { feature: 'Squeeze Setup', basic: false, pro: true },
      { feature: 'Trap Detection', basic: false, pro: true },
      { feature: '0DTE Position Imbalance', basic: false, pro: true },
      { feature: 'Gamma / VWAP Confluence', basic: false, pro: true },
      { feature: 'Range Break Imminence', basic: false, pro: true },
      { feature: 'Market Pressure Index', basic: false, pro: true },
    ],
  },
  {
    heading: 'Metrics',
    rows: [
      { feature: 'Dealer Positioning', basic: true, pro: true },
      { feature: 'GEX Summary', basic: true, pro: true },
      { feature: 'GEX Strike Profile', basic: true, pro: true },
      { feature: 'GEX Heatmap', basic: true, pro: true },
      { feature: 'Flow Analysis', basic: true, pro: true },
      { feature: 'Smart Money', basic: true, pro: true },
      { feature: 'Max Pain', basic: true, pro: true },
      { feature: 'Technicals', basic: true, pro: true },
    ],
  },
  {
    heading: 'Strategy Tools',
    rows: [
      { feature: 'Strategy Builder (options pricing & P&L)', basic: true, pro: true },
      { feature: 'Live Options Quotes', basic: true, pro: true },
      { feature: 'Premium Surface (beta)', basic: true, pro: true },
      { feature: 'Backtesting (beta)', basic: false, pro: true },
    ],
  },
  {
    heading: 'Platform',
    rows: [
      { feature: 'Education, Guides & Help Center', basic: true, pro: true },
      { feature: 'Direct access to ZeroGEX APIs', basic: false, pro: true },
    ],
  },
];

function Cell({ included, tone }: { included: boolean; tone: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {included ? (
        <Check size={18} strokeWidth={3} style={{ color: tone }} aria-label="Included" />
      ) : (
        <Minus size={18} strokeWidth={3} style={{ color: C.muted, opacity: 0.5 }} aria-label="Not included" />
      )}
    </div>
  );
}

export default function PlanComparison() {
  return (
    <section
      aria-labelledby="plan-comparison-heading"
      style={{
        marginTop: 36,
        maxWidth: 820,
        marginLeft: 'auto',
        marginRight: 'auto',
        background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: 28,
      }}
    >
      <h2
        id="plan-comparison-heading"
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          color: C.light,
          letterSpacing: '-0.3px',
        }}
      >
        What&rsquo;s included
      </h2>
      <p style={{ margin: '8px 0 20px', color: C.muted, fontSize: 14, lineHeight: 1.6 }}>
        Quick side-by-side of every page each tier unlocks.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 88px 88px',
          alignItems: 'center',
          padding: '10px 4px',
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: C.muted,
        }}
      >
        <div>Feature</div>
        <div style={{ textAlign: 'center', color: C.amber }}>Basic</div>
        <div style={{ textAlign: 'center', color: C.accent }}>Pro</div>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.heading} style={{ marginTop: 18 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: C.light,
              padding: '6px 4px',
            }}
          >
            {section.heading}
          </div>
          {section.rows.map((row) => (
            <div
              key={row.feature}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 88px 88px',
                alignItems: 'center',
                padding: '10px 4px',
                borderTop: `1px solid ${C.border}`,
                fontSize: 14,
                color: C.muted,
                lineHeight: 1.45,
              }}
            >
              <div style={{ color: C.light, fontWeight: 500 }}>{row.feature}</div>
              <Cell included={row.basic} tone={C.amber} />
              <Cell included={row.pro} tone={C.accent} />
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
