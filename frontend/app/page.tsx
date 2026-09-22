import LandingClient from './LandingClient';
import { serverApiGet } from '@/core/api/serverFetch';
import {
  summarizeForecastHistory,
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

export const metadata = {
  alternates: { canonical: '/' },
};

async function loadTrackRecord(): Promise<HistorySummary | null> {
  const list = await serverApiGet<{ dates: ForecastDateEntry[] }>(
    '/api/forecast/available-dates?symbol=SPX&limit=400',
    revalidate,
  );
  if (!list?.dates?.length) return null;
  return summarizeForecastHistory(list.dates, 'SPX');
}

export default async function HomePage() {
  return <LandingClient trackRecord={await loadTrackRecord()} />;
}
