import type { Metadata } from 'next';
import IndicatorPageShell from '@/components/IndicatorPageShell';
import IntegrationsStrip from '@/components/IntegrationsStrip';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import PlotOnThinkorswim from '@/components/PlotOnThinkorswim';
import { SITE_DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/core/articleRegistry';
import { INTEGRATIONS_HUB, integrationById } from '@/core/integrations';

// Standalone home for the free thinkorswim study — the Schwab-platform sibling
// of /tradingview-indicator. Same shape as that page: <PlotOnThinkorswim
// standalone /> is the same component the gamma-levels pages render under
// today's level cards, so the two surfaces cannot say different things.
//
// Route is public (see integrationRoutes() in core/integrations.ts, spread into
// PUBLIC_ROUTE_PATTERNS): marketing and how-to copy with no member data, and
// nothing on it to gate — the study is inert without numbers, and the numbers
// are on the free gamma-levels pages.

const INTEGRATION = integrationById('thinkorswim');
const PATH = INTEGRATION.href;
const TITLE = 'ZeroGEX Daily Gamma Levels — Free thinkorswim Study';
const DESCRIPTION =
  'Free thinkScript study that plots the ZeroGEX gamma flip, call wall, put wall, and max pain as horizontal lines on thinkorswim — desktop, web, and mobile — with optional cross-alerts.';

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

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ZeroGEX Daily Gamma Levels',
  applicationCategory: 'FinanceApplication',
  applicationSubCategory: 'thinkorswim study',
  operatingSystem: 'thinkorswim (desktop, web, mobile)',
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
  // Free in the same unqualified sense the TradingView script is: no account,
  // no key, nothing withheld. The zero-priced Offer is accurate here and would
  // not be on the two Pro integrations — see the note on /ninjatrader-indicator.
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
};

export default function ThinkorswimIndicatorPage() {
  return (
    <IndicatorPageShell
      crumb={INTEGRATION.navLabel}
      path={PATH}
      parent={{ name: INTEGRATIONS_HUB.crumb, url: INTEGRATIONS_HUB.href }}
      jsonLd={JSON_LD}
    >
      <PlotOnThinkorswim standalone />

      <IntegrationsStrip exclude="thinkorswim" />

      <LiveLevelsCTA
        headline="Get today's numbers to type in"
        intro="The study draws the lines; these pages are where the levels come from. Each one is free and delayed roughly 15 minutes — open the ticker you trade, then copy its four numbers into the study's settings."
      />
    </IndicatorPageShell>
  );
}
