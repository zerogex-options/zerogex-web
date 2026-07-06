'use client';

import { useState, type CSSProperties } from 'react';
import { Check, Copy, Download, LineChart } from 'lucide-react';
import { capture } from '@/core/telemetry/posthog-client';

// "Plot these levels on TradingView" — the free-indicator funnel step.
//
// A trader lands on /spx-gamma-levels for today's numbers, then wants them on
// their own chart. This block hands them the manual-entry Pine Script that
// draws Gamma Flip / Call Wall / Put Wall / Max Gamma as horizontal lines.
//
// The script itself is the single source of truth on disk at
//   /public/tradingview/zerogex-daily-gamma-levels.pine
// so Copy fetches that same file rather than duplicating the source inline —
// there is no second copy to drift out of sync.

const PINE_PATH = '/tradingview/zerogex-daily-gamma-levels.pine';

export default function PlotOnTradingView() {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCopy = async () => {
    setFailed(false);
    try {
      const res = await fetch(PINE_PATH, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const source = await res.text();
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      capture('tradingview_indicator_clicked', { action: 'copy' });
    } catch {
      // Clipboard or fetch unavailable (insecure context, blocked) — fall back
      // to opening the raw file so the user can select-all and copy manually.
      setFailed(true);
      window.open(PINE_PATH, '_blank', 'noopener,noreferrer');
    }
  };

  const btnBase: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 18px',
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: 'none',
    cursor: 'pointer',
    border: '1px solid var(--border-default)',
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
  };

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

      <h2 style={{ margin: '0 0 12px 0', fontSize: 24, fontWeight: 800, letterSpacing: '-0.3px' }}>
        Plot these levels on TradingView
      </h2>
      <p style={{ margin: '0 0 8px 0', fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-secondary)', maxWidth: 720 }}>
        Trade off your own chart? Add our free{' '}
        <strong style={{ color: 'var(--color-text-primary)' }}>ZeroGEX Daily Gamma Levels</strong> Pine Script and
        type in today&apos;s numbers from the cards above. It draws the Gamma Flip, Call Wall, Put Wall, and Max Gamma /
        Pin as horizontal lines on SPY, SPX, QQQ, ES, or NQ — with optional cross-alerts.
      </p>
      <p style={{ margin: '0 0 20px 0', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)', opacity: 0.85, maxWidth: 720 }}>
        Manual-entry only — the script doesn&apos;t pull data. For real-time, auto-updating levels, live dealer
        positioning, and option flow, use the ZeroGEX dashboard.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <button type="button" onClick={handleCopy} style={btnBase}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied Pine Script' : 'Copy Pine Script'}
        </button>
        <a
          href={PINE_PATH}
          download="zerogex-daily-gamma-levels.pine"
          onClick={() => capture('tradingview_indicator_clicked', { action: 'download' })}
          style={btnBase}
        >
          <Download size={16} /> Download .pine
        </a>
      </div>

      {failed && (
        <p style={{ margin: '0 0 16px 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Copy was blocked by your browser — we opened the raw script in a new tab so you can select all and copy it.
        </p>
      )}

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
        <li>Copy the script above.</li>
        <li>
          In TradingView, open <strong style={{ color: 'var(--color-text-primary)' }}>Pine Editor</strong> (bottom of
          the chart), paste, and click <strong style={{ color: 'var(--color-text-primary)' }}>Add to chart</strong>.
        </li>
        <li>
          Open the indicator&apos;s <strong style={{ color: 'var(--color-text-primary)' }}>Settings</strong> and enter
          today&apos;s Gamma Flip, Call Wall, Put Wall, and Max Gamma / Pin from the cards above.
        </li>
      </ol>
    </section>
  );
}
