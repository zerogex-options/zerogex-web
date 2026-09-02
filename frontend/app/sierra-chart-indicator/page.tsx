import type { Metadata } from 'next';
import IndicatorPageShell from '@/components/IndicatorPageShell';
import IntegrationsStrip from '@/components/IntegrationsStrip';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import PlotOnSierraChart from '@/components/PlotOnSierraChart';
import { SITE_DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/core/articleRegistry';
import { INTEGRATIONS_HUB, integrationById } from '@/core/integrations';

// Standalone home for the Sierra Chart ACSIL study — the second auto-updating,
// Pro integration alongside /ninjatrader-indicator. Same section the
// gamma-levels pages render under today's cards.
//
// The route stays public (see integrationRoutes() in core/integrations.ts):
// this is a marketing and how-to landing that has to be crawlable and readable
// by non-members. The DOWNLOAD inside it is what's gated, and
// PlotOnSierraChart does that on its own — so there is deliberately no tier
// check here. Anything added to this page that links the .cpp directly would
// bypass that gate.

const INTEGRATION = integrationById('sierrachart');
const PATH = INTEGRATION.href;
const TITLE = 'ZeroGEX Gamma Levels — Auto-Updating Sierra Chart Study';
const DESCRIPTION =
  'A Sierra Chart ACSIL study that draws the ZeroGEX gamma flip, call wall, put wall, max pain, and pin strike on your chart and keeps them current — it polls the ZeroGEX API, so you never retype a number. Included with ZeroGEX Pro, along with the API key it needs.';

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
  applicationSubCategory: 'Sierra Chart study',
  operatingSystem: 'Sierra Chart (Windows)',
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
  // Both the download and the key it needs are Pro entitlements, so — exactly
  // as on /ninjatrader-indicator — this must not carry the zero-priced Offer
  // its free siblings legitimately do. No price is asserted because plan
  // pricing lives on /pricing and would go stale duplicated into a constant.
  isAccessibleForFree: false,
  offers: { '@type': 'Offer', url: `${SITE_URL}/pricing?plan=pro`, category: 'subscription' },
  publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
};

export default function SierraChartIndicatorPage() {
  return (
    <IndicatorPageShell
      crumb={INTEGRATION.navLabel}
      path={PATH}
      parent={{ name: INTEGRATIONS_HUB.crumb, url: INTEGRATIONS_HUB.href }}
      jsonLd={JSON_LD}
    >
      <PlotOnSierraChart standalone />

      <IntegrationsStrip exclude="sierrachart" />

      <LiveLevelsCTA
        headline="See the levels the study draws"
        intro="The same Gamma Flip, Call Wall, Put Wall, and Max Pain the study pulls are published free on every ticker page — delayed roughly 15 minutes, no signup, and a useful sanity check while you get the key wired up."
      />
    </IndicatorPageShell>
  );
}
