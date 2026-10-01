// Paid churn, day by day: how many paying members clicked Cancel, against how
// many paying members there were. Every number on Admin → Monitoring → Churn
// comes from here, fed by core/churnReportServer.ts.
//
// Pure, with no imports, so the arithmetic is tested without a database
// (tests/churnSeries.test.ts).
//
// The two inputs are the dashboard's own numbers, so the tab cannot disagree
// with the screens the operator checks it against:
//   • a paid cancel is a "Cancellation scheduled: paid subscription" row of the
//     Subscriber Ledger (core/subscriberBucket.ts), one per click, on its New
//     York day;
//   • paying members is the Full Subscriber line of the Total Subscribers chart,
//     its daily samples carried forward over days with none, as the chart does.
//
// MONTHLY CHURN is each day's paid cancels as a share of that day's paying
// members, added up over the 30 days ending that day. The textbook alternative,
// a month's cancels divided by the headcount at the START of the month, misses
// everyone who joined during the month and still counts their cancels, so it
// reads high whenever membership grows fast: in August 2026, when membership
// doubled, it showed 50% while this measure showed 27%.

export const CHURN_WINDOW_DAYS = 30;
const RECENT_DAYS = 7;
const DAY_MS = 86_400_000;

export type ChurnDay = {
  /** New York calendar day, YYYY-MM-DD. */
  day: string;
  paidCancels: number;
  /** Full Subscriber count that day, or null before the chart has a sample. */
  paying: number | null;
  /** paidCancels as a percent of paying, or null when paying is unknown. */
  shareOfPaying: number | null;
  /** Percent; null until 30 days with a known headcount end on this day. */
  monthlyChurn: number | null;
  /** Paid cancels in the 30 days ending on this day. */
  paidCancels30d: number;
};

export type ChurnSummary = {
  startDay: string;
  endDay: string;
  payingNow: number | null;
  payingAtStart: number | null;
  paidCancels30d: number;
  paidCancels7d: number;
  /**
   * The most paid cancels in any 7 days that end inside the range before the
   * last 7 days, or null when the range is too short to have one.
   */
  previousHigh7d: number | null;
  monthlyChurnNow: number | null;
  /** Over the days in range that have a monthly churn figure; null if none do. */
  monthlyChurnRange: {
    low: number;
    lowDay: string;
    high: number;
    highDay: string;
    average: number;
  } | null;
};

export type ChurnReport = {
  windowDays: number;
  days: ChurnDay[];
  summary: ChurnSummary;
};

/** The day `delta` days from `day`. Calendar arithmetic, so DST cannot skip a day. */
export function shiftDay(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

export function buildChurnReport(input: {
  /** Today's New York day. */
  today: string;
  /** Days to report, ending today. */
  windowDays: number;
  /** One New York day per paid cancel. */
  paidCancelDays: readonly string[];
  /** Full Subscriber samples, one per day at most, in any order. */
  payingByDay: ReadonlyArray<{ day: string; paying: number }>;
}): ChurnReport {
  const windowDays = Math.max(1, Math.floor(input.windowDays));
  const lead = CHURN_WINDOW_DAYS - 1;

  // The range plus the 29 days before it, so its first day has a full month
  // behind it whenever the history goes back that far.
  const allDays: string[] = [];
  for (let i = windowDays + lead - 1; i >= 0; i--) allDays.push(shiftDay(input.today, -i));

  const cancelsOn = new Map<string, number>();
  for (const day of input.paidCancelDays) cancelsOn.set(day, (cancelsOn.get(day) ?? 0) + 1);

  // Carry the latest sample on or before each day forward. A day before the
  // first sample, or one whose sample is 0, has no usable headcount.
  const samples = [...input.payingByDay].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const paying: Array<number | null> = [];
  let next = 0;
  let latest: number | null = null;
  for (const day of allDays) {
    while (next < samples.length && samples[next].day <= day) latest = samples[next++].paying;
    paying.push(latest !== null && latest > 0 ? latest : null);
  }

  const cancels = allDays.map((day) => cancelsOn.get(day) ?? 0);
  const share = cancels.map((n, i) => (paying[i] === null ? null : (100 * n) / (paying[i] as number)));

  const days: ChurnDay[] = [];
  for (let i = lead; i < allDays.length; i++) {
    let cancels30 = 0;
    let churn: number | null = 0;
    for (let j = i - lead; j <= i; j++) {
      cancels30 += cancels[j];
      churn = churn === null || share[j] === null ? null : churn + (share[j] as number);
    }
    days.push({
      day: allDays[i],
      paidCancels: cancels[i],
      paying: paying[i],
      shareOfPaying: share[i],
      monthlyChurn: churn,
      paidCancels30d: cancels30,
    });
  }

  return { windowDays, days, summary: summarize(days) };
}

function summarize(days: ChurnDay[]): ChurnSummary {
  const last = days[days.length - 1];
  const sumCancels = (from: number, to: number) => {
    let n = 0;
    for (let i = Math.max(0, from); i <= to; i++) n += days[i].paidCancels;
    return n;
  };

  const lastIndex = days.length - 1;
  let previousHigh7d: number | null = null;
  // Windows that end before the last 7 days begin, and lie wholly in range.
  for (let end = RECENT_DAYS - 1; end <= lastIndex - RECENT_DAYS; end++) {
    const n = sumCancels(end - RECENT_DAYS + 1, end);
    if (previousHigh7d === null || n > previousHigh7d) previousHigh7d = n;
  }

  let range: ChurnSummary['monthlyChurnRange'] = null;
  let total = 0;
  let counted = 0;
  for (const d of days) {
    if (d.monthlyChurn === null) continue;
    total += d.monthlyChurn;
    counted += 1;
    if (!range) {
      range = { low: d.monthlyChurn, lowDay: d.day, high: d.monthlyChurn, highDay: d.day, average: 0 };
      continue;
    }
    if (d.monthlyChurn < range.low) {
      range.low = d.monthlyChurn;
      range.lowDay = d.day;
    }
    if (d.monthlyChurn > range.high) {
      range.high = d.monthlyChurn;
      range.highDay = d.day;
    }
  }
  if (range) range.average = total / counted;

  return {
    startDay: days[0].day,
    endDay: last.day,
    payingNow: last.paying,
    payingAtStart: days[0].paying,
    paidCancels30d: last.paidCancels30d,
    paidCancels7d: sumCancels(lastIndex - RECENT_DAYS + 1, lastIndex),
    previousHigh7d,
    monthlyChurnNow: last.monthlyChurn,
    monthlyChurnRange: range,
  };
}

/**
 * What an average monthly churn implies, or null when it implies nothing (no
 * churn figure, or none of it). `staysMonths` is the expected time a paying
 * member stays at that rate; `lossesPerMonth` is how many of `payingNow` cancel
 * in a typical month, which is also how many new paying members a month it takes
 * to hold the headcount steady.
 */
export function churnImplications(
  averageMonthlyChurn: number | null,
  payingNow: number | null,
): { staysMonths: number; lossesPerMonth: number | null } | null {
  if (averageMonthlyChurn === null || !(averageMonthlyChurn > 0)) return null;
  return {
    staysMonths: 100 / averageMonthlyChurn,
    lossesPerMonth: payingNow === null ? null : (payingNow * averageMonthlyChurn) / 100,
  };
}
