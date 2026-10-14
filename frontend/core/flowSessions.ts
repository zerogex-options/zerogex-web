/**
 * Which trading session the flow surfaces (Flow Analysis, Smart Money, the
 * Options Flow chart) read.
 *
 * `current` and `prior` are the API's own session names. A `YYYY-MM-DD` date
 * names any other day the API still holds, and is sent as `date=` — which the
 * flow endpoints take in place of `session`. `/api/flow/sessions` lists the
 * days that have data, newest first; its first entry is the day `current`
 * resolves to.
 */
export type FlowSessionDate = `${number}-${number}-${number}`;
export type FlowSession = 'current' | 'prior' | FlowSessionDate;

/** How many recent sessions the pickers offer. */
export const FLOW_SESSION_PICKER_DAYS = 7;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isFlowSessionDate(session: string): session is FlowSessionDate {
  return DATE_RE.test(session);
}

/** The query params that select `session`: `{ session }` or `{ date }`. */
export function flowSessionParams(session: FlowSession): Record<string, string> {
  return isFlowSessionDate(session) ? { date: session } : { session };
}

/** `flowSessionParams` as a query-string fragment, e.g. `date=2026-10-12`. */
export function flowSessionQuery(session: FlowSession): string {
  return new URLSearchParams(flowSessionParams(session)).toString();
}

/**
 * True for a dated session that is over: a day before `todayKey` (the ET
 * date). Its rows can no longer change, so there is nothing to poll for.
 */
export function isClosedFlowSession(session: FlowSession, todayKey: string): boolean {
  return isFlowSessionDate(session) && session < todayKey;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayOf(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  // Noon UTC: the calendar day is the same in every US time zone.
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()] ?? '';
}

export interface FlowSessionOption {
  value: FlowSession;
  label: string;
}

/**
 * Options for a Session picker.
 *
 * `days` is `/api/flow/sessions`, newest first. Its first day is offered as
 * `current` so the live session keeps its live polling; every older day is
 * offered by date. Without the list (still loading, or an API that predates
 * it) the picker falls back to Current / Prior.
 *
 * `selected` is always among the options, so a pick survives a list that no
 * longer carries it (a new session rolled the oldest day off, or the symbol
 * changed) instead of the select silently showing a different day.
 */
export function flowSessionOptions(
  days: readonly string[] | null | undefined,
  selected: FlowSession,
  currentDateLabel?: string | null,
): FlowSessionOption[] {
  const valid = (days ?? []).filter(isFlowSessionDate);
  let options: FlowSessionOption[];
  if (valid.length === 0) {
    const current = currentDateLabel ?? null;
    options = [
      { value: 'current', label: `Current${current ? ` (${current})` : ''}` },
      { value: 'prior', label: 'Prior' },
    ];
  } else {
    const [newest, ...older] = valid;
    options = [
      { value: 'current', label: `Current (${newest})` },
      ...older.map((day) => ({ value: day, label: `${weekdayOf(day)} ${day}` })),
    ];
  }
  if (!options.some((o) => o.value === selected)) {
    options.push({
      value: selected,
      label: isFlowSessionDate(selected) ? `${weekdayOf(selected)} ${selected}` : 'Prior',
    });
  }
  return options;
}

/**
 * The ET date a selection reads: the date itself, or for `current` the
 * newest listed day. Null when that is not known yet (or for `prior`).
 */
export function flowSessionDateKey(
  session: FlowSession,
  days: readonly string[] | null | undefined,
): string | null {
  if (isFlowSessionDate(session)) return session;
  if (session === 'current') {
    const newest = (days ?? []).find(isFlowSessionDate);
    return newest ?? null;
  }
  return null;
}
