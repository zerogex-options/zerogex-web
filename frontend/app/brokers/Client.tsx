'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, ChevronUp, Info } from 'lucide-react';
import Footer from '@/components/Footer';
import LandingHeader from '@/components/LandingHeader';
import { useTheme } from '@/core/ThemeContext';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent } from '@/core/telemetry/events';
import { BROKER_ROWS, brokerAffiliateUrl, type Broker } from './brokerData';

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  brand: 'var(--color-brand-primary)',
  border: 'var(--border-default)',
};

// Track a click both to the server (revenue attribution) and to
// PostHog (funnel dashboard). Best-effort — never blocks the redirect.
async function trackClick(broker: Broker): Promise<void> {
  const path =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '';
  const payload = {
    surface: 'brokers-page' as const,
    broker_partner: broker.slug,
    path,
  };
  try {
    capture(TelemetryEvent.BrokerCtaClick, payload);
  } catch {
    /* swallow */
  }
  try {
    await fetch('/api/attribution/click', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    /* swallow */
  }
}

type FaqItem = { q: string; a: React.ReactNode };

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Do you recommend one?',
    a: (
      <>
        No. Every broker on this list works for different traders. Someone running defined-risk
        SPX spreads is best served by tastytrade or IBKR; someone taking one directional 0DTE
        setup a week on their phone might prefer Webull or Public. Pick the one whose commission
        structure, approval level, and workflow match how you actually trade — not the one at
        the top of a list.
      </>
    ),
  },
  {
    q: 'Is this an ad?',
    a: (
      <>
        Partially, and we say so. If you open a brokerage account through one of these links we
        earn a commission from the broker. It doesn&rsquo;t change what you pay, and we do not
        accept payment for favorable placement on this page. See the full{' '}
        <Link href="/terms#advertising-disclosure" style={{ color: C.brand }}>
          advertising disclosure
        </Link>{' '}
        in our Terms.
      </>
    ),
  },
  {
    q: 'Which one do YOU use?',
    a: (
      // TODO(site-owner): fill this in personally. Leaving fabricated content
      // here would undermine the "honest broker" positioning the page is built
      // around — better to acknowledge the question than to make something up.
      <>
        Coming soon — the site owner will share their own setup here rather than have this page
        make a call it can&rsquo;t back up.
      </>
    ),
  },
];

function BrokerRow({ broker, index }: { broker: Broker; index: number }) {
  const href = brokerAffiliateUrl(broker);
  return (
    <tr style={{ borderTop: index === 0 ? 'none' : `1px solid ${C.border}` }}>
      <td style={cellHeader}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.light }}>{broker.name}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
          {broker.tagline}
        </div>
      </td>
      <td style={cell}>{broker.commission}</td>
      <td style={cell}>{broker.optionsApproval}</td>
      <td style={cell}>{broker.api}</td>
      <td style={cell}>
        <span style={{ color: 'var(--color-bull, var(--color-brand-primary))' }}>+ </span>
        {broker.pro}
      </td>
      <td style={cell}>
        <span style={{ color: 'var(--color-bear, var(--color-brand-primary))' }}>− </span>
        {broker.con}
      </td>
      <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => {
            void trackClick(broker);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 16px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            textDecoration: 'none',
            color: 'var(--text-inverse)',
            background: `linear-gradient(135deg, ${C.brand} 0%, var(--heat-mid) 100%)`,
          }}
        >
          Open Account <ArrowRight size={14} />
        </a>
      </td>
    </tr>
  );
}

const cell: React.CSSProperties = {
  padding: '18px 14px',
  fontSize: 13,
  color: C.muted,
  lineHeight: 1.55,
  verticalAlign: 'top',
};
const cellHeader: React.CSSProperties = { ...cell, minWidth: 220 };
const th: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: C.muted,
  textAlign: 'left',
  borderBottom: `1px solid ${C.border}`,
};

function BrokerCardMobile({ broker }: { broker: Broker }) {
  const href = brokerAffiliateUrl(broker);
  return (
    <article
      style={{
        border: `1px solid ${C.border}`,
        background: C.card,
        borderRadius: 14,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.light }}>{broker.name}</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55 }}>{broker.tagline}</div>
      </header>
      <dl style={{ margin: 0, display: 'grid', rowGap: 6 }}>
        <MobileRow label="Commission" value={broker.commission} />
        <MobileRow label="Options approval" value={broker.optionsApproval} />
        <MobileRow label="API" value={broker.api} />
        <MobileRow label="Pro" value={broker.pro} tone="positive" />
        <MobileRow label="Con" value={broker.con} tone="negative" />
      </dl>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={() => {
          void trackClick(broker);
        }}
        style={{
          marginTop: 6,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '11px 20px',
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 800,
          textDecoration: 'none',
          color: 'var(--text-inverse)',
          background: `linear-gradient(135deg, ${C.brand} 0%, var(--heat-mid) 100%)`,
        }}
      >
        Open Account <ArrowRight size={14} />
      </a>
    </article>
  );
}

function MobileRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  const prefix = tone === 'positive' ? '+ ' : tone === 'negative' ? '− ' : '';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, fontSize: 12 }}>
      <dt
        style={{
          color: C.muted,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, color: C.light, lineHeight: 1.55 }}>
        {prefix}
        {value}
      </dd>
    </div>
  );
}

function FaqRow({ item, initiallyOpen = false }: { item: FaqItem; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '14px 18px',
        background: C.card,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          width: '100%',
          padding: 0,
          background: 'transparent',
          border: 'none',
          color: C.light,
          fontSize: 15,
          fontWeight: 800,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {item.q}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div style={{ marginTop: 10, fontSize: 14, color: C.muted, lineHeight: 1.65 }}>{item.a}</div>
      )}
    </div>
  );
}

export default function BrokersClient() {
  const { theme } = useTheme();

  return (
    <div
      style={{
        background: 'transparent',
        color: C.light,
        overflowX: 'hidden',
      }}
    >
      <LandingHeader />

      <main style={{ minHeight: '100vh', padding: '120px 24px 60px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <header style={{ marginBottom: 32 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: C.brand,
                border: `1px solid ${C.brand}44`,
                background: `${C.brand}14`,
                borderRadius: 999,
                padding: '5px 14px',
                marginBottom: 18,
              }}
            >
              <Info size={12} /> Six brokers · Honest side-by-side · Affiliate links
            </div>
            <h1
              style={{
                margin: '0 0 14px 0',
                fontSize: 'clamp(30px, 4.6vw, 46px)',
                fontWeight: 900,
                letterSpacing: '-1px',
                lineHeight: 1.1,
              }}
            >
              Where our readers trade dealer gamma setups
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 16,
                lineHeight: 1.65,
                color: C.muted,
                maxWidth: 720,
              }}
            >
              These are the six options-friendly brokers we see ZeroGEX readers use most. We
              don&rsquo;t rank them — they&rsquo;re each better at something. Skim the table,
              pick the one whose commission structure, approval speed, and workflow fit how you
              actually trade.
            </p>
          </header>

          <section
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              overflow: 'hidden',
              background: C.card,
              marginBottom: 40,
            }}
            className="hidden lg:block"
          >
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 940,
                }}
              >
                <thead>
                  <tr>
                    <th style={th}>Broker</th>
                    <th style={th}>Commission</th>
                    <th style={th}>Options approval</th>
                    <th style={th}>API</th>
                    <th style={th}>One pro</th>
                    <th style={th}>One con</th>
                    <th style={{ ...th, textAlign: 'right' }}>Open account</th>
                  </tr>
                </thead>
                <tbody>
                  {BROKER_ROWS.map((broker, idx) => (
                    <BrokerRow key={broker.slug} broker={broker} index={idx} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 14,
              marginBottom: 40,
            }}
            className="lg:hidden"
          >
            {BROKER_ROWS.map((broker) => (
              <BrokerCardMobile key={broker.slug} broker={broker} />
            ))}
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2
              style={{
                margin: '0 0 16px 0',
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: '-0.3px',
              }}
            >
              Frequently asked
            </h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {FAQ_ITEMS.map((item, idx) => (
                <FaqRow key={item.q} item={item} initiallyOpen={idx === 0} />
              ))}
            </div>
          </section>

          <section
            style={{
              border: `1px solid ${C.brand}44`,
              background: `linear-gradient(135deg, ${C.brand}10 0%, ${C.card} 100%)`,
              borderRadius: 18,
              padding: 28,
              marginBottom: 24,
            }}
          >
            <h2 style={{ margin: '0 0 8px 0', fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px' }}>
              Already trading?
            </h2>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: C.muted, maxWidth: 720 }}>
              You don&rsquo;t need to switch brokers to use ZeroGEX. The dealer-gamma read
              works with any broker that lets you trade SPX, SPY, or QQQ options. Levels
              refresh every 15 minutes on our free{' '}
              <Link href="/spx-gamma-levels" style={{ color: C.brand }}>
                /spx-gamma-levels
              </Link>{' '}
              page, and the paid tiers add real-time flow, MSI, and the playbook engine.
            </p>
          </section>

          <p
            style={{
              margin: '24px 0 0 0',
              fontSize: 12,
              color: C.muted,
              lineHeight: 1.65,
              opacity: 0.85,
            }}
          >
            ZeroGEX participates in affiliate programs with the brokers listed above. When you
            open an account through a link on this page we may earn a commission — this does
            not affect the price you pay, the interest rate you receive, or the features
            available to you. Full details in our{' '}
            <Link href="/terms#advertising-disclosure" style={{ color: C.brand }}>
              advertising disclosure
            </Link>
            .
          </p>
        </div>
      </main>

      <Footer theme={theme} />
    </div>
  );
}
