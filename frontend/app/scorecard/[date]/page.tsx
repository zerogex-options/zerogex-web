import { permanentRedirect } from 'next/navigation';

// Legacy /scorecard/[date] → new /scorecard/SPY/[date].  All previously
// tweeted scorecard URLs were SPY-only; the redirect makes those tweets
// still resolve.
export default async function LegacyScorecardDateRedirect({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  permanentRedirect(`/scorecard/SPY/${date}`);
}
