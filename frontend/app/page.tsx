import type { Metadata } from 'next';
import LandingClient from './LandingClient';
import { serverApiGet } from '@/core/api/serverFetch';
import { SITE_NAME } from '@/core/articleRegistry';
import { OG_IMAGE_PATH, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '@/core/ogImageManifest';
import {
  summarizeForecastHistory,
  FORECAST_HISTORY_LIMIT,
  type ForecastDateEntry,
  type HistorySummary,
} from '@/core/trackRecord';

// The homepage stats bar counts modules, refresh rate and symbols — capability
// claims, none of which say whether any of it works. The graded record does,
// so it is fetched here and handed down: LandingClient is a client component
// and cannot fetch it itself.
//
// Only the dated archive, no rolling-stats call. The rolling window reads
// 29 of 29 on SPX where the record reads 48 of 55, and the homepage is the
// last place the flattering-but-narrower number should appear.
export const revalidate = 1800;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  // The root layout sets no og:url, since every page would inherit it, so the
  // homepage states its own. A page's openGraph replaces the root's object
  // rather than merging into it, so the card image has to be restated too.
  openGraph: {
    url: '/',
    siteName: SITE_NAME,
    images: [{ url: OG_IMAGE_PATH, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: 'ZeroGEX Options Analytics Platform' }],
    locale: 'en_US',
    type: 'website',
  },
};

async function loadTrackRecord(): Promise<HistorySummary | null> {
  const list = await serverApiGet<{ dates: ForecastDateEntry[] }>(
    `/api/forecast/available-dates?symbol=SPX&limit=${FORECAST_HISTORY_LIMIT}`,
    revalidate,
  );
  if (!list?.dates?.length) return null;
  return summarizeForecastHistory(list.dates, 'SPX');
}

export default async function HomePage() {
  return <LandingClient trackRecord={await loadTrackRecord()} />;
}
