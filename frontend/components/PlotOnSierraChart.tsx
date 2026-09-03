'use client';

import Link from 'next/link';
import { Download, KeyRound, Lock, Radio } from 'lucide-react';
import { capture } from '@/core/telemetry/posthog-client';
import { useHasTierAccess } from '@/hooks/useAuthSession';
import { SIERRACHART_STUDY_PATH } from '@/core/integrationAssets';

// "Plot these levels on Sierra Chart" — the second auto-updating integration,
// alongside PlotOnNinjaTrader.
//
// ACSIL is C++, so like NinjaScript (and unlike Pine Script or thinkScript) it
// can make HTTP calls. That makes this a Pro feature on the same terms as the
// NinjaTrader indicator: the download is gated at Pro, and the data behind it
// is gated again by the API key. See docs/sierra-chart-indicator.md.
//
// This block sits on the FREE gamma-levels pages, which are force-static and
// open to anonymous visitors, so most people who see it are not Pro. The
// section stays visible — it is part of what those pages convert on — but the
// download itself is gated: below Pro the button becomes an upgrade CTA.
//
// The gate is fail-closed, exactly as in PlotOnNinjaTrader: these pages are
// prerendered with no session, so the build-time HTML — which is also what a
// crawler and the first client paint see — renders the locked state, and it
// unlocks only once /api/auth/session confirms Pro. useHasTierAccess returns
// false while the session is resolving, which is the behavior we want: a
// moment of "Unlock with Pro" for a Pro member is a far cheaper mistake than a
// live download button for everyone else.

// Content-addressed, from the generated manifest — see the same note in
// PlotOnNinjaTrader and scripts/integration-assets-manifest.js.
const STUDY_URL: string = SIERRACHART_STUDY_PATH;
const STUDY_NAME = 'ZeroGEX Gamma Levels';

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

interface PlotOnSierraChartProps {
  /**
   * Set on the dedicated /sierra-chart-indicator page, where this section IS
   * the page rather than a block under today's level cards — it promotes the
   * heading to the page <h1>. The copy is otherwise shared verbatim with the
   * gamma-levels pages so the two surfaces cannot drift.
   */
  standalone?: boolean;
}

export default function PlotOnSierraChart({ standalone = false }: PlotOnSierraChartProps) {
  const Heading = standalone ? 'h1' : 'h2';
  const hasPro = useHasTierAccess('pro');

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
        <Radio size={12} /> Pro · Sierra Chart
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
        {standalone ? 'Plot ZeroGEX gamma levels on Sierra Chart' : 'Plot these levels on Sierra Chart'}
      </Heading>
      <p style={{ margin: '0 0 8px 0', fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-secondary)', maxWidth: 720 }}>
        Our <strong style={{ color: 'var(--color-text-primary)' }}>{STUDY_NAME}</strong> study for Sierra Chart
        draws the Gamma Flip, Call Wall, Put Wall, Max Pain, and Pin Strike on your chart and{' '}
        <strong style={{ color: 'var(--color-text-primary)' }}>updates itself</strong> — ACSIL is C++, so it
        polls the ZeroGEX API on a timer and you never retype a number.
      </p>
      <p style={{ margin: '0 0 20px 0', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)', opacity: 0.85, maxWidth: 720 }}>
        Trading <strong style={{ color: 'var(--color-text-primary)' }}>ES</strong> or{' '}
        <strong style={{ color: 'var(--color-text-primary)' }}>NQ</strong>? Set the symbol and the levels arrive
        already on the futures price axis — no basis offset to work out, and nothing to re-enter after a
        quarterly roll. Each level is a normal subgraph, so you can restyle or hide any of them from the
        Subgraphs tab and reference their values from spreadsheet studies and alert conditions.
      </p>
      <p style={{ margin: '0 0 20px 0', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)', opacity: 0.85, maxWidth: 720 }}>
        {hasPro ? (
          <>
            The study is included with your Pro plan, and the live data it polls needs your ZeroGEX API key.
            Generate yours from your account in a couple of clicks.
          </>
        ) : (
          <>
            The study and the ZeroGEX API key it polls with are both{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>included with Pro</strong>. Upgrade and you
            can download it and generate your key in a couple of clicks.
          </>
        )}
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        {hasPro ? (
          <>
            <a
              href={STUDY_URL}
              download="ZeroGexGammaLevels.cpp"
              onClick={() => capture('sierrachart_indicator_clicked', { action: 'download' })}
              style={PRIMARY_CTA_STYLE}
            >
              Download the study <Download size={16} />
            </a>
            <a
              href="/account#api-access"
              onClick={() => capture('sierrachart_indicator_clicked', { action: 'get_key' })}
              style={SECONDARY_CTA_STYLE}
            >
              Get your API key <KeyRound size={16} />
            </a>
          </>
        ) : (
          // Below Pro the download is not rendered at all, rather than rendered
          // and intercepted: an <a href> to the .cpp is a right-click away from
          // being saved regardless of what onClick does, so the gate has to be
          // the absence of the link.
          <>
            <Link
              href="/pricing?plan=pro"
              onClick={() => capture('sierrachart_indicator_clicked', { action: 'upgrade' })}
              style={PRIMARY_CTA_STYLE}
            >
              <Lock size={15} /> Unlock with Pro
            </Link>
            <Link
              href="/pricing?plan=pro"
              onClick={() => capture('sierrachart_indicator_clicked', { action: 'see_pricing' })}
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
        <li>
          <strong style={{ color: 'var(--color-text-primary)' }}>Build it.</strong> Drop the{' '}
          <code>.cpp</code> into Sierra Chart&apos;s <code>ACS_Source</code> folder, then{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>
            Analysis → Build Custom Studies DLL → Build
          </strong>
          . Sierra Chart ships its own compiler, so there is no toolchain to install.
        </li>
        <li>
          <strong style={{ color: 'var(--color-text-primary)' }}>Add it to a chart.</strong>{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>Analysis → Studies → Add Custom Study</strong>,
          pick <strong style={{ color: 'var(--color-text-primary)' }}>&ldquo;{STUDY_NAME}&rdquo;</strong>, then
          paste your key into <em>ZeroGEX API Key</em> and set <em>Symbol</em> to match the chart —{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>ES</strong> or{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>NQ</strong> for futures, or SPX, SPY, QQQ, NDX.
        </li>
      </ol>
    </section>
  );
}
