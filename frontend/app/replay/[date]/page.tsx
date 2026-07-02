import { permanentRedirect } from 'next/navigation';

// Legacy /replay/[date] → new /replay/SPY/[date].  All historical
// replayable sessions came from SPY; the redirect keeps any share URLs
// that already went out (dated at /replay/{date}) resolving.
export default async function LegacyReplayDateRedirect({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  permanentRedirect(`/replay/SPY/${date}`);
}
