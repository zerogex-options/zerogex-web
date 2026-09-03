'use client';

import Link from 'next/link';
import { Download, KeyRound, Lock, Radio } from 'lucide-react';
import { capture } from '@/core/telemetry/posthog-client';
import { useHasTierAccess } from '@/hooks/useAuthSession';
import { NT_INDICATOR_PATH, NT_PACKAGE_PATH } from '@/core/ninjaTraderManifest';

// "Plot these levels on NinjaTrader" — the Pro counterpart to PlotOnTradingView.
//
// Pine Script cannot make HTTP calls, so the TradingView script is manual-entry
// and free. NinjaScript is C#/.NET and can, so this indicator polls the API and
// keeps itself current — which makes it the first true auto-updating charting
// integration, and a Pro feature. See docs/ninjatrader-indicator.md.
//
// This block sits on the FREE gamma-levels pages (/spx-, /spy-, /qqq-, /ndx-,
// /es-, /nq-gamma-levels), which are force-static and open to anonymous
// visitors — so most people who see it are not Pro, and a plain download button
// handed them a file they had no key to use. The section stays visible (it is
// part of what those pages rank and convert on) but the download itself is
// gated: below Pro the button becomes an upgrade CTA to /pricing?plan=pro.
//
// The gate is deliberately fail-closed. These pages are prerendered with no
// session, so the build-time HTML — which is also what a crawler and the first
// client paint see — renders the locked state, and it unlocks only once
// /api/auth/session actually confirms Pro. useHasTierAccess returns false while
// the session is still resolving, which is exactly the behavior we want here:
// a moment of "Unlock with Pro" for a Pro member is a far cheaper mistake than
// a live download button for everyone else.

// Content-addressed, from the generated manifest. zerogex.io is proxied
// through Cloudflare with a 4-hour cache that `make deploy` never purges, so a
// fixed URL can hand a customer the previous build for hours after a new one
// ships. A new build is a new URL, so no cache can answer for it with stale
// bytes. Same reasoning as the social card — see scripts/ninjatrader-manifest.js.
const INDICATOR_URL: string = NT_INDICATOR_PATH;
// Annotated rather than inferred. The manifest is regenerated on every deploy
// and legitimately flips between a path and `null` (null whenever the export
// archive is absent or fails verification), so inference would pin this file to
// whichever literal happened to be committed — and the build would break on the
// deploy that flipped it, not on the change that caused it.
const PACKAGE_URL: string | null = NT_PACKAGE_PATH;
const INDICATOR_NAME = 'ZeroGEX Gamma Levels';

// Shared so the gated and ungated CTAs are the same button in the same place,
// and only the label and destination change. Pulled out of the JSX because
// they are now used from two branches apiece.
const CTA_BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '11px 20px',
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 800,
  textDecoration: 'none',
} as const;

const PRIMARY_CTA_STYLE = {
  ...CTA_BASE,
  background: 'var(--color-brand-accent)',
  color: '#ffffff',
} as const;

const SECONDARY_CTA_STYLE = {
  ...CTA_BASE,
  border: '1px solid var(--border-default)',
  color: 'var(--color-text-primary)',
} as const;

// `hasPackage` is resolved at build time by the server component that renders
// this: the packaged import only exists once a real NinjaTrader export has been
// published by `make ninjatrader-package`. When it hasn't, we offer the .cs
// alone rather than a button that 404s.
//
// It is re-checked here against PACKAGE_URL rather than trusted on its own.
// The caller derives it from the same manifest, so the two cannot normally
// disagree — but a null path with a true flag is precisely the shape that
// renders a live button over a file nothing published, and that is the bug
// customers report as a 404. Cheap to make unrepresentable, so we do.
interface PlotOnNinjaTraderProps {
  hasPackage?: boolean;
  /**
   * Set on the dedicated /ninjatrader-indicator page, where this section IS the
   * page rather than a block under today's level cards — it promotes the
   * heading to the page <h1>. The copy is otherwise shared verbatim with the
   * gamma-levels pages so the two surfaces cannot drift.
   */
  standalone?: boolean;
}

