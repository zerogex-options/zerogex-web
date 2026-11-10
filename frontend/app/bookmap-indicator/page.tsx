import type { Metadata } from 'next';
import IndicatorPageShell from '@/components/IndicatorPageShell';
import IntegrationsStrip from '@/components/IntegrationsStrip';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import PlotOnBookmap from '@/components/PlotOnBookmap';
import { PUBLISHER_REF, SITE_DEFAULT_OG_IMAGE, SITE_NAME, SITE_TWITTER_HANDLE, SITE_URL } from '@/core/articleRegistry';
import { LIST_PRICE_USD } from '@/core/billingPlans';
import { INTEGRATIONS_HUB, integrationById } from '@/core/integrations';

// Home of the Bookmap add-on — the third auto-updating, Pro integration,
// alongside /ninjatrader-indicator and /sierra-chart-indicator.
//
// The route stays public (see integrationRoutes() in core/integrations.ts):
// a marketing and how-to landing that has to be crawlable and readable by
// non-members. The DOWNLOAD inside it is what's gated, and PlotOnBookmap does
// that on its own, so there is deliberately no tier check here. Anything added
// to this page that links the jar directly would bypass that gate.
//
// No BrokerConnectionNote: core/brokerConnections.ts lists the routes we have
// verified to an IBKR account, and Bookmap is not one of them.

const INTEGRATION = integrationById('bookmap');
const PATH = INTEGRATION.href;
const TITLE = 'ZeroGEX Gamma Levels - Auto-Updating Bookmap Add-on';
const DESCRIPTION =
  'Bookmap add-on that draws the ZeroGEX gamma flip, call wall, put wall, max pain and pin strike on your heatmap with their history, a per-strike gamma profile and alerts, and keeps them current from the API. Included with Pro.';

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
    site: SITE_TWITTER_HANDLE,
    title: TITLE,
    description: DESCRIPTION,
    images: [SITE_DEFAULT_OG_IMAGE],
  },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ZeroGEX Gamma Levels',
  applicationCategory: 'FinanceApplication',
  applicationSubCategory: 'Bookmap add-on',
  operatingSystem: 'Bookmap 7 and 8 (Windows, macOS)',
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
  // Both the download and the key it needs are Pro entitlements, so, as on the
  // NinjaTrader and Sierra Chart landings, this carries the Pro monthly list
  // price from the same constant /pricing renders, never a zero-priced Offer.
  isAccessibleForFree: false,
  offers: {
    '@type': 'Offer',
    '@id': `${SITE_URL}/pricing#pro-monthly`,
    price: String(LIST_PRICE_USD.pro.monthly),
    priceCurrency: 'USD',
    url: `${SITE_URL}/pricing?plan=pro`,
    category: 'subscription',
  },
  publisher: PUBLISHER_REF,
};

export default function BookmapIndicatorPage() {
  return (
    <IndicatorPageShell
      crumb={INTEGRATION.navLabel}
      path={PATH}
      parent={{ name: INTEGRATIONS_HUB.crumb, url: INTEGRATIONS_HUB.href }}
      jsonLd={JSON_LD}
    >
      <PlotOnBookmap standalone />

      <IntegrationsStrip exclude="bookmap" />

      <LiveLevelsCTA
        headline="See the levels the add-on draws"
        intro="The same Gamma Flip, Call Wall, Put Wall, and Max Pain the add-on reads are published free on every ticker page&nbsp;- delayed roughly 15 minutes, no signup, and a useful sanity check while you get the key wired up."
      />
    </IndicatorPageShell>
  );
}
