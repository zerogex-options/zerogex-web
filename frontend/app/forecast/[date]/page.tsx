import { permanentRedirect } from 'next/navigation';

// Legacy /forecast/[date] → new /forecast/SPY/[date].  All historical
// forecast rows shipped with symbol=SPY, so the redirect target is
// unambiguous; the SymbolPicker on the new page lets users switch.
// permanentRedirect issues a 308 so Twitter/Slack crawlers cache the new
// URL and OG previews resolve against the symbol-aware handler.
export default async function LegacyForecastDateRedirect({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  permanentRedirect(`/forecast/SPY/${date}`);
}
