/**
 * Has a session ended, and how to name a reading from one that has.
 *
 * After the 16:00 ET close the live surfaces keep showing the session's last
 * reading, which is right: nothing newer exists. What was wrong is that they
 * kept saying "live" and kept an age ticking in the present tense, so at 16:13
 * a reader could not tell a frozen final read from a fresh one. These helpers
 * let a surface say "closed" instead.
 *
 * Pure: every instant is passed in. ET through Intl, so daylight saving and
 * weekends need no special cases.
 */

const ET_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

const CLOSE_MINUTES = 16 * 60;

function etParts(ms: number): { key: string; minutes: number; weekday: string; hhmm: string } {
  const parts = ET_PARTS.formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return {
    key: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(hour) * 60 + Number(get('minute')),
    weekday: get('weekday'),
    hhmm: `${hour}:${get('minute')}`,
  };
}

/**
 * True once the session dated `sessionKey` (ET `YYYY-MM-DD`) has reached its
 * 16:00 ET close, or when it is an earlier day than `nowMs` altogether (the
 * evening, overnight, a weekend or a holiday). False for an unknown session.
 */
export function sessionHasClosed(sessionKey: string | null | undefined, nowMs: number): boolean {
  if (!sessionKey) return false;
  const now = etParts(nowMs);
  if (sessionKey < now.key) return true;
  if (sessionKey > now.key) return false;
  return now.minutes >= CLOSE_MINUTES;
}

/**
 * A reading's time for a status line: "15:59 ET" on the same ET day as
 * `nowMs`, "Fri 15:59 ET" on an earlier one, so Monday morning does not
 * present Friday's last reading as today's.
 */
export function readingLabel(readingMs: number | null, nowMs: number): string {
  if (readingMs == null || !Number.isFinite(readingMs)) return '--:-- ET';
  const r = etParts(readingMs);
  const sameDay = r.key === etParts(nowMs).key;
  return `${sameDay ? '' : `${r.weekday} `}${r.hhmm} ET`;
}
