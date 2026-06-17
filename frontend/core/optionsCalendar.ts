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
  | "russell-rebalance"
  | "nyse-holiday";

export interface OptionsEvent {
  kind: OptionsEventKind;
  label: string;
  shortLabel: string;
  date: Date;
  isoDate: string;
  description: string;
  daysUntil: number;
}

// NYSE holiday calendar, loaded from NEXT_PUBLIC_NYSE_HOLIDAYS
// (comma-separated YYYY-MM-DD list). Used both to surface upcoming
// market closures and to shift other events (OPEX, VIX expiry, etc.)
// back to the previous business day when they land on a closed day —
// the classic case is Juneteenth landing on the 3rd Friday of June.
export interface NyseHoliday {
  isoDate: string;
  y: number;
  m: number;
  d: number;
  name: string;
}

export interface NyseHolidayCalendar {
  has(isoDate: string): boolean;
  get(isoDate: string): NyseHoliday | undefined;
  values(): NyseHoliday[];
}

export function parseNyseHolidays(raw: string | null | undefined): NyseHoliday[] {
  if (!raw) return [];
  const out: NyseHoliday[] = [];
  for (const token of raw.split(",")) {
    const s = token.trim();
    if (!s) continue;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!match) continue;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    if (m < 1 || m > 12 || d < 1 || d > 31) continue;
    out.push({
      isoDate: `${match[1]}-${match[2]}-${match[3]}`,
      y,
      m,
      d,
      name: nameForNyseHoliday(y, m, d),
    });
  }
  return out;
}

export function buildNyseHolidayCalendar(list: NyseHoliday[]): NyseHolidayCalendar {
  const map = new Map<string, NyseHoliday>();
  for (const h of list) map.set(h.isoDate, h);
  return {
    has: (iso) => map.has(iso),
    get: (iso) => map.get(iso),
    values: () => Array.from(map.values()),
  };
}

// Best-effort holiday-name inference from the date pattern. NYSE holidays
// follow well-known recurrences (3rd Monday of Jan = MLK, etc.), so we
// recognize them without needing a separate name list in env.
function nameForNyseHoliday(year: number, month: number, day: number): string {
  const wd = etWeekday(year, month, day);
  if (month === 1 && day <= 3) return "New Year's Day";
  if (month === 12 && day >= 23) return "Christmas";
  if (month === 7 && day >= 3 && day <= 5) return "Independence Day";
  if (month === 6 && day >= 18 && day <= 20) return "Juneteenth";
  if (month === 1 && wd === 1 && day >= 15 && day <= 21) return "MLK Day";
  if (month === 2 && wd === 1 && day >= 15 && day <= 21) return "Presidents Day";
  if (month === 5 && wd === 1 && day >= 25) return "Memorial Day";
  if (month === 9 && wd === 1 && day <= 7) return "Labor Day";
  if (month === 11 && wd === 4 && day >= 22 && day <= 28) return "Thanksgiving";
  if ((month === 3 || month === 4) && wd === 5) return "Good Friday";
  return "NYSE Holiday";
}

function isoFromYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Walk backwards from (y, m, d) until we land on a non-weekend, non-holiday
// trading day. Bounded loop guards against pathological inputs.
function previousBusinessDay(
  y: number,
  m: number,
  d: number,
  holidays: NyseHolidayCalendar,
): { y: number; m: number; d: number } {
  let cy = y;
  let cm = m;
  let cd = d;
  for (let i = 0; i < 14; i++) {
    const wd = etWeekday(cy, cm, cd);
    const iso = isoFromYmd(cy, cm, cd);
    if (wd >= 1 && wd <= 5 && !holidays.has(iso)) {
      return { y: cy, m: cm, d: cd };
    }
    if (cd > 1) {
      cd -= 1;
    } else {
      cm -= 1;
      if (cm < 1) {
        cm = 12;
        cy -= 1;
      }
      cd = daysInMonth(cy, cm);
    }
  }
  return { y: cy, m: cm, d: cd };
}

const DEFAULT_NYSE_HOLIDAYS: NyseHolidayCalendar = buildNyseHolidayCalendar(
  parseNyseHolidays(
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_NYSE_HOLIDAYS : undefined,
  ),
);

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

// Shift a seed back to the previous business day if it lands on a NYSE
// holiday. Equity OPEX / VIX expiry / quarter-end rebalances all observe
// the move-back-one-day convention when their nominal day is closed.
function shiftSeedIfClosed(seed: EventSeed, holidays: NyseHolidayCalendar): EventSeed {
  if (!holidays.has(isoFromYmd(seed.y, seed.m, seed.d))) return seed;
  const shifted = previousBusinessDay(seed.y, seed.m, seed.d, holidays);
  return { ...seed, y: shifted.y, m: shifted.m, d: shifted.d };
}

// Build the raw event list for a single month, deduplicating events that fall
// on the same date (e.g. OPEX + Quad Witching in March/June/Sep/Dec).
function eventsForMonth(
  year: number,
  month: number,
  holidays: NyseHolidayCalendar,
): EventSeed[] {
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

  // Surface NYSE holidays in this month as their own calendar entries so
  // traders can see upcoming market closures at a glance.
  for (const h of holidays.values()) {
    if (h.y !== year || h.m !== month) continue;
    seeds.push({
      kind: "nyse-holiday",
      label: `Market Closed — ${h.name}`,
      shortLabel: h.name,
      description: `NYSE is closed for ${h.name}. No equity or options trading; positioning carries over from the prior session's close.`,
      y: h.y,
      m: h.m,
      d: h.d,
    });
  }

  return seeds.map((seed) =>
    seed.kind === "nyse-holiday" ? seed : shiftSeedIfClosed(seed, holidays),
  );
}

export interface UpcomingEventsOptions {
  now?: Date;
  lookAheadDays?: number;
  maxEvents?: number;
  // Override the NYSE holiday calendar. Defaults to the list parsed from
  // NEXT_PUBLIC_NYSE_HOLIDAYS at module load. Pass [] to disable holiday
  // awareness entirely (useful in tests).
  holidays?: NyseHolidayCalendar | NyseHoliday[] | string[];
}

function resolveHolidays(
  override: UpcomingEventsOptions["holidays"],
): NyseHolidayCalendar {
  if (override === undefined) return DEFAULT_NYSE_HOLIDAYS;
  if (Array.isArray(override)) {
    if (override.length === 0) return buildNyseHolidayCalendar([]);
    if (typeof override[0] === "string") {
      return buildNyseHolidayCalendar(parseNyseHolidays((override as string[]).join(",")));
    }
    return buildNyseHolidayCalendar(override as NyseHoliday[]);
  }
  return override;
}

export function getUpcomingOptionsEvents(opts: UpcomingEventsOptions = {}): OptionsEvent[] {
  const now = opts.now ?? new Date();
  const lookAhead = opts.lookAheadDays ?? 45;
  const maxEvents = opts.maxEvents ?? 8;
  const holidays = resolveHolidays(opts.holidays);

  const t = todayInET(now);
  // Scan current month + next 2 months to safely cover a 45-day window
  // (VIX expirations can sit ~30 days into the next month).
  const seeds: EventSeed[] = [];
  for (let offset = 0; offset <= 2; offset++) {
    const m = ((t.m - 1 + offset) % 12) + 1;
    const y = t.y + Math.floor((t.m - 1 + offset) / 12);
    seeds.push(...eventsForMonth(y, m, holidays));
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
