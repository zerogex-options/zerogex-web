'use client';

import { CheckCircle2, LineChart } from 'lucide-react';
import { TelemetryEvent } from '@/core/telemetry/events';
import { TrialButton } from './TrialCtaButtons';

// Requirement #5 — a preview of what a subscriber actually gets inside the live
// dashboard. Reuses the existing dashboard screenshot already shipped for the
// blog/articles (/blog/zerogex-dashboard-overview.png, synced by
// `make blog-images`) rather than introducing a new asset or dependency. The
// feature list is the concrete inventory of live tools, framed as "the levels
// that matter" — no performance or profit claims.

const FEATURES: { label: string; detail: string }[] = [
  { label: 'Real-time SPY/SPX/QQQ gamma levels', detail: 'Sub-second refresh, not a 15-minute snapshot' },
  { label: 'Gamma Flip', detail: 'The regime line, live as spot moves across it' },
  { label: 'Call Wall & Put Wall', detail: 'Where price may pin, reject, or accelerate' },
  { label: 'Max Pain', detail: 'The expiration magnet, tracked intraday' },
  { label: 'Net GEX / Dealer Positioning', detail: 'Whether hedging is dampening or amplifying moves' },
  { label: 'Strike-level GEX profile', detail: 'The full dealer-gamma curve, strike by strike' },
  { label: 'GEX heatmaps', detail: 'Strike-by-DTE gamma, visualized' },
  { label: 'Options flow classification', detail: 'Live tape sorted into directional pressure' },
  { label: 'Market State / signal tools', detail: 'The 13-signal composite regime read' },
];

export default function DashboardPreview({ symbol }: { symbol: string }) {
  return (
    <section
      aria-labelledby="dashboard-preview-heading"
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 18,
        padding: '28px',
        marginBottom: 40,
        background: 'var(--color-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--color-brand-primary)',
            border: '1px solid var(--color-brand-primary)44',
            background: 'var(--color-brand-primary)14',
            borderRadius: 999,
            padding: '5px 14px',
            marginBottom: 14,
          }}
        >
          <LineChart size={12} /> Inside the live dashboard
        </div>
        <h2
          id="dashboard-preview-heading"
          style={{ margin: '0 0 10px 0', fontSize: 24, fontWeight: 800, letterSpacing: '-0.3px' }}
        >
          What you get with the live {symbol} dashboard
        </h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-secondary)', maxWidth: 720 }}>
          The free levels above are the map. The live dashboard is the real-time terrain &mdash; the same levels that
          can shape intraday price action, updating as the session moves, with the tools to see where price may pin,
          reject, accelerate, or chop.
        </p>
      </div>

      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {FEATURES.map((f) => (
          <li key={f.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <CheckCircle2 size={18} style={{ color: 'var(--color-brand-primary)', marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                {f.label}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginTop: 2 }}>
                {f.detail}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
        <TrialButton
          location="dashboard_preview"
          symbol={symbol}
          event={TelemetryEvent.DashboardPreviewCtaClick}
        />
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', opacity: 0.85 }}>
          7-day free trial. No charge until day 7. Cancel anytime.
        </span>
      </div>
    </section>
  );
}
