import type { Metadata } from 'next';
import IndicatorPageShell from '@/components/IndicatorPageShell';
import IntegrationsStrip from '@/components/IntegrationsStrip';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import PlotOnThinkorswim from '@/components/PlotOnThinkorswim';
import { SITE_DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/core/articleRegistry';
import { INTEGRATIONS_HUB, integrationById } from '@/core/integrations';
import { serverApiGet } from '@/core/api/serverFetch';

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

// The snapshot the copy button bakes into the study. SPX because this page is
// symbol-agnostic and SPX is the lead ticker everywhere else on the site; a
// reader who trades something else gets the same study from that ticker's
// gamma-levels page, already filled with ITS numbers.
//
// 900s to match the revalidate on the gamma-levels pages, so the two surfaces
// cannot show different levels for the same minute. serverApiGet returns null
// on any failure — an unset token, an unreachable backend, a non-2xx — and
// PlotOnThinkorswim falls back to the blank template and says so. This page is
// a public marketing landing, so a backend blip must cost the pre-fill, never
// the page.
interface LevelsSnapshot {
  timestamp: string;
  gamma_flip?: number | null;
  call_wall?: number | null;
  put_wall?: number | null;
  max_pain?: number | null;
}

export default async function ThinkorswimIndicatorPage() {
  const snapshot = await serverApiGet<LevelsSnapshot>(
    '/api/gex/summary?symbol=SPX&underlying=SPX',
    900,
  );

  return (
    <IndicatorPageShell
      crumb={INTEGRATION.navLabel}
      path={PATH}
      parent={{ name: INTEGRATIONS_HUB.crumb, url: INTEGRATIONS_HUB.href }}
      jsonLd={JSON_LD}
    >
      <PlotOnThinkorswim
        standalone
        levels={
          snapshot
            ? {
                symbol: 'SPX',
                gammaFlip: snapshot.gamma_flip,
                callWall: snapshot.call_wall,
                putWall: snapshot.put_wall,
                maxPain: snapshot.max_pain,
                asOf: snapshot.timestamp,
              }
            : null
        }
      />

      <IntegrationsStrip exclude="thinkorswim" />

      <LiveLevelsCTA
        headline="Trading something other than SPX?"
        intro="The copy button above fills in SPX. Every ticker page below carries the same section filled with its own numbers — open the one you trade and copy from there. All free, delayed roughly 15 minutes, no signup."
      />
    </IndicatorPageShell>
  );
}
