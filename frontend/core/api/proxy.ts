import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side BFF proxy for /api/* routes that reach the FastAPI
 * backend. The browser only ever hits same-origin /api/* URLs; the
 * per-resource route handlers under app/api/ re-export `proxyToApi`
 * as GET/POST/etc. so every backend call funnels through this one
 * place, with X-API-Key sourced from server-only env.
 *
 * Two env vars drive it:
 *   ZEROGEX_API_KEY       — required. The key minted for `website-prod`
 *                           from the backend's api_keys table. MUST NOT
 *                           be prefixed NEXT_PUBLIC_ — that would inline
 *                           it into the browser bundle.
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
]);

const RESPONSE_HEADER_BLOCKLIST = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
]);

function buildUpstreamHeaders(request: NextRequest, apiKey: string): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (REQUEST_HEADER_BLOCKLIST.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  headers.set('X-API-Key', apiKey);
  return headers;
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
  const apiKey = process.env.ZEROGEX_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ZEROGEX_API_KEY is not configured on the server' },
      { status: 500 },
    );
  }

  const targetUrl = `${UPSTREAM_BASE}${request.nextUrl.pathname}${request.nextUrl.search}`;

  const init: RequestInit = {
    method: request.method,
    headers: buildUpstreamHeaders(request, apiKey),
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
