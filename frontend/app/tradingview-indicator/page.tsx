import type { Metadata } from 'next';
import IndicatorPageShell from '@/components/IndicatorPageShell';
import IntegrationsStrip from '@/components/IntegrationsStrip';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import PlotOnTradingView from '@/components/PlotOnTradingView';
import { SITE_DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/core/articleRegistry';
import { INTEGRATIONS_HUB, integrationById } from '@/core/integrations';

// Standalone home for the free TradingView script. The gamma-levels pages
// already carry this section under today's level cards; this route gives the
// indicator its own URL — one to link from the published TradingView script,
// from X/StockTwits posts, and from the nav — without a second copy of the
// copy. <PlotOnTradingView standalone /> is the same component those pages
// render, so the two can never say different things.
//
// It now sits under /integrations rather than beside it: the menus link only
// the hub, so the breadcrumb parent is what keeps this page's place in the
// site's structure legible to a reader and to Google.

const INTEGRATION = integrationById('tradingview');
const PATH = INTEGRATION.href;
const TITLE = 'ZeroGEX Daily Gamma Levels — Free TradingView Indicator';
const DESCRIPTION =
  'Free TradingView indicator that plots the ZeroGEX gamma flip, call wall, put wall, and max pain as horizontal lines on SPY, SPX, QQQ, NDX, ES or NQ — with optional cross-alerts.';

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
  applicationSubCategory: 'TradingView indicator',
  operatingSystem: 'TradingView (web, desktop, mobile)',
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
};

export default function TradingViewIndicatorPage() {
  return (
    <IndicatorPageShell
      crumb={INTEGRATION.navLabel}
      path={PATH}
      parent={{ name: INTEGRATIONS_HUB.crumb, url: INTEGRATIONS_HUB.href }}
      jsonLd={JSON_LD}
    >
      <PlotOnTradingView standalone />

      <IntegrationsStrip exclude="tradingview" />

      <LiveLevelsCTA
        headline="Get today's numbers to type in"
        intro="The script draws the lines; these pages are where the levels come from. Each one is free and delayed roughly 15 minutes — open the ticker you trade, then copy its four numbers into the indicator's Settings."
      />
    </IndicatorPageShell>
  );
}
