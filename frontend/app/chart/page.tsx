'use client';

/**
 * The Gamma Chart — ZeroGEX's flagship, proprietary charting surface.
 *
 * Every retail trader already has candles. What they don't have is candles
 * with the dealer-gamma structure drawn inline: the Gamma Flip that splits the
 * pinning regime from the trending one, the Call/Put Walls that act as magnets
 * and brakes, Max Pain, and a live silhouette of net dealer gamma by price.
 * This page is the destination for that instrument — the reason to open ZeroGEX
 * instead of a generic charting tool.
 */

import Link from 'next/link';
import { ArrowRight, Gauge, Layers, LineChart, Sparkles, Target, Waves } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import GammaTerminalChart from '@/components/GammaTerminalChart';

const EDGE_CARDS: Array<{ icon: React.ReactNode; accent: string; title: string; body: string }> = [
  {
    icon: <Gauge size={18} />,
    accent: 'var(--heat-mid)',
    title: 'Gamma Flip',
    body: 'The price where dealer gamma flips sign. Above it, dealers dampen moves (pinning); below it, they amplify them (trending). It is the single most important line on the chart — and it is drawn for you.',
  },
  {
    icon: <Target size={18} />,
    accent: 'var(--color-bull)',
    title: 'Call & Put Walls',
    body: 'The strikes carrying the heaviest dealer gamma. They behave like magnets and brakes: price gets pinned toward them into expiry and often reverses off them. We plot both, live, right on the tape.',
  },
  {
    icon: <Waves size={18} />,
    accent: 'var(--color-navy)',
    title: 'Gamma Structure Rail',
    body: 'A silhouette of net dealer gamma at every price, aligned to the y-axis. The walls literally bulge out beside the candles, so you see support and resistance as structure — not lines you drew by hand.',
  },
  {
    icon: <Layers size={18} />,
    accent: 'var(--color-accent-hot)',
    title: 'Regime Zones',
    body: 'The backdrop is tinted by regime — long-gamma pinning above the flip, short-gamma trending below. One glance tells you whether to fade extremes or ride momentum.',
  },
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</span>
      <span className="zg-eyebrow" style={{ fontSize: 10, marginTop: 2 }}>{label}</span>
    </div>
  );
}

export default function GammaChartPage() {
  return (
    <PageShell width="wide">
      {/* Hero */}
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} style={{ color: 'var(--color-brand-primary)' }} />
          <span className="zg-eyebrow" style={{ color: 'var(--color-brand-primary)' }}>
            Proprietary · ZeroGEX only
          </span>
        </div>
        <h1 className="zg-h1" style={{ marginBottom: 12 }}>The Gamma Chart</h1>
        <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text-secondary)', maxWidth: 760 }}>
          Price and dealer gamma on one surface. See exactly where market makers are forced to trade against
          you — the Gamma Flip, the Call and Put Walls, and a live silhouette of dealer positioning by price —
          drawn inline on a fast, precise candle chart. Nothing else shows you this.
        </p>
        <div className="flex flex-wrap items-center gap-8 mt-5">
          <Stat value="SPY · QQQ · SPX" label="Underlyings" />
          <Stat value="1m → 1D" label="Timeframes" />
          <Stat value="Live" label="Dealer gamma overlay" />
          <Stat value="12 themes" label="Fully re-skinnable" />
        </div>
      </header>

      {/* The instrument */}
      <GammaTerminalChart className="mb-8" />

      {/* Why it's different */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <LineChart size={16} style={{ color: 'var(--text-secondary)' }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
            What you&apos;re looking at
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {EDGE_CARDS.map((c) => (
            <div
              key={c.title}
              className="zg-feature-shell p-4 flex flex-col gap-3"
              style={{ borderTop: `2px solid ${c.accent}` }}
            >
              <div
                className="flex items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: 'var(--radius-control)', color: c.accent, background: `color-mix(in srgb, ${c.accent} 12%, transparent)` }}
              >
                {c.icon}
              </div>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                {c.title}
              </h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cross-links to the deeper positioning tools */}
      <section
        className="zg-feature-shell p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 mb-4"
        style={{ background: 'var(--bg-subtle)' }}
      >
        <div className="flex-1">
          <span className="zg-eyebrow" style={{ color: 'var(--color-brand-primary)' }}>Go deeper</span>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 6px' }}>
            The full dealer-positioning breakdown
          </h3>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: 620 }}>
            The chart shows you the levels. The Dealer Positioning and GEX Strike Profile pages show you the
            forces behind them — net GEX by strike, vanna and charm flows, and the volatility surface.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/gamma-exposure" className="zg-btn zg-btn--primary">
            Dealer Positioning <ArrowRight size={15} />
          </Link>
          <Link href="/gex-strike-profile" className="zg-btn zg-btn--secondary">
            GEX Strike Profile
          </Link>
        </div>
      </section>

      <p style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-muted)', maxWidth: 820 }}>
        Gamma levels are modeled estimates of dealer positioning derived from the options chain and update
        throughout the session. They are decision-support context, not a guarantee of price behavior, and are
        not investment advice.
      </p>
    </PageShell>
  );
}
