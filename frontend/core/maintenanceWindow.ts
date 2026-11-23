// The weekly scheduled maintenance, as the website explains it to a member.
//
// zerogex-oa's `zerogex-oa-db-vacuum-full` timer starts every Sunday at 02:30
// ET (systemd adds up to 5 minutes of random delay) and runs
// `make db-maintain-managed`: it stops the API and the three engines, runs
// VACUUM FULL + REINDEX, and starts them again. The unit's budget is 4 hours
// (TimeoutStartSec=14400); after that, ExecStopPost starts the services
// regardless. Observed 2026-11-22: 02:31:54 to 04:25:40 ET.
//
// While it runs, the website is up and the API is not, so every data request
// from the browser failed with a bare "HTTP 502", and a Pro member wrote in on
// 2026-11-22 asking whether the Backtesting page was broken. The Cloudflare
// maintenance page (deploy/cloudflare/maintenance-page) doesn't cover this:
// it only replaces whole-page loads when the box itself is down, and leaves
// /api/* alone.
//
// core/api/proxy.ts consults this only after the API has actually failed to
// answer, so a run that finishes early shows nothing, and an outage at any
// other time keeps its own message.
//
// The schedule lives in zerogex-oa (setup/systemd/zerogex-oa-db-vacuum-full.timer
// and .service). Change both together.
//
// Pure: the clock is an argument, so tests can pin any instant.

const ET_ZONE = 'America/New_York';

/** Minutes after ET midnight, Sunday: the timer's OnCalendar time. */
export const MAINTENANCE_START_MINUTE = 2 * 60 + 30; // 02:30 ET
/** When a run is normally over. The first measured run ended at 04:25 ET. */
export const MAINTENANCE_TYPICAL_END_MINUTE = 4 * 60 + 30; // 04:30 ET
/**
 * The latest a run can hold the API: the latest start (02:35) plus the 4-hour
 * budget, plus a few minutes for the services to come back. Past this, an API
 * that still doesn't answer is not maintenance, and is reported as an outage.
 */
export const MAINTENANCE_LATEST_END_MINUTE = 6 * 60 + 45; // 06:45 ET

export type MaintenanceNotice = {
  /** One or two sentences for a member, shown where the data would be. */
  message: string;
  /** For the Retry-After header: until the end the message names. */
  retryAfterSeconds: number;
};

const NOTHING_TO_DO = 'Nothing to do on your end.';

const etParts = new Intl.DateTimeFormat('en-US', {
  timeZone: ET_ZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** ET weekday ('Sun', 'Mon', ...) and minutes after ET midnight. */
function etWeekdayAndMinute(nowMs: number): { weekday: string; minute: number } {
  let weekday = '';
  let hour = 0;
  let minute = 0;
  for (const part of etParts.formatToParts(new Date(nowMs))) {
    if (part.type === 'weekday') weekday = part.value;
    else if (part.type === 'hour') hour = Number(part.value);
    else if (part.type === 'minute') minute = Number(part.value);
  }
  return { weekday, minute: hour * 60 + minute };
}

/**
 * The notice to show when the API didn't answer at `nowMs`, or null when that
 * instant is outside the weekly maintenance window.
 */
export function scheduledMaintenanceNotice(nowMs: number): MaintenanceNotice | null {
  const { weekday, minute } = etWeekdayAndMinute(nowMs);
  if (weekday !== 'Sun') return null;
  if (minute < MAINTENANCE_START_MINUTE || minute >= MAINTENANCE_LATEST_END_MINUTE) return null;

  if (minute < MAINTENANCE_TYPICAL_END_MINUTE) {
    return {
      message:
        'Scheduled maintenance: data is offline for our weekly upkeep (Sundays from 2:30 AM ET) ' +
        `and is usually back by 4:30 AM ET. ${NOTHING_TO_DO}`,
      retryAfterSeconds: Math.max(60, (MAINTENANCE_TYPICAL_END_MINUTE - minute) * 60),
    };
  }
  return {
    message:
      'Our weekly scheduled maintenance is running longer than usual. ' +
      `Data will be back by 6:45 AM ET at the latest. ${NOTHING_TO_DO}`,
    retryAfterSeconds: Math.max(60, (MAINTENANCE_LATEST_END_MINUTE - minute) * 60),
  };
}

/** What a member sees when the API doesn't answer outside the window. */
export const DATA_SERVICE_UNREACHABLE_MESSAGE =
  "The data service isn't answering right now. This is on our side; please try again in a minute.";

export type UnreachableReply = {
  status: number;
  body: { error: string; message: string; detail: string; maintenance: boolean };
  headers: Record<string, string>;
};

/**
 * What the browser proxy answers when its fetch to the API throws.
 *
 * The sentence goes out under all three keys the browser reads: `message` is
 * what core/api/clients.ts shows, `detail` is what hooks/useApiData.ts shows,
 * and `error` is what this reply always carried. So every page built on either
 * helper shows the sentence in place of "HTTP 502" with no change of its own.
 *
 * Inside the window it's a 503 with Retry-After, the status for a planned,
 * temporary outage. Outside it stays a 502, since nobody planned that one.
 * Neither may be cached: the next poll should reach the API the moment it's
 * back.
 */
export function unreachableUpstreamReply(nowMs: number): UnreachableReply {
  const notice = scheduledMaintenanceNotice(nowMs);
  if (notice) {
    return {
      status: 503,
      body: { error: notice.message, message: notice.message, detail: notice.message, maintenance: true },
      headers: { 'Retry-After': String(notice.retryAfterSeconds), 'Cache-Control': 'no-store' },
    };
  }
  return {
    status: 502,
    body: {
      error: DATA_SERVICE_UNREACHABLE_MESSAGE,
      message: DATA_SERVICE_UNREACHABLE_MESSAGE,
      detail: DATA_SERVICE_UNREACHABLE_MESSAGE,
      maintenance: false,
    },
    headers: { 'Cache-Control': 'no-store' },
  };
}
