import { redirect } from 'next/navigation';

// /forecast/today resolves to today's ET calendar date and 308-redirects
// to /forecast/YYYY-MM-DD. Stable URL for "today's forecast" CTAs that
// shouldn't bake a date into the link.
export const dynamic = 'force-dynamic';

function todayInET(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const yyyy = parts.find((p) => p.type === 'year')?.value;
  const mm = parts.find((p) => p.type === 'month')?.value;
  const dd = parts.find((p) => p.type === 'day')?.value;
  return `${yyyy}-${mm}-${dd}`;
}

export default function ForecastTodayPage() {
  redirect(`/forecast/SPY/${todayInET()}`);
}
