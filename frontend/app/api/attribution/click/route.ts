import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/core/db';
import { getClientIp } from '@/core/serverAuth';
import { SESSION_COOKIE_NAME } from '@/core/auth';
import { resolveUserIdFromCookie } from '@/core/monitoring';
import {
  hashClientIp,
  isBrokerSlug,
  isCtaSurface,
  mintAttributionId,
  readAttributionId,
  setAttributionCookie,
} from '@/core/attribution';

export const dynamic = 'force-dynamic';

// Fire-and-forget click logger for the BrokerCTA component + /brokers
// page. Anonymous by design: no CSRF gate (there's no privilege to
// forge — a bogus row is a self-inflicted noise problem for whoever
// forged it, not an attack on us), no auth requirement, and the response
// is a plain `{ ok: true }` regardless of downstream success so the
// client never retries. The redirect to the affiliate URL happens
// client-side in parallel with the POST; blocking it would cost
// conversions.
//
// This route deliberately mirrors the shape of api/account/referrals
// (no zod dep, plain typeof-guards) rather than adopting a validation
// library just for this endpoint.

const MAX_STRING_LEN = 512;

// Rate limit: 20 clicks per attribution_id per hour. Anything past that
// is silently dropped — the client still gets 200 so it doesn't retry.
// Cheap SQL COUNT since attribution_id is indexed.
const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_CLICKS = 20;

function truncate(value: string | null | undefined, max = MAX_STRING_LEN): string | null {
  if (value == null) return null;
  const trimmed = String(value).slice(0, max);
  return trimmed.length ? trimmed : null;
}

function safeUrlParams(rawPath: string, referer: string | null): URLSearchParams | null {
  // Try `path` first (client supplies window.location.pathname + search).
  // Falls back to the Referer header if the caller didn't include a
  // query string — belt-and-braces for surfaces that route through a
  // Link component and strip the search string.
  const tryParse = (value: string): URLSearchParams | null => {
    const questionIdx = value.indexOf('?');
    if (questionIdx === -1) return null;
    try {
      return new URLSearchParams(value.slice(questionIdx));
    } catch {
      return null;
    }
  };
  const fromPath = tryParse(rawPath);
  if (fromPath && Array.from(fromPath.keys()).length > 0) return fromPath;
  if (!referer) return null;
  try {
    return new URL(referer).searchParams;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: { surface?: unknown; broker_partner?: unknown; path?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!isCtaSurface(body.surface)) {
    return NextResponse.json({ error: 'invalid_surface' }, { status: 400 });
  }
  if (!isBrokerSlug(body.broker_partner)) {
    return NextResponse.json({ error: 'invalid_broker_partner' }, { status: 400 });
  }
  const path = truncate(typeof body.path === 'string' ? body.path : null);
  if (!path) {
    return NextResponse.json({ error: 'invalid_path' }, { status: 400 });
  }

  const surface = body.surface;
  const brokerPartner = body.broker_partner;

  // Attribution id: read the zgx_attr cookie; mint on the fly if the
  // client hits us before the middleware got a chance to set it (e.g.
  // during a static-cache warm-up). Persist the id to the response
  // whichever branch we take so the follow-up conversion can join.
  let attributionId = readAttributionId(request);
  let mintedNow = false;
  if (!attributionId) {
    attributionId = mintAttributionId();
    mintedNow = true;
  }

  const utmParams = safeUrlParams(path, request.headers.get('referer'));

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  const userId = sessionToken ? resolveUserIdFromCookie(sessionToken) : null;

  const ipHash = hashClientIp(getClientIp(request));
  const userAgent = truncate(request.headers.get('user-agent'), 512);

  const response = NextResponse.json({ ok: true });
  response.headers.set('Cache-Control', 'no-store, private');
  if (mintedNow) setAttributionCookie(response, attributionId);

  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
    const recent = db
      .prepare(
        `SELECT COUNT(*) AS n FROM broker_attribution_clicks
         WHERE attribution_id = ? AND clicked_at >= ?`,
      )
      .get(attributionId, cutoff) as { n: number | null };
    if ((recent.n ?? 0) >= RATE_LIMIT_MAX_CLICKS) {
      // Silently drop — still 200 so the client doesn't retry.
      return response;
    }

    db.prepare(
      `INSERT INTO broker_attribution_clicks
       (clicked_at, surface, broker_partner, path, attribution_id, user_id,
        session_id, utm_source, utm_medium, utm_campaign, ip_hash, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      new Date().toISOString(),
      surface,
      brokerPartner,
      path,
      attributionId,
      userId,
      // session_id: the session cookie value itself is a raw token we
      // don't want to persist. Keep the column for future use but write
      // null today — resolveUserIdFromCookie() above already gives us
      // the join key that matters for logged-in users.
      null,
      truncate(utmParams?.get('utm_source') ?? null),
      truncate(utmParams?.get('utm_medium') ?? null),
      truncate(utmParams?.get('utm_campaign') ?? null),
      ipHash,
      userAgent,
    );
  } catch (err) {
    // Never surface a DB hiccup to the client — the redirect is
    // already firing in parallel. Log so a real outage shows up in the
    // server logs.
    console.error('[attribution] click insert failed:', err);
  }

  return response;
}
