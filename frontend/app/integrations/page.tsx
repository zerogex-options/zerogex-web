import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, PencilLine, RefreshCw } from 'lucide-react';
import IndicatorPageShell from '@/components/IndicatorPageShell';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import { SITE_DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/core/articleRegistry';
import { INTEGRATIONS, INTEGRATIONS_HUB, type Integration } from '@/core/integrations';

// The parent page for every chart-platform integration.
//
// It exists to solve two problems at once. The menus and footer used to list
// each platform separately, which does not survive going from two to four —
// the sidebar's "More" group would have been half brand names. And a visitor
// who does not already know which of the four they want had nowhere to compare
// them, because each landing only ever cross-linked the one other page.
//
// Every card here is rendered from core/integrations.ts, the same registry the
// individual landings build their own headings and breadcrumbs from, so this
// page cannot fall out of date with them.

const PATH = INTEGRATIONS_HUB.href;
const TITLE = 'ZeroGEX Chart Integrations — TradingView, thinkorswim, NinjaTrader & Sierra Chart';
const DESCRIPTION =
  'Plot ZeroGEX gamma levels on the platform you already trade from. Free manual-entry scripts for TradingView and thinkorswim, and auto-updating Pro studies for NinjaTrader 8 and Sierra Chart that poll the ZeroGEX API.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}${PATH}`,
    siteName: SITE_NAME,
    images: [{ url: SITE_DEFAULT_OG_IMAGE, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [SITE_DEFAULT_OG_IMAGE],
  },
};

// ItemList rather than SoftwareApplication: this page is the index of the four,
// and each individual landing already declares its own SoftwareApplication.
// Declaring a fifth application here would compete with them for the same
// entity.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'ZeroGEX chart-platform integrations',
  description: DESCRIPTION,
  url: `${SITE_URL}${PATH}`,
  numberOfItems: INTEGRATIONS.length,
  itemListElement: INTEGRATIONS.map((entry, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: `${entry.platform} — ${entry.cardTitle}`,
    url: `${SITE_URL}${entry.href}`,
  })),
};

const AUTO_UPDATING = INTEGRATIONS.filter((entry) => entry.updates === 'auto');
const MANUAL_ENTRY = INTEGRATIONS.filter((entry) => entry.updates === 'manual');

function IntegrationCard({ entry }: { entry: Integration }) {
  return (
    <Link
      href={entry.href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border-default)',
        borderRadius: 16,
        padding: '24px',
        textDecoration: 'none',
        color: 'inherit',
        background: 'var(--color-surface)',
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: `var(${entry.accent})`,
            border: `1px solid var(${entry.accent})44`,
            background: `var(${entry.accent})14`,
            borderRadius: 999,
            padding: '4px 11px',
          }}
        >
          {entry.tier === 'pro' ? 'Pro' : 'Free'}
        </span>
        <span
          className="zg-caption"
          style={{ fontFamily: 'var(--font-mono, monospace)', opacity: 0.75 }}
        >
          {entry.language}
        </span>
      </div>

      <h3 style={{ margin: '0 0 4px 0', fontSize: 21, fontWeight: 800, letterSpacing: '-0.2px' }}>
        {entry.platform}
      </h3>
      <p style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
        {entry.cardTitle}
      </p>

      <p
        style={{
          margin: '0 0 16px 0',
          fontSize: 13.5,
          lineHeight: 1.65,
          color: 'var(--color-text-secondary)',
          flex: 1,
        }}
      >
        {entry.blurb}
      </p>

      <div
        style={{
          paddingTop: 14,
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 12,
          lineHeight: 1.6,
          color: 'var(--color-text-secondary)',
          marginBottom: 14,
        }}
      >
        <div style={{ opacity: 0.75, marginBottom: 4 }}>Draws</div>
        <div style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{entry.levels}</div>
      </div>

      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 13.5,
          fontWeight: 800,
          color: `var(${entry.accent})`,
        }}
      >
        Set it up <ArrowRight size={15} />
      </span>
    </Link>
  );
}

function Group({
  title,
  intro,
  icon,
  entries,
}: {
  title: string;
  intro: string;
  icon: React.ReactNode;
  entries: readonly Integration[];
}) {
  return (
    <section style={{ marginBottom: 48 }}>
      <h2
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          margin: '0 0 8px 0',
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: '-0.2px',
        }}
      >
        {icon}
        {title}
      </h2>
      <p
        style={{
          margin: '0 0 20px 0',
          fontSize: 14.5,
          lineHeight: 1.7,
          color: 'var(--color-text-secondary)',
          maxWidth: 760,
        }}
      >
        {intro}
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 18,
        }}
      >
        {entries.map((entry) => (
          <IntegrationCard key={entry.id} entry={entry} />
        ))}
      </div>
    </section>
  );
}

export default function IntegrationsPage() {
  return (
    <IndicatorPageShell crumb={INTEGRATIONS_HUB.crumb} path={PATH} jsonLd={JSON_LD}>
      <header style={{ marginBottom: 44 }}>
        <h1
          style={{
            margin: '0 0 16px 0',
            fontSize: 'clamp(28px, 4.2vw, 38px)',
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: '-0.4px',
          }}
        >
          Plot ZeroGEX gamma levels on your own charts
        </h1>
        <p
          style={{
            margin: '0 0 12px 0',
            fontSize: 16,
            lineHeight: 1.7,
            color: 'var(--color-text-secondary)',
            maxWidth: 760,
          }}
        >
          The Gamma Flip, Call Wall, Put Wall and Max Pain are only useful next to price. These are the
          {' '}{INTEGRATIONS.length} ways to get them onto the platform you already trade from — the same
          levels, drawn where you are looking.
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--color-text-secondary)',
            opacity: 0.85,
            maxWidth: 760,
          }}
        >
          The split below is not a pricing decision — it is a platform one. TradingView&apos;s Pine Script and
          thinkorswim&apos;s thinkScript are sandboxed and cannot make network calls, so nothing on those
          platforms can fetch live levels. NinjaScript and ACSIL are C# and C++, so those two can, and do.
        </p>
      </header>

      <Group
        title="Auto-updating"
        icon={<RefreshCw size={19} style={{ color: 'var(--color-brand-accent)' }} />}
        intro="These poll the ZeroGEX API on a timer and redraw themselves — set the symbol once and the levels stay current all session, including across a futures roll. Both need a ZeroGEX API key, which comes with Pro."
        entries={AUTO_UPDATING}
      />

      <Group
        title="Free · manual entry"
        icon={<PencilLine size={19} style={{ color: 'var(--color-brand-primary)' }} />}
        intro="You type today's four numbers in once, from the free gamma-levels pages below, and the script draws them. No account, no API key, nothing withheld — the levels themselves are public and delayed roughly 15 minutes."
        entries={MANUAL_ENTRY}
      />

      <LiveLevelsCTA
        headline="Where today's numbers come from"
        intro="Every integration above draws the same four levels these pages publish. The free ones ask you to copy them across; the Pro ones fetch them for you."
      />
    </IndicatorPageShell>
  );
}
