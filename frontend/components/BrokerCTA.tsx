'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Info } from 'lucide-react';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent } from '@/core/telemetry/events';
import type { BrokerSlug, CtaSurface } from '@/core/attribution';

// Reusable broker-affiliate CTA that lives on the public share surfaces
// (playbook cards, scorecards, forecasts, replays, gamma-levels teaser)
// and on the /brokers comparison page itself. Two links: a primary
// "Compare brokers" button that funnels to /brokers?utm_source=<surface>
// so the comparison page picks up the origin, and a smaller inline
// direct link to tastytrade (options-native, our default nudge).
//
// Every click POSTs to /api/attribution/click AND fires a PostHog
// `broker_cta_click` event with the same payload — the server row is
// the source of truth for revenue attribution, the PostHog event is
// what drives the funnel dashboard.

const TASTYTRADE_FALLBACK_URL = 'https://tastytrade.com';

type Variant = 'inline' | 'sidebar' | 'footer';

export type BrokerCTAProps = {
  surface: Exclude<CtaSurface, 'brokers-page'>;
  variant?: Variant;
  headline?: string;
};

const DEFAULT_HEADLINE: Record<BrokerCTAProps['surface'], string> = {
  card: 'Trade this setup — see our recommended options brokers.',
  scorecard: "Ready to trade tomorrow's setups? Compare options-friendly brokers.",
  forecast: 'Position for the forecast — compare options-friendly brokers.',
  replay: 'Trade the next session — see our recommended options brokers.',
  'live-bulletin': 'Trade this bulletin — compare options-friendly brokers.',
  'spx-gamma-levels': 'Trade these gamma levels — open a compatible broker.',
};

// Style tokens deliberately match the palette used in
// app/pricing/Client.tsx so the CTA reads as part of the same design
// system rather than an ad-shaped inset.
const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  brand: 'var(--color-brand-primary)',
  border: 'var(--border-default)',
};

function tastytradeUrl(): string {
  const env = process.env.NEXT_PUBLIC_BROKER_URL_TASTYTRADE;
  return env && env.length > 0 ? env : TASTYTRADE_FALLBACK_URL;
}

// Fire the attribution event both to the server (for revenue tracking)
// and to PostHog (for funnel analysis). Best-effort — a failed fetch
// or an analytics no-op must never block the redirect.
async function reportClick(
  surface: BrokerCTAProps['surface'],
  brokerPartner: BrokerSlug,
): Promise<void> {
  const path =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '';
  const payload = { surface, broker_partner: brokerPartner, path };
  try {
    capture(TelemetryEvent.BrokerCtaClick, payload);
  } catch {
    /* swallow */
  }
  try {
    // keepalive so a click that immediately unloads the tab still ships.
    await fetch('/api/attribution/click', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    /* swallow — redirect is happening in parallel */
  }
}

function DisclosureChevron() {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-label="Advertising disclosure"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: C.muted,
          background: 'transparent',
          border: 'none',
          padding: '2px 4px',
          cursor: 'pointer',
        }}
      >
        <Info size={12} /> Advertising disclosure
      </button>
      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 5,
            maxWidth: 320,
            padding: '10px 12px',
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            fontSize: 12,
            lineHeight: 1.5,
            color: C.muted,
            fontWeight: 400,
            letterSpacing: '0',
            textTransform: 'none',
          }}
        >
          ZeroGEX may earn a commission when you open an account through these
          links. This does not affect the price you pay. See our full
          disclosure at{' '}
          <Link href="/terms#advertising-disclosure" style={{ color: C.brand }}>
            /terms
          </Link>
          .
        </div>
      )}
    </div>
  );
}

export default function BrokerCTA({ surface, variant = 'inline', headline }: BrokerCTAProps) {
  const compareHref = `/brokers?utm_source=${encodeURIComponent(surface)}`;
  const finalHeadline = headline ?? DEFAULT_HEADLINE[surface];
  const isSidebar = variant === 'sidebar';

  return (
    <section
      aria-label="Broker options"
      data-broker-cta={surface}
      style={{
        margin: variant === 'footer' ? '32px 0 0' : '28px 0',
        padding: isSidebar ? '18px 20px' : '18px 22px',
        borderRadius: 14,
        border: `1px solid ${C.brand}44`,
        background: `linear-gradient(135deg, ${C.brand}10 0%, ${C.card} 100%)`,
        display: 'flex',
        flexDirection: isSidebar ? 'column' : 'row',
        alignItems: isSidebar ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: isSidebar ? 12 : 18,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: C.light,
            lineHeight: 1.45,
          }}
        >
          {finalHeadline}
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          Options-native accounts approved fast.{' '}
          <a
            href={tastytradeUrl()}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => {
              void reportClick(surface, 'tastytrade');
            }}
            style={{ color: C.brand, fontWeight: 700, textDecoration: 'none' }}
          >
            Or open a tastytrade account →
          </a>
        </div>
        <div style={{ marginTop: 8 }}>
          <DisclosureChevron />
        </div>
      </div>

      <Link
        href={compareHref}
        onClick={() => {
          void reportClick(surface, 'compare');
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 18px',
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 800,
          textDecoration: 'none',
          color: 'var(--text-inverse)',
          background: `linear-gradient(135deg, ${C.brand} 0%, var(--heat-mid) 100%)`,
          whiteSpace: 'nowrap',
          alignSelf: isSidebar ? 'flex-start' : 'center',
        }}
      >
        Compare brokers <ArrowRight size={14} />
      </Link>
    </section>
  );
}
