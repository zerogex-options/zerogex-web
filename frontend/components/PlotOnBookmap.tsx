'use client';

import Link from 'next/link';
import { Download, KeyRound, Lock, Radio } from 'lucide-react';
import { capture } from '@/core/telemetry/posthog-client';
import { useHasTierAccess } from '@/hooks/useAuthSession';
import { BOOKMAP_ADDON_PATH } from '@/core/integrationAssets';

// "Plot these levels on Bookmap" — the third auto-updating integration,
// alongside PlotOnNinjaTrader and PlotOnSierraChart.
//
// Bookmap add-ons are Java, so like NinjaScript and ACSIL (and unlike Pine
// Script or thinkScript) the add-on can make HTTP calls. That makes it a Pro
// feature on the same terms: the download is gated at Pro, and the data behind
// it is gated again by the API key. See docs/bookmap-indicator.md.
//
// The gate is fail-closed, exactly as in its siblings: the page is
// prerendered with no session, so the build-time HTML (also what a crawler
// and the first client paint see) renders the locked state, and it unlocks
// only once /api/auth/session confirms Pro. Below Pro there is no link to the
// jar at all, because an <a href> is a right-click away from being saved
// whatever its onClick does.

// Content-addressed, from the generated manifest: a new build is a new URL,
// so Cloudflare's edge can never hand out the previous jar.
const ADDON_URL: string = BOOKMAP_ADDON_PATH;
const ADDON_NAME = 'ZeroGEX Gamma Levels';

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

const STRONG = { color: 'var(--color-text-primary)' } as const;

const BODY = {
  margin: '0 0 12px 0',
  fontSize: 15,
  lineHeight: 1.65,
  color: 'var(--color-text-secondary)',
  maxWidth: 720,
} as const;

const NOTE = {
  margin: '0 0 20px 0',
  fontSize: 13,
  lineHeight: 1.6,
  color: 'var(--color-text-secondary)',
  opacity: 0.85,
  maxWidth: 720,
} as const;

// What the add-on draws, for the standalone page. Each line is a thing a
// Bookmap trader can check on their own chart, not a claim about outcomes.
const FEATURES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'The levels, with their history',
    body: 'Gamma Flip, Call Wall, Put Wall, Max Pain, and Pin Strike as lines on the heatmap. The session’s history loads with the chart, so scrolling back shows where each wall was when price got there, never before it was published.',
  },
  {
    title: 'Labels that stay readable zoomed in',
    body: 'Each level is labeled at the right edge. Levels on the same strike fold into one label, close ones stack, and levels off-screen become markers at the top or bottom edge with their distance from price.',
  },
  {
    title: 'A per-strike gamma profile',
    body: 'Bars down the side of the heatmap, one per strike: gold where dealers are long gamma and their hedging leans against moves, violet where they are short gamma and their hedging adds to them.',
  },
  {
    title: 'The regime, always in view',
    body: 'A small badge says whether price is above or below the gamma flip, and whether the levels are live, from the last close, or not updating, with the reason.',
  },
  {
    title: 'Alerts at the walls',
    body: 'Optional Bookmap alerts, spoken and as a popup, when price comes within a few ticks of the levels you pick. Each one fires once, then again only after price has moved clearly away.',
  },
  {
    title: 'Futures without the arithmetic',
    body: 'On ES, NQ, MES, or MNQ it reads the chart and picks the levels, already on the futures price axis. If your chart is on a different contract month than the levels during the roll, it says so.',
  },
];

interface PlotOnBookmapProps {
  /**
   * Set on the dedicated /bookmap-indicator page, where this section IS the
   * page: promotes the heading to the page <h1> and adds the feature list.
   */
  standalone?: boolean;
}

