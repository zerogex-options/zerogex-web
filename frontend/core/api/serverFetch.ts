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

/**
 * Fetch a GET endpoint on the FastAPI backend with the server-only bearer
 * key attached. ``revalidateSeconds`` plugs into the Next.js fetch cache so
 * an ISR page rebuilds at that cadence. Returns ``null`` on any failure
 * (missing token, network error, non-2xx) so the caller can render a clean
 * empty state instead of crashing the page render.
 */
export async function serverApiGet<T>(
  path: string,
  revalidateSeconds: number,
): Promise<T | null> {
  const token = process.env.ZEROGEX_API_TOKEN || process.env.ZEROGEX_API_KEY;
  if (!token) return null;
  try {
    const res = await fetch(`${UPSTREAM_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
