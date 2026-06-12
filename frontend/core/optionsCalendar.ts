// Special options calendar: OPEX, witching, VIX expiration, quarter-end, etc.
//
// All dates are anchored to America/New_York calendar days. We use noon-ET as
// the reference instant for each event so DST transitions and UTC offsets do
// not push the "days until" count off by one.

export type OptionsEventKind =
  | "opex"
  | "quad-witching"
  | "vix-expiration"
  | "quarter-end"
  | "month-end"
  | "jpm-collar"
  | "russell-rebalance";

export interface OptionsEvent {
  kind: OptionsEventKind;
  label: string;
  shortLabel: string;
  date: Date;
  isoDate: string;
  description: string;
  daysUntil: number;
}

// US weekday number for a given date in ET. 0 = Sunday, 6 = Saturday.
function etWeekday(year: number, month: number, day: number): number {
  // Construct as UTC noon so timezone conversions don't shift the weekday.
  const d = new Date(Date.UTC(year, month - 1, day, 17, 0, 0));
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// Date for noon ET on the given calendar day. Returned as a UTC Date instance.
function etNoon(year: number, month: number, day: number): Date {
  // 12:00 ET = 17:00 UTC during EST, 16:00 UTC during EDT. We pick 17:00 UTC
  // (which is 12:00 EST or 13:00 EDT) — either way it's the same calendar day
  // in ET, which is the only thing the date comparisons care about.
  return new Date(Date.UTC(year, month - 1, day, 17, 0, 0));
}

// Today's calendar day in ET. Returns { y, m, d }.
function todayInET(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  return { y, m, d };
}

// Whole calendar-day difference (target − today), both interpreted in ET.
function calendarDaysBetween(now: Date, target: Date): number {
  const t = todayInET(now);
  const todayNoon = etNoon(t.y, t.m, t.d);
  return Math.round((target.getTime() - todayNoon.getTime()) / 86400000);
}

// 3rd Friday of a given month.
function thirdFriday(year: number, month: number): { y: number; m: number; d: number } {
  // Find the first Friday, then add 14 days.
  for (let d = 1; d <= 7; d++) {
    if (etWeekday(year, month, d) === 5) {
      return { y: year, m: month, d: d + 14 };
    }
  }
  throw new Error("unreachable: no Friday found in first week");
}

// Last weekday (Mon–Fri) of a given month.
function lastWeekdayOfMonth(year: number, month: number): { y: number; m: number; d: number } {
  let d = daysInMonth(year, month);
  while (d > 0) {
    const wd = etWeekday(year, month, d);
    if (wd >= 1 && wd <= 5) return { y: year, m: month, d };
    d--;
  }
  throw new Error("unreachable: month with no weekdays");
}

// VIX options/futures expiration: the Wednesday that falls 30 days before the
// 3rd Friday of the following calendar month. If that Wednesday is a holiday,
// it shifts to Tuesday — we ignore that edge case here for simplicity.
function vixExpiration(year: number, month: number): { y: number; m: number; d: number } {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nf = thirdFriday(nextYear, nextMonth);
  // 30 calendar days before the next month's 3rd Friday.
  const fridayUtc = Date.UTC(nf.y, nf.m - 1, nf.d, 17, 0, 0);
  const wedUtc = fridayUtc - 30 * 86400000;
  const wedDate = new Date(wedUtc);
  return {
    y: wedDate.getUTCFullYear(),
    m: wedDate.getUTCMonth() + 1,
    d: wedDate.getUTCDate(),
  };
}

function isQuarterEndMonth(month: number): boolean {
  return month === 3 || month === 6 || month === 9 || month === 12;
}

interface EventSeed {
  kind: OptionsEventKind;
  label: string;
  shortLabel: string;
  description: string;
  y: number;
  m: number;
  d: number;
}

// Build the raw event list for a single month, deduplicating events that fall
// on the same date (e.g. OPEX + Quad Witching in March/June/Sep/Dec).
function eventsForMonth(year: number, month: number): EventSeed[] {
  const seeds: EventSeed[] = [];
  const tf = thirdFriday(year, month);
  const isWitchingMonth = isQuarterEndMonth(month);

  if (isWitchingMonth) {
    seeds.push({
      kind: "quad-witching",
      label: "Quad Witching",
      shortLabel: "Quad Witching",
      description:
        "Stock index futures, index options, single-stock futures, and stock options all expire. Expect heavy volume and unusual open/close prints.",
      y: tf.y,
      m: tf.m,
      d: tf.d,
    });
  } else {
    seeds.push({
      kind: "opex",
      label: "Monthly OPEX",
      shortLabel: "OPEX",
      description:
        "Monthly options expiration (3rd Friday). Large gamma roll-off can unpin price and reset dealer positioning into the following week.",
      y: tf.y,
      m: tf.m,
      d: tf.d,
    });
  }

  const vx = vixExpiration(year, month);
  seeds.push({
    kind: "vix-expiration",
    label: "VIX Expiration",
    shortLabel: "VIX-peration",
    description:
      "VIX options & futures expire (Wed 30 days before next month's 3rd Friday). Often triggers vol-of-vol flushes and SPX hedge unwinds in the morning.",
    y: vx.y,
    m: vx.m,
    d: vx.d,
  });

  const lw = lastWeekdayOfMonth(year, month);
  if (isQuarterEndMonth(month)) {
    seeds.push({
      kind: "quarter-end",
      label: "Quarter End",
      shortLabel: "Q-End",
      description:
        "Quarter-end rebalancing. Pension funds and 60/40 portfolios reweight; closing auction prints can be sized in tens of billions.",
      y: lw.y,
      m: lw.m,
      d: lw.d,
    });
    seeds.push({
      kind: "jpm-collar",
      label: "JPM Collar Roll",
      shortLabel: "JPM Collar",
      description:
        "JPMorgan Hedged Equity Fund (JHEQX) rolls its quarterly SPX collar on the last business day. The new strikes act as gamma magnets for the next 3 months.",
      y: lw.y,
      m: lw.m,
      d: lw.d,
    });
  } else {
    seeds.push({
      kind: "month-end",
      label: "Month End",
      shortLabel: "Month End",
      description:
        "Month-end rebalancing flow. Smaller than quarter-end but still meaningful into the 4pm close.",
      y: lw.y,
      m: lw.m,
      d: lw.d,
    });
  }

  // Russell rebalance: last Friday of June.
  if (month === 6) {
    let day = daysInMonth(year, 6);
    while (etWeekday(year, 6, day) !== 5) day--;
    seeds.push({
      kind: "russell-rebalance",
      label: "Russell Rebalance",
      shortLabel: "Russell Rebal",
      description:
        "FTSE Russell annual reconstitution. Index additions/deletions print at the close — the highest-volume single print of the year for many small caps.",
      y: year,
      m: 6,
      d: day,
    });
  }

  return seeds;
}

export interface UpcomingEventsOptions {
  now?: Date;
  lookAheadDays?: number;
  maxEvents?: number;
}

export function getUpcomingOptionsEvents(opts: UpcomingEventsOptions = {}): OptionsEvent[] {
  const now = opts.now ?? new Date();
  const lookAhead = opts.lookAheadDays ?? 45;
  const maxEvents = opts.maxEvents ?? 8;

  const t = todayInET(now);
  // Scan current month + next 2 months to safely cover a 45-day window
  // (VIX expirations can sit ~30 days into the next month).
  const seeds: EventSeed[] = [];
  for (let offset = 0; offset <= 2; offset++) {
    const m = ((t.m - 1 + offset) % 12) + 1;
    const y = t.y + Math.floor((t.m - 1 + offset) / 12);
    seeds.push(...eventsForMonth(y, m));
  }

  // Group by date so OPEX + VIX-expiration that happen to collide get merged
  // into one bullet with a combined label. (Doesn't normally happen but cheap
  // insurance against rendering duplicates.)
  const byDate = new Map<string, EventSeed[]>();
  for (const s of seeds) {
    const key = `${s.y}-${String(s.m).padStart(2, "0")}-${String(s.d).padStart(2, "0")}`;
    const arr = byDate.get(key) ?? [];
    arr.push(s);
    byDate.set(key, arr);
  }

  const events: OptionsEvent[] = [];
  for (const [key, group] of byDate) {
    const first = group[0];
    const date = etNoon(first.y, first.m, first.d);
    const daysUntil = calendarDaysBetween(now, date);
    if (daysUntil < 0 || daysUntil > lookAhead) continue;

    for (const seed of group) {
      events.push({
        kind: seed.kind,
        label: seed.label,
        shortLabel: seed.shortLabel,
        date,
        isoDate: key,
        description: seed.description,
        daysUntil,
      });
    }
  }

  events.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    return a.kind.localeCompare(b.kind);
  });

  return events.slice(0, maxEvents);
}

