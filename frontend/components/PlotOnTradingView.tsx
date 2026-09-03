'use client';

import Link from 'next/link';
import { ExternalLink, LineChart, Search } from 'lucide-react';
import { capture } from '@/core/telemetry/posthog-client';

// "Plot these levels on TradingView" — the free-indicator funnel step.
//
// A trader lands on a gamma-levels page for today's numbers, then wants them on
// their own chart. Our indicator is published PUBLIC on TradingView, so users
// just add it from the indicator library — no copying source, no Pine Editor.
// This block links straight to the published script and tells them how to add it.

// Published, public TradingView script (open-source, appears in indicator search).
const SCRIPT_URL = 'https://www.tradingview.com/script/FyyCXQwa-ZeroGEX-Daily-Gamma-Levels/';
const SCRIPT_NAME = 'ZeroGEX Daily Gamma Levels';

// Where a standalone reader goes to get the numbers this script asks them to
// type in. On the gamma-levels pages those numbers are literally in the cards
// above the section; on /tradingview-indicator they are one link away.
const LEVELS_HREF = '/spx-gamma-levels';

interface PlotOnTradingViewProps {
  /**
   * Set on the dedicated /tradingview-indicator page, where this section IS the
   * page rather than a block under today's level cards. It promotes the heading
   * to the page <h1> and swaps the two "from the cards above" references — which
   * have no antecedent on their own page — for a link to the levels themselves.
   * Every other word of the copy is shared, so the two surfaces cannot drift.
   */
  standalone?: boolean;
}

export default function PlotOnTradingView({ standalone = false }: PlotOnTradingViewProps) {
  const Heading = standalone ? 'h1' : 'h2';
  const levelsSource = standalone ? (
    <>
      from today&apos;s{' '}
      <Link href={LEVELS_HREF} style={{ color: 'var(--color-brand-primary)' }}>
        free gamma levels
      </Link>
    </>
  ) : (
    <>from the cards above</>
  );

  return (
    <section
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 18,
        padding: '28px',
        marginBottom: 48,
        background: 'var(--color-surface)',
      }}
    >
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
          marginBottom: 16,
        }}
      >
        <LineChart size={12} /> Free · TradingView
      </div>

      <Heading
        style={{
          margin: '0 0 12px 0',
          fontSize: standalone ? 'clamp(28px, 4.2vw, 38px)' : 24,
          fontWeight: standalone ? 900 : 800,
          lineHeight: standalone ? 1.15 : undefined,
          letterSpacing: '-0.3px',
        }}
      >
        {standalone ? 'Plot ZeroGEX gamma levels on TradingView' : 'Plot these levels on TradingView'}
      </Heading>
      <p style={{ margin: '0 0 8px 0', fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-secondary)', maxWidth: 720 }}>
        Trade off your own chart? Add our free{' '}
        <strong style={{ color: 'var(--color-text-primary)' }}>{SCRIPT_NAME}</strong> indicator, then enter today&apos;s
        numbers {levelsSource}. It draws the Gamma Flip, Call Wall, Put Wall, and Max Pain as horizontal
        lines on SPY, SPX, QQQ, NDX, ES or NQ — with optional cross-alerts.
      </p>
      <p style={{ margin: '0 0 20px 0', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)', opacity: 0.85, maxWidth: 720 }}>
        Manual-entry only — the script doesn&apos;t pull data. For real-time, auto-updating levels, live dealer
        positioning, and option flow, use the ZeroGEX dashboard.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <a
          href={SCRIPT_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => capture('tradingview_indicator_clicked', { action: 'open' })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 20px',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 800,
            textDecoration: 'none',
            background: 'var(--color-brand-primary)',
            color: '#ffffff',
          }}
        >
          Open on TradingView <ExternalLink size={16} />
        </a>
      </div>

      <ol
        style={{
          margin: 0,
          paddingLeft: 20,
          fontSize: 13,
          lineHeight: 1.7,
          color: 'var(--color-text-secondary)',
          maxWidth: 720,
        }}
      >
        <li>
          <strong style={{ color: 'var(--color-text-primary)' }}>Add the indicator.</strong> Click{' '}
          <em>Open on TradingView</em> above and add it to your chart — or, on any chart, open the{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>Indicators</strong> dialog (
          <Search size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> top toolbar) and search{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>&ldquo;{SCRIPT_NAME}&rdquo;</strong>.
        </li>
        <li>
          Open the indicator&apos;s <strong style={{ color: 'var(--color-text-primary)' }}>Settings</strong> and enter
          today&apos;s Gamma Flip, Call Wall, Put Wall, and Max Pain {levelsSource}. Set any level to 0 to
          hide it.
        </li>
      </ol>
    </section>
  );
}