export default function PlotOnBookmap({ standalone = false }: PlotOnBookmapProps) {
  const Heading = standalone ? 'h1' : 'h2';
  const hasPro = useHasTierAccess('pro');

  return (
    <section
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 18,
        padding: 'var(--ind-card-pad)',
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
          border: '1px solid color-mix(in srgb, var(--color-brand-accent) 27%, transparent)',
          background: 'color-mix(in srgb, var(--color-brand-accent) 8%, transparent)',
          borderRadius: 999,
          padding: '5px 14px',
          marginBottom: 16,
        }}
      >
        <Radio size={12} /> Pro · Bookmap
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
        {standalone ? 'Plot ZeroGEX gamma levels on Bookmap' : 'Plot these levels on Bookmap'}
      </Heading>
      <p style={BODY}>
        Our <strong style={STRONG}>{ADDON_NAME}</strong> add-on for Bookmap draws the Gamma Flip, Call Wall, Put
        Wall, Max Pain, and Pin Strike on your heatmap and{' '}
        <strong style={STRONG}>updates itself</strong>&nbsp;- it asks the ZeroGEX API for the levels right after
        each recompute, so they are current within seconds and you never retype a number.
      </p>
      <p style={NOTE}>
        Built for order-flow traders: the levels tell you where dealer hedging is heaviest, and Bookmap shows you
        what the book does when price gets there. Trading <strong style={STRONG}>ES</strong> or{' '}
        <strong style={STRONG}>NQ</strong>, or the micros? It reads the chart and picks the levels on its own,
        already on the futures price axis.
      </p>

      {standalone && (
        <ul
          style={{
            listStyle: 'none',
            margin: '0 0 22px 0',
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: 12,
            maxWidth: 900,
          }}
        >
          {FEATURES.map((f) => (
            <li
              key={f.title}
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: 12,
                padding: '14px 16px',
                background: 'var(--color-bg)',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6, color: 'var(--color-text-primary)' }}>
                {f.title}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>{f.body}</div>
            </li>
          ))}
        </ul>
      )}

      <p style={NOTE}>
        {hasPro ? (
          <>
            The add-on is included with your Pro plan, and the live data it reads needs your ZeroGEX API key.
            Generate yours from your account in a couple of clicks.
          </>
        ) : (
          <>
            The add-on and the ZeroGEX API key it reads with are both{' '}
            <strong style={STRONG}>included with Pro</strong>. Upgrade and you can download it and generate your
            key in a couple of clicks.
          </>
        )}
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        {hasPro ? (
          <>
            <a
              href={ADDON_URL}
              download="ZeroGEX-Bookmap.jar"
              onClick={() => capture('bookmap_indicator_clicked', { action: 'download' })}
              style={PRIMARY_CTA_STYLE}
            >
              Download the add-on <Download size={16} />
            </a>
            <a
              href="/account#api-access"
              onClick={() => capture('bookmap_indicator_clicked', { action: 'get_key' })}
              style={SECONDARY_CTA_STYLE}
            >
              Get your API key <KeyRound size={16} />
            </a>
          </>
        ) : (
          <>
            <Link
              href="/pricing?plan=pro"
              onClick={() => capture('bookmap_indicator_clicked', { action: 'upgrade' })}
              style={PRIMARY_CTA_STYLE}
            >
              <Lock size={15} /> Unlock with Pro
            </Link>
            <Link
              href="/pricing?plan=pro"
              onClick={() => capture('bookmap_indicator_clicked', { action: 'see_pricing' })}
              style={SECONDARY_CTA_STYLE}
            >
              See what Pro includes <KeyRound size={16} />
            </Link>
          </>
        )}
      </div>

      <ol
        style={{
          margin: '0 0 14px 0',
          paddingLeft: 20,
          fontSize: 13,
          lineHeight: 1.7,
          color: 'var(--color-text-secondary)',
          maxWidth: 720,
        }}
      >
        <li>
          <strong style={STRONG}>Get your key.</strong> On Pro, open{' '}
          <strong style={STRONG}>Account → API Access</strong> and click <em>Generate API Key</em>. It&apos;s
          revealed once, so copy it somewhere safe.
        </li>
        <li>
          <strong style={STRONG}>Add it to Bookmap.</strong> Open{' '}
          <strong style={STRONG}>Settings → Configure add-ons</strong> (on some versions it is under an Add-ons
          menu), click <strong style={STRONG}>Add</strong>, choose the downloaded <code>.jar</code>, and pick{' '}
          <strong style={STRONG}>&ldquo;{ADDON_NAME}&rdquo;</strong>.
        </li>
        <li>
          <strong style={STRONG}>Turn it on for your chart and paste the key.</strong> Enable it for the
          instrument, open its settings, paste your key, and press <em>Save key</em>. The key is saved once for
          every Bookmap chart on that computer, and the symbol is read from the chart.
        </li>
      </ol>
      <p style={{ ...NOTE, margin: 0 }}>
        Runs on Bookmap 7 and 8. The labels, profile, and badge need Bookmap 7.2 or later, and popup alerts 7.4 or
        later; on older versions the lines still draw. Works on any data connection, because the levels come from
        the ZeroGEX API, not from Bookmap&apos;s feed.
      </p>
    </section>
  );
}
