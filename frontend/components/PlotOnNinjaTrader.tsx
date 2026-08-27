'use client';

import { Download, KeyRound, Radio } from 'lucide-react';
import { capture } from '@/core/telemetry/posthog-client';
import { NT_INDICATOR_PATH, NT_PACKAGE_PATH } from '@/core/ninjaTraderManifest';

// "Plot these levels on NinjaTrader" — the Pro counterpart to PlotOnTradingView.
//
// Pine Script cannot make HTTP calls, so the TradingView script is manual-entry
// and free. NinjaScript is C#/.NET and can, so this indicator polls the API and
// keeps itself current — which makes it the first true auto-updating charting
// integration, and a Pro feature: the .cs is free and open, the data behind it
// needs a key. See docs/ninjatrader-indicator.md.

// Content-addressed, from the generated manifest. zerogex.io is proxied
// through Cloudflare with a 4-hour cache that `make deploy` never purges, so a
// fixed URL can hand a customer the previous build for hours after a new one
// ships. A new build is a new URL, so no cache can answer for it with stale
// bytes. Same reasoning as the social card — see scripts/ninjatrader-manifest.js.
const INDICATOR_URL = NT_INDICATOR_PATH;
const PACKAGE_URL = NT_PACKAGE_PATH;
const INDICATOR_NAME = 'ZeroGEX Gamma Levels';

// `hasPackage` is resolved at build time by the server component that renders
// this: the packaged import only exists once a real NinjaTrader export has been
// published by `make ninjatrader-package`. When it hasn't, we offer the .cs
// alone rather than a button that 404s.
export default function PlotOnNinjaTrader({ hasPackage = false }: { hasPackage?: boolean }) {
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
          color: 'var(--color-brand-accent)',
          border: '1px solid var(--color-brand-accent)44',
          background: 'var(--color-brand-accent)14',
          borderRadius: 999,
          padding: '5px 14px',
          marginBottom: 16,
        }}
      >
        <Radio size={12} /> Pro · NinjaTrader 8
      </div>

      <h2 style={{ margin: '0 0 12px 0', fontSize: 24, fontWeight: 800, letterSpacing: '-0.3px' }}>
        Plot these levels on NinjaTrader
      </h2>
      <p style={{ margin: '0 0 8px 0', fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-secondary)', maxWidth: 720 }}>
        Our free{' '}
        <strong style={{ color: 'var(--color-text-primary)' }}>{INDICATOR_NAME}</strong> indicator for NinjaTrader 8
        draws the Gamma Flip, Call Wall, Put Wall, Max Pain, and Pin Strike on your chart — with an optional
        per-strike gamma histogram — and unlike the
        TradingView script, it <strong style={{ color: 'var(--color-text-primary)' }}>updates itself</strong>. It
        polls the ZeroGEX API on a timer, so you never retype a number.
      </p>
      <p style={{ margin: '0 0 20px 0', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)', opacity: 0.85, maxWidth: 720 }}>
        Trading <strong style={{ color: 'var(--color-text-primary)' }}>ES</strong> or{' '}
        <strong style={{ color: 'var(--color-text-primary)' }}>NQ</strong>? Set the symbol and the levels arrive
        already on the futures price axis — no basis offset to work out, and nothing to re-enter after a
        quarterly roll.
      </p>
      <p style={{ margin: '0 0 20px 0', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)', opacity: 0.85, maxWidth: 720 }}>
        The indicator itself is free and open — the live data needs a ZeroGEX API key, which is included with Pro.
        Generate yours from your account in a couple of clicks.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <a
          href={hasPackage && PACKAGE_URL ? PACKAGE_URL : INDICATOR_URL}
          download
          onClick={() =>
            capture('ninjatrader_indicator_clicked', {
              action: hasPackage ? 'download_package' : 'download',
            })
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 20px',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 800,
            textDecoration: 'none',
            background: 'var(--color-brand-accent)',
            color: '#ffffff',
          }}
        >
          {hasPackage ? 'Download for NinjaTrader' : 'Download the indicator'} <Download size={16} />
        </a>
        <a
          href="/account#api-access"
          onClick={() => capture('ninjatrader_indicator_clicked', { action: 'get_key' })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 20px',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 800,
            textDecoration: 'none',
            border: '1px solid var(--border-default)',
            color: 'var(--color-text-primary)',
          }}
        >
          Get your API key <KeyRound size={16} />
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
          <strong style={{ color: 'var(--color-text-primary)' }}>Get your key.</strong> On Pro, open{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>Account → API Access</strong> and click{' '}
          <em>Generate API Key</em>. It&apos;s revealed once, so copy it somewhere safe.
        </li>
        {hasPackage ? (
          <li>
            <strong style={{ color: 'var(--color-text-primary)' }}>Import it.</strong> In NinjaTrader 8 open{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>
              File → Utilities → Import NinjaScript…
            </strong>{' '}
            and pick the downloaded <code>.zip</code>. It compiles on import. Prefer the raw source?{' '}
            <a
              href={INDICATOR_URL}
              download
              onClick={() => capture('ninjatrader_indicator_clicked', { action: 'download' })}
              style={{ color: 'var(--color-brand-accent)' }}
            >
              Grab the .cs
            </a>{' '}
            and paste it into the NinjaScript Editor instead.
          </li>
        ) : (
          <li>
            <strong style={{ color: 'var(--color-text-primary)' }}>Compile the indicator.</strong> In NinjaTrader 8
            open <strong style={{ color: 'var(--color-text-primary)' }}>New → NinjaScript Editor</strong>,
            right-click{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>Indicators → New Indicator</strong>, paste in
            the downloaded file, and press{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>F5</strong> to compile.
          </li>
        )}
        <li>
          <strong style={{ color: 'var(--color-text-primary)' }}>Add it to a chart.</strong> Right-click your chart
          → <strong style={{ color: 'var(--color-text-primary)' }}>Indicators…</strong>, add{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>&ldquo;{INDICATOR_NAME}&rdquo;</strong>, then paste
          your key into <em>API key</em> and set <em>Symbol</em> to match the chart —{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>ES</strong> or{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>NQ</strong> for futures, or SPX, SPY, QQQ, NDX.
        </li>
      </ol>
    </section>
  );
}