export type EventUrgency = "today" | "tomorrow" | "soon" | "later";

export function urgencyForDaysUntil(daysUntil: number): EventUrgency {
  if (daysUntil <= 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  if (daysUntil <= 3) return "soon";
  return "later";
}

export interface UrgencyPalette {
  fg: string;
  bg: string;
  border: string;
  pillFg: string;
  pillBg: string;
}

// Color palette per urgency level. Today = coral/pink-purple, Tomorrow = amber,
// Soon (≤3d) and Later = muted gray.
export function urgencyPalette(
  urgency: EventUrgency,
  colors: {
    coral: string;
    primary: string;
    muted: string;
    bearish: string;
  },
): UrgencyPalette {
  switch (urgency) {
    case "today":
      return {
        fg: colors.coral,
        bg: `${colors.coral}1f`,
        border: `${colors.coral}66`,
        pillFg: "#FFFFFF",
        pillBg: colors.coral,
      };
    case "tomorrow":
      return {
        fg: colors.primary,
        bg: `${colors.primary}1f`,
        border: `${colors.primary}66`,
        pillFg: colors.primary,
        pillBg: `${colors.primary}26`,
      };
    case "soon":
    case "later":
      return {
        fg: colors.muted,
        bg: `${colors.muted}1a`,
        border: `${colors.muted}40`,
        pillFg: colors.muted,
        pillBg: `${colors.muted}26`,
      };
  }
}

export function formatRelativeDay(daysUntil: number): string {
  if (daysUntil <= 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `in ${daysUntil} days`;
}

export function formatEventDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