export default function PlotOnNinjaTrader({ hasPackage = false, standalone = false }: PlotOnNinjaTraderProps) {
  const Heading = standalone ? 'h1' : 'h2';
  // Pro (and admin, which outranks it) get the real download; everyone else —
  // anonymous, Public, Basic, and anyone whose session has not resolved yet —
  // gets the upgrade path instead. This is the only gate on either surface:
  // /ninjatrader-indicator is a public route too, so the standalone page is
  // gated by rendering this component and nothing else.
  const hasPro = useHasTierAccess('pro');
  const packageUrl = hasPackage ? PACKAGE_URL : null;
  const packageReady = packageUrl !== null;
  const downloadUrl = packageUrl ?? INDICATOR_URL;

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

      <Heading
        style={{
          margin: '0 0 12px 0',
          fontSize: standalone ? 'clamp(28px, 4.2vw, 38px)' : 24,
          fontWeight: standalone ? 900 : 800,
          lineHeight: standalone ? 1.15 : undefined,
          letterSpacing: '-0.3px',
        }}
      >
        {standalone ? 'Plot ZeroGEX gamma levels on NinjaTrader' : 'Plot these levels on NinjaTrader'}
      </Heading>
      <p style={{ margin: '0 0 8px 0', fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-secondary)', maxWidth: 720 }}>
        Our{' '}
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
        {hasPro ? (
          <>
            The indicator is included with your Pro plan, and the live data it polls needs your ZeroGEX API key.
            Generate yours from your account in a couple of clicks.
          </>
        ) : (
          <>
            The indicator and the ZeroGEX API key it polls with are both{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>included with Pro</strong>. Upgrade and you
            can download it and generate your key in a couple of clicks.
          </>
        )}
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        {hasPro ? (
          <>
            <a
              href={downloadUrl}
              download
              onClick={() =>
                capture('ninjatrader_indicator_clicked', {
                  action: packageReady ? 'download_package' : 'download',
                })
              }
              style={PRIMARY_CTA_STYLE}
            >
              {packageReady ? 'Download for NinjaTrader' : 'Download the indicator'} <Download size={16} />
            </a>
            <a
              href="/account#api-access"
              onClick={() => capture('ninjatrader_indicator_clicked', { action: 'get_key' })}
              style={SECONDARY_CTA_STYLE}
            >
              Get your API key <KeyRound size={16} />
            </a>
          </>
        ) : (
          // Below Pro the download is not rendered at all, rather than rendered
          // and intercepted: an <a href> to the .cs is a right-click away from
          // being saved regardless of what onClick does, so the gate has to be
          // the absence of the link. `next/link` also keeps this a client-side
          // navigation, so the upsell is instant rather than a full page load.
          <>
            <Link
              href="/pricing?plan=pro"
              onClick={() => capture('ninjatrader_indicator_clicked', { action: 'upgrade' })}
              style={PRIMARY_CTA_STYLE}
            >
              <Lock size={15} /> Unlock with Pro
            </Link>
            <Link
              href="/pricing?plan=pro"
              onClick={() => capture('ninjatrader_indicator_clicked', { action: 'see_pricing' })}
              style={SECONDARY_CTA_STYLE}
            >
              See what Pro includes <KeyRound size={16} />
            </Link>
          </>
        )}
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
        {packageReady ? (
          <li>
            <strong style={{ color: 'var(--color-text-primary)' }}>Import it.</strong> In NinjaTrader 8 open{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>
              File → Utilities → Import NinjaScript…
            </strong>{' '}
            and pick the downloaded <code>.zip</code>. It compiles on import.
            {/* The escape hatch to the raw source is a download link like any
                other, so it is gated with the buttons above — otherwise the
                paywall would have a hole in step 2 of its own instructions. */}
            {hasPro && (
              <>
                {' '}
                Prefer the raw source?{' '}
                <a
                  href={INDICATOR_URL}
                  download
                  onClick={() => capture('ninjatrader_indicator_clicked', { action: 'download' })}
                  style={{ color: 'var(--color-brand-accent)' }}
                >
                  Grab the .cs
                </a>{' '}
                and paste it into the NinjaScript Editor instead.
              </>
            )}
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
