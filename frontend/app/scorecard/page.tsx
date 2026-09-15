import { redirect } from 'next/navigation';

// Landing route for /scorecard. The Scorecard's real pages are dated
// permalinks (/scorecard/{symbol}/{date}); this is the stable, linkable entry
// point that the sidebar, the sitemap and every signal page point at, so the
// receipt is reachable from inside the product instead of only from the daily
// post that links a specific date.
//
// Resolves the most recent COMPLETED session rather than today: before the
// close, today's scorecard is a partial day, and the first thing a reader sees
// should be a finished one. /scorecard/today remains the "whatever today is"
// URL for the X profile link.
//
// Dynamic rendering — prerendering would freeze the redirect to whatever day
// CI ran on.
export const dynamic = 'force-dynamic';

// The receipt is written after the close; give the engine a few minutes past
// 16:00 ET before today counts as finished.
const SETTLED_AFTER_MINUTES_ET = 16 * 60 + 15;

function etParts(): { date: Date; minutes: number } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? '00';
  // Build a UTC-anchored Date carrying the ET calendar date, so the weekday
  // arithmetic below is pure date math and never re-crosses a timezone.
  const date = new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`);
  const hour = get('hour') === '24' ? 0 : Number(get('hour'));
  return { date, minutes: hour * 60 + Number(get('minute')) };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Most recent weekday whose session has finished, in ET. */
export function latestCompletedSession(now = etParts()): string {
  const d = new Date(now.date);
  const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
  if (isWeekend || now.minutes < SETTLED_AFTER_MINUTES_ET) {
    do {
      d.setUTCDate(d.getUTCDate() - 1);
    } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  }
  return iso(d);
}

export default function ScorecardIndexPage() {
  redirect(`/scorecard/SPY/${latestCompletedSession()}`);
}
