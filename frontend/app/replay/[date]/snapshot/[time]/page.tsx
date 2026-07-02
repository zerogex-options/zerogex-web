import { permanentRedirect } from 'next/navigation';

// Legacy /replay/[date]/snapshot/[time] → new symbol-aware path.
export default async function LegacyReplaySnapshotRedirect({
  params,
}: {
  params: Promise<{ date: string; time: string }>;
}) {
  const { date, time } = await params;
  permanentRedirect(`/replay/SPY/${date}/snapshot/${time}`);
}
