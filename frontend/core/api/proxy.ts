import { NextRequest, NextResponse } from 'next/server';

import { requireSession } from '@/core/serverAuth';
import { mintEndUserToken } from './endUserToken';

/**
 * Server-side BFF proxy for /api/* routes that reach the FastAPI
 * backend. The browser only ever hits same-origin /api/* URLs; the
 * per-resource route handlers under app/api/ re-export `proxyToApi`
 * as GET/POST/etc. so every backend call funnels through this one
 * place, with an `Authorization: Bearer …` header sourced from
 * server-only env.
 *
 * Auth model: the BFF does NOT gate by tier. Upstream FastAPI is
 * authenticated by the server-only API key carried below — any caller
 * hitting the upstream directly needs their own key. Routes/pages are
 * still tier-gated at the middleware layer (proxy.ts → core/auth.ts),
 * so a Pro-only page like /signal-score still redirects an anonymous
 * visitor to /login; what changes here is that same-origin /api/*
 * responses are open via the BFF, which is the intentional model.
 *
 * Two env vars drive it:
 *   ZEROGEX_API_TOKEN     — required. The per-user key minted for
 *                           `website-prod` (or `zerogex-web-bff`) from
 *                           the backend's api_keys table. MUST NOT be
 *                           prefixed NEXT_PUBLIC_ — that would inline
 *                           it into the browser bundle. Legacy name
 *                           ZEROGEX_API_KEY is still accepted as a
 *                           one-release transition fallback.
 *   ZEROGEX_API_BASE_URL  — optional. Defaults to http://127.0.0.1:8000
 *                           because FastAPI is colocated. Override for
 *                           unusual local-dev topologies.
 */

const UPSTREAM_BASE = (process.env.ZEROGEX_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

// Hop-by-hop (RFC 7230 §6.1) plus headers Next/Node manage for us or
// that would leak browser cookies upstream.
const REQUEST_HEADER_BLOCKLIST = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'cookie',
  'content-length',
  // Never forward a client-supplied end-user token: the only X-End-User-
  // Token that reaches the API is the one minted server-side below.
  'x-end-user-token',
]);

const RESPONSE_HEADER_BLOCKLIST = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
]);

function buildUpstreamHeaders(
  request: NextRequest,
  apiToken: string,
  endUserToken: string | null,
): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (REQUEST_HEADER_BLOCKLIST.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  headers.set('Authorization', `Bearer ${apiToken}`);
  // Additive second factor: identifies the logged-in human on whose
  // behalf this shared-key call is made. Omitted for anonymous calls;
  // the API treats a missing/invalid token as "no end-user".
  if (endUserToken) headers.set('X-End-User-Token', endUserToken);
  return headers;
}

/**
 * Resolve the current end-user and mint their attribution token. Fully
 * fail-safe: any error (no session, DB hiccup, signing failure) yields
 * `null` so the proxied request still goes out with the Bearer key — a
 * broken token must never break a working API call.
 *
 * Accepts a pre-resolved session to avoid a duplicate DB lookup when the
 * caller already resolved the session up-front.
 */
async function resolveEndUserToken(
  preResolved?: Awaited<ReturnType<typeof requireSession>>,
): Promise<string | null> {
  try {
    const session = preResolved !== undefined ? preResolved : await requireSession();
    if (!session?.user?.id) return null;
    return await mintEndUserToken(session.user.id);
  } catch (err) {
    console.error('[end-user-token] minting failed; proceeding caller-only', err);
    return null;
  }
}

function buildResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (RESPONSE_HEADER_BLOCKLIST.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  return headers;
}

export async function proxyToApi(request: NextRequest): Promise<NextResponse> {
  // Prefer ZEROGEX_API_TOKEN; fall back to legacy ZEROGEX_API_KEY for the
  // duration of the env rename. Remove the fallback once production has
  // been switched over.
  const apiToken = process.env.ZEROGEX_API_TOKEN || process.env.ZEROGEX_API_KEY;
  if (!apiToken) {
    return NextResponse.json(
      { error: 'ZEROGEX_API_TOKEN is not configured on the server' },
      { status: 500 },
    );
  }

  const pathname = request.nextUrl.pathname;

  // Resolve the session opportunistically — used only for end-user-token
  // attribution upstream, never for gating. Anonymous callers are fine;
  // they just don't carry an X-End-User-Token.
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === '1';
  let session: Awaited<ReturnType<typeof requireSession>> = null;
  if (authEnabled) {
    try {
      session = await requireSession();
    } catch (err) {
      console.warn('[bff-proxy] session resolution failed; proceeding anonymous', err);
      session = null;
    }
  }

  const targetUrl = `${UPSTREAM_BASE}${pathname}${request.nextUrl.search}`;

  const endUserToken = await resolveEndUserToken(session);

  const init: RequestInit = {
    method: request.method,
    headers: buildUpstreamHeaders(request, apiToken, endUserToken),
    redirect: 'manual',
    cache: 'no-store',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch {
    return NextResponse.json({ error: 'Upstream API unreachable' }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: buildResponseHeaders(upstream),
  });
}
