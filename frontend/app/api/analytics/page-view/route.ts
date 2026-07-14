import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/core/auth';
import {
  normalizeToTemplate,
  recordPageEnter,
  recordPageExit,
  resolveVisitor,
  MAX_VISIT_MS,
} from '@/core/pageAnalytics';

// First-party page-view beacon. The client tracker (components/PageAnalytics.tsx)
// posts a tiny JSON payload on page enter and on exit; we resolve the logged-in
// user from the session cookie (never from the body — that would be spoofable),
// normalize the path to its route template, and append a visit row.
//
// This is intentionally unauthenticated (anonymous visits count too) and CSRF-
// exempt: sendBeacon can't attach CSRF headers, and the endpoint is append-only
// low-value telemetry. Abuse is bounded instead by a same-origin check, tight
// input validation, a duration clamp, and idempotency on the client visit id.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VISIT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_BODY_BYTES = 2048;

// Beacons are fire-and-forget: the browser ignores the response body/status,
// so we answer every request with a quiet 204 and simply skip recording when
// something doesn't validate, rather than surfacing errors the client can't act on.
function noContent(): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

// Reject cross-site posts when the browser tells us the origin. Same-origin
// sendBeacon/fetch include an Origin header matching our host; a mismatch is a
// forged submission from another site. A missing Origin is allowed through
// (some same-origin requests omit it) since the other guards still apply.
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) return noContent();

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return noContent();

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return noContent();
    body = JSON.parse(text);
  } catch {
    return noContent();
  }

  if (!body || typeof body !== 'object') return noContent();
  const { phase, visitId, path: rawPath, durationMs } = body as Record<string, unknown>;

  if (phase !== 'enter' && phase !== 'exit') return noContent();
  if (typeof visitId !== 'string' || !VISIT_ID_RE.test(visitId)) return noContent();

  const path = normalizeToTemplate(rawPath);
  if (!path) return noContent();

  const { userId, tier } = resolveVisitor(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  try {
    if (phase === 'enter') {
      recordPageEnter({ visitId, path, userId, tier });
    } else {
      const ms =
        typeof durationMs === 'number' && Number.isFinite(durationMs)
          ? Math.max(0, Math.min(durationMs, MAX_VISIT_MS))
          : 0;
      recordPageExit({ visitId, path, userId, tier, durationMs: ms });
    }
  } catch {
    // Analytics must never turn into a visible client error.
  }

  return noContent();
}
