import type { Metadata } from 'next';
import IndicatorCrossLink from '@/components/IndicatorCrossLink';
import IndicatorPageShell from '@/components/IndicatorPageShell';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import PlotOnNinjaTrader from '@/components/PlotOnNinjaTrader';
import { SITE_DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/core/articleRegistry';
import { NT_PACKAGE_PATH } from '@/core/ninjaTraderManifest';

// Standalone home for the NinjaTrader 8 indicator — the auto-updating, Pro
// counterpart to /tradingview-indicator. Same section the gamma-levels pages
// render under today's cards, same `hasPackage` build-time switch, so the
// download button here can never point at an archive that was not published.

const PATH = '/ninjatrader-indicator';
const TITLE = 'ZeroGEX Gamma Levels — Auto-Updating NinjaTrader 8 Indicator';
const DESCRIPTION =
  'A NinjaTrader 8 indicator that draws the ZeroGEX gamma flip, call wall, put wall, max pain, and pin strike on your chart and keeps them current — it polls the ZeroGEX API, so you never retype a number. Free and open source; live data needs a Pro API key.';

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
  // The .cs is free and open; what costs money is the ZeroGEX API key that
  // feeds it, which is why the offer is zero-priced and the description says so.
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
};

export default function NinjaTraderIndicatorPage() {
  return (
    <IndicatorPageShell crumb="NinjaTrader Indicator" path={PATH} jsonLd={JSON_LD}>
      <PlotOnNinjaTrader hasPackage={NT_PACKAGE_PATH !== null} standalone />

      <IndicatorCrossLink
        eyebrow="Free · TradingView"
        accent="--color-brand-primary"
        title="Not on NinjaTrader?"
        body="We publish a free TradingView script for the same levels. Pine Script cannot make HTTP calls, so that one is manual-entry — you type today's Gamma Flip, Call Wall, Put Wall, and Max Pain into its Settings — but it needs no API key and works on any TradingView chart."
        href="/tradingview-indicator"
        cta="See the TradingView indicator"
      />

      <LiveLevelsCTA
        headline="See the levels the indicator draws"
        intro="The same Gamma Flip, Call Wall, Put Wall, and Max Pain the indicator pulls are published free on every ticker page — delayed roughly 15 minutes, no signup, and a useful sanity check while you get the key wired up."
      />
    </IndicatorPageShell>
  );
}
