import type { Metadata } from 'next';
import IndicatorCrossLink from '@/components/IndicatorCrossLink';
import IndicatorPageShell from '@/components/IndicatorPageShell';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import PlotOnTradingView from '@/components/PlotOnTradingView';
import { SITE_DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/core/articleRegistry';

// Standalone home for the free TradingView script. The gamma-levels pages
// already carry this section under today's level cards; this route gives the
// indicator its own URL — one to link from the published TradingView script,
// from X/StockTwits posts, and from the nav — without a second copy of the
// copy. <PlotOnTradingView standalone /> is the same component those pages
// render, so the two can never say different things.

const PATH = '/tradingview-indicator';
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
    <IndicatorPageShell crumb="TradingView Indicator" path={PATH} jsonLd={JSON_LD}>
      <PlotOnTradingView standalone />

      <IndicatorCrossLink
        eyebrow="Pro · NinjaTrader 8"
        accent="--color-brand-accent"
        title="Want the levels to update themselves?"
        body="Pine Script cannot make HTTP calls, so the TradingView script is manual-entry by design. Our NinjaTrader 8 indicator is C#, so it polls the ZeroGEX API on a timer and redraws — Gamma Flip, Call Wall, Put Wall, Max Pain, and Pin Strike, without ever retyping a number."
        href="/ninjatrader-indicator"
        cta="See the NinjaTrader indicator"
      />

      <LiveLevelsCTA
        headline="Get today's numbers to type in"
        intro="The script draws the lines; these pages are where the levels come from. Each one is free and delayed roughly 15 minutes — open the ticker you trade, then copy its four numbers into the indicator's Settings."
      />
    </IndicatorPageShell>
  );
}
