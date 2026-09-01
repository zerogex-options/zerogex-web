import type { Metadata } from 'next';
import IndicatorPageShell from '@/components/IndicatorPageShell';
import IntegrationsStrip from '@/components/IntegrationsStrip';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import PlotOnNinjaTrader from '@/components/PlotOnNinjaTrader';
import { SITE_DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/core/articleRegistry';
import { INTEGRATIONS_HUB, integrationById } from '@/core/integrations';
import { NT_PACKAGE_PATH } from '@/core/ninjaTraderManifest';

// Standalone home for the NinjaTrader 8 indicator — the auto-updating, Pro
// counterpart to /tradingview-indicator. Same section the gamma-levels pages
// render under today's cards, same `hasPackage` build-time switch, so the
// download button here can never point at an archive that was not published.
//
// The route stays public (see integrationRoutes() in core/integrations.ts,
// spread into PUBLIC_ROUTE_PATTERNS): this is a marketing and
// how-to landing that has to be crawlable and readable by non-members. The
// DOWNLOAD inside it is what's gated, and PlotOnNinjaTrader does that on its
// own — so there is deliberately no tier check here. Anything added to this
// page that links the .cs or .zip directly would bypass that gate.

const INTEGRATION = integrationById('ninjatrader');
const PATH = INTEGRATION.href;
const TITLE = 'ZeroGEX Gamma Levels — Auto-Updating NinjaTrader 8 Indicator';
const DESCRIPTION =
  'A NinjaTrader 8 indicator that draws the ZeroGEX gamma flip, call wall, put wall, max pain, and pin strike on your chart and keeps them current — it polls the ZeroGEX API, so you never retype a number. Included with ZeroGEX Pro, along with the API key it needs.';

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
  name: 'ZeroGEX Gamma Levels',
  applicationCategory: 'FinanceApplication',
  applicationSubCategory: 'NinjaTrader 8 indicator',
  operatingSystem: 'NinjaTrader 8 (Windows)',
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
  // Both the download and the key it needs are Pro entitlements, so this must
  // not carry the zero-priced Offer its TradingView sibling legitimately does —
  // that would be structured data telling search engines the thing is free
  // while the page shows an upgrade button. No price is asserted here because
  // plan pricing lives on /pricing and would go stale duplicated into a
  // constant; the Offer points there instead.
  isAccessibleForFree: false,
  offers: { '@type': 'Offer', url: `${SITE_URL}/pricing?plan=pro`, category: 'subscription' },
  publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
};

export default function NinjaTraderIndicatorPage() {
  return (
    <IndicatorPageShell
      crumb={INTEGRATION.navLabel}
      path={PATH}
      parent={{ name: INTEGRATIONS_HUB.crumb, url: INTEGRATIONS_HUB.href }}
      jsonLd={JSON_LD}
    >
      <PlotOnNinjaTrader hasPackage={NT_PACKAGE_PATH !== null} standalone />

      <IntegrationsStrip exclude="ninjatrader" />

      <LiveLevelsCTA
        headline="See the levels the indicator draws"
        intro="The same Gamma Flip, Call Wall, Put Wall, and Max Pain the indicator pulls are published free on every ticker page — delayed roughly 15 minutes, no signup, and a useful sanity check while you get the key wired up."
      />
    </IndicatorPageShell>
  );
}
