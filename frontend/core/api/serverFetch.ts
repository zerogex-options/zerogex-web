import 'server-only';

// Server-only fetch for routes that are server-rendered (no incoming session
// cookie to attach an end-user token to) and want to talk to the FastAPI
// backend directly rather than round-tripping through the same-origin BFF
// proxy. Used by ISR pages like the free `/spx-gamma-levels` lead-magnet,
// where the response is intentionally cached for ~15 minutes and shared
// across all anonymous visitors — there is no per-user attribution to do.
//
// Honors the same env vars as `core/api/proxy.ts`:
//   * ZEROGEX_API_BASE_URL — defaults to http://127.0.0.1:8000.
//   * ZEROGEX_API_TOKEN — preferred. Falls back to legacy ZEROGEX_API_KEY.

const UPSTREAM_BASE = (
  process.env.ZEROGEX_API_BASE_URL || 'http://127.0.0.1:8000'
).replace(/\/+$/, '');

// One structured line per failure, routed to the Next.js server log (PM2
// journal) — never the browser. The free ISR pages render a deliberately clean
// empty state ("Data is briefly unavailable") on any failure, which is right
// for visitors but opaque to operators: a blank SPX/SPY/QQQ card looks
// identical whether the token env var is unset, the backend is unreachable, the
// key 401s, scope enforcement 403s, or the DB genuinely has no rows yet. Making
// the actual reason greppable turns "why are the free gamma levels blank?" into
// a one-command answer (`pm2 logs | grep serverApiGet`). The bearer token is
// never included.
function logServerApiFailure(path: string, reason: string): void {
  console.warn(`[serverApiGet] ${path} → null (${reason})`);
}

/**
 * Fetch a GET endpoint on the FastAPI backend with the server-only bearer
 * key attached. ``revalidateSeconds`` plugs into the Next.js fetch cache so
 * an ISR page rebuilds at that cadence. Returns ``null`` on any failure
 * (missing token, network error, non-2xx) so the caller can render a clean
 * empty state instead of crashing the page render.
 *
 * Every ``null`` is logged with its discriminating reason (see
 * ``logServerApiFailure``) so the otherwise-invisible empty state can be
 * traced to a missing env var vs. an unreachable backend vs. a specific HTTP
 * status from the API.
 */
export async function serverApiGet<T>(
  path: string,
  revalidateSeconds: number,
): Promise<T | null> {
  const token = process.env.ZEROGEX_API_TOKEN || process.env.ZEROGEX_API_KEY;
  if (!token) {
    logServerApiFailure(path, 'ZEROGEX_API_TOKEN/ZEROGEX_API_KEY not set on the server');
    return null;
  }
  try {
    const res = await fetch(`${UPSTREAM_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) {
      // Non-2xx: the FastAPI error body carries the detail that pins the cause
      // — "No GEX data available" (404, empty tables), "Invalid or missing API
      // key" (401, rotated/unmigrated token), "Authentication backend
      // temporarily unavailable" (503, DB/pool down), or a scope message (403,
      // API_SCOPE_ENFORCEMENT on without the key scoped). Capture a short,
      // whitespace-collapsed snippet so the reason is unambiguous in the log.
      let detail = '';
      try {
        detail = (await res.text()).slice(0, 200).replace(/\s+/g, ' ').trim();
      } catch {
        // Body already consumed / unreadable — the status line alone still helps.
      }
      logServerApiFailure(
        path,
        `HTTP ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`,
      );
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    // Network-level failure reaching UPSTREAM_BASE (backend down, connection
    // refused, DNS, TLS) — the request never got a reply, distinct from a
    // non-2xx above. Log the message, not the whole error object, to keep the
    // line scannable.
    const message = err instanceof Error ? err.message : String(err);
    logServerApiFailure(path, `fetch failed reaching ${UPSTREAM_BASE} — ${message}`);
    return null;
  }
}
