import { redirect } from 'next/navigation';

// `/scorecard/today` is a stable URL that auto-resolves to today's
// America/New_York calendar date and 308-redirects to /scorecard/YYYY-MM-DD.
// Used by the brand X account profile link and any "today's recap" surface
// where we don't want to bake the date into the URL.
//
// Dynamic rendering — Next.js otherwise tries to prerender at build time,
// which would freeze the redirect to whatever today was when CI ran.
export const dynamic = 'force-dynamic';

function todayInET(): string {
  // Intl.DateTimeFormat is the only way to get a real ET calendar date
  // server-side without pulling in a date library; the iso parts give us
  // year/month/day in America/New_York regardless of the server's TZ.
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

export default function ScorecardTodayPage() {
  redirect(`/scorecard/SPY/${todayInET()}`);
}
