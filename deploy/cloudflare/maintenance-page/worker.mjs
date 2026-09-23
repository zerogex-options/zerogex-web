/**
 * Cloudflare Worker: show maintenance.html while the zerogex.io origin is down.
 *
 * The whole origin — nginx, the Next.js app under PM2, the FastAPI backend —
 * runs on one EC2 box, so while that box reboots (the weekly Sunday restart,
 * or any other time) there is nothing left on it to serve a friendly page.
 * Visitors instead get Cloudflare's generic "521 Web server is down" or "522
 * Connection timed out" screen. Cloudflare's edge is the one thing still
 * answering for zerogex.io, so this runs there, in front of the site.
 *
 * It is purely reactive: every request goes to the origin exactly as before,
 * and only a page load whose answer means "the origin isn't answering" is
 * replaced. There is no schedule to keep in step with the reboot; it covers
 * the outage whenever it starts and however long it runs, and steps aside the
 * moment the origin answers again.
 *
 * Only page loads are ever replaced. API polls, RSC fetches, static assets,
 * webhooks and the WebSocket pass through untouched, so nothing that expects
 * JSON is handed HTML, and the app's own handling of a failed fetch in an
 * already-open tab is unchanged. If the origin is down when such a tab
 * navigates, the Next.js router falls back to a full page load, which lands
 * here.
 *
 * Deploy and route setup: README.md in this directory.
 */
import MAINTENANCE_HTML from './maintenance.html';

// Statuses that mean no response came from the site itself:
//   502, 504      nginx is up but the Next.js app behind it isn't (still
//                 starting after the reboot, or mid-restart), or it hung.
//   520-526, 530  Cloudflare got nothing usable from the box at all: refused
//                 (521), timed out (522), unreachable (523), TLS failed, ...
// 500 and 503 are left alone on purpose. Those are the app answering, and its
// own error page says more than "down for maintenance" would.
const ORIGIN_DOWN = new Set([502, 504, 520, 521, 522, 523, 524, 525, 526, 530]);

export default {
  async fetch(request, env, ctx) {
    // Should anything here throw, Cloudflare sends the request on to the
    // origin as though this Worker weren't deployed, so a bug in it (or an
    // origin fetch that throws instead of answering 52x) can never turn out
    // worse than the site without it.
    ctx.passThroughOnException();

    if (!isPageLoad(request)) return fetch(request);

    let response;
    try {
      response = await fetch(request);
    } catch {
      return maintenancePage(request, 'unreachable');
    }
    return ORIGIN_DOWN.has(response.status) ? maintenancePage(request, response.status) : response;
  },
};

// A browser or crawler asking for a document, as opposed to data or an asset.
function isPageLoad(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  return (request.headers.get('Accept') || '').includes('text/html');
}

function maintenancePage(request, originStatus) {
  return new Response(request.method === 'HEAD' ? null : MAINTENANCE_HTML, {
    // 503 with Retry-After is what tells a crawler the outage is temporary, so
    // a crawl that lands during the reboot doesn't count against the page.
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '300',
      // What the origin actually said, since this page hides it: a 526 (bad
      // origin certificate) needs a different fix than a 521 (box down).
      'X-Origin-Status': String(originStatus),
    },
  });
}
