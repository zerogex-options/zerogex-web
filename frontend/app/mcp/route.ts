// ZeroGEX's hosted MCP endpoint — https://zerogex.io/mcp
//
// A public, unauthenticated, read-only Model Context Protocol server over the
// free 15-minute-delayed dealer-positioning levels. Claude, ChatGPT, Cursor or
// any other MCP client can add this URL and read the gamma flip and the walls
// inside a conversation, with no key and no account.
//
// It serves exactly the derived-levels zone the public /spx-gamma-levels pages
// already render — wall and flip LEVELS, max pain, net GEX magnitudes — through
// the same 900s-cached `serverApiGet`, so it shares those pages' cache entries
// and is licensing-clean by the same construction. No raw chain, no
// per-contract quotes, no live price stream. The real-time API stays a Pro
// feature behind a key.
//
// Transport is Streamable HTTP (MCP 2025-11-25), single endpoint, stateless: we
// never issue a session id, and the protocol spec explicitly permits answering
// a JSON-RPC request with one `application/json` object instead of opening an
// SSE stream. That keeps the whole server inside one route handler with no MCP
// SDK dependency. Message handling lives in core/mcp/protocol.ts; this file is
// only the HTTP skin.

import { serverApiGet } from '@/core/api/serverFetch';
import { getMarketSession } from '@/core/utils';
import type { PickerSymbol } from '@/core/symbols';
import {
  PROTOCOL_VERSION,
  RPC,
  handleRpcMessage,
  isSupportedProtocolVersion,
  rpcError,
} from '@/core/mcp/protocol';
import { DELAY_SECONDS, type GexSnapshot, type MarketPhase } from '@/core/mcp/levels';
import { createToolRegistry } from '@/core/mcp/tools';

// Reads request headers and a request body, so it can never be statically
// rendered. Upstream data is still cached: `serverApiGet` sets the 900s fetch
// revalidate, which is what bounds backend load no matter how many clients
// connect here.
export const dynamic = 'force-dynamic';

/** Refuse a body larger than this outright. Every legal MCP message is tiny. */
const MAX_BODY_BYTES = 256 * 1024;

/**
 * Origin allowlist, from `ZEROGEX_MCP_ALLOWED_ORIGINS` (comma-separated).
 *
 * The transport spec requires servers to validate `Origin` because a page in a
 * victim's browser can otherwise reach an MCP server that holds privileged
 * access. This one holds none: no auth, no cookies, no session, no writes, and
 * every byte it returns is already public on zerogex.io. So the default is to
 * accept any origin, which is the honest answer for a public read-only server
 * rather than security theatre. The env var exists so the check can be
 * tightened without a code change if this endpoint ever gains a private tier.
 */
const ALLOWED_ORIGINS = (process.env.ZEROGEX_MCP_ALLOWED_ORIGINS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // Non-browser clients send no Origin at all.
  if (ALLOWED_ORIGINS.length === 0) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.length > 0 ? origin : '*',
    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Accept, Authorization, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
    'Access-Control-Expose-Headers': 'MCP-Protocol-Version',
    'Access-Control-Max-Age': '86400',
    // The allowed origin varies with the request when an allowlist is set, so
    // a shared cache must not reuse one origin's response for another.
    Vary: 'Origin',
  };
}

function baseHeaders(origin: string | null): Record<string, string> {
  return {
    ...corsHeaders(origin),
    'MCP-Protocol-Version': PROTOCOL_VERSION,
    // A JSON-RPC reply is specific to one request; nothing between here and the
    // client should hold on to it.
    'Cache-Control': 'no-store',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...baseHeaders(origin), 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Data access — the free delayed snapshot, shared with the public pages
// ---------------------------------------------------------------------------

async function fetchSnapshot(symbol: PickerSymbol): Promise<GexSnapshot | null> {
  // Byte-identical to the URL the free gamma-levels pages request, so the Next
  // fetch cache dedupes across both surfaces rather than doubling backend load.
  return serverApiGet<GexSnapshot>(
    `/api/gex/summary?symbol=${symbol}&underlying=${symbol}`,
    DELAY_SECONDS,
  );
}

/**
 * Regular US equity hours or not.
 *
 * Holidays are not modeled here, and deliberately are not: on a market holiday
 * this reports "open" and the snapshot then ages past the refresh thresholds,
 * so the result degrades into a stale-data warning rather than a wrong claim
 * that the data is current. That is the safe direction to fail.
 */
function marketPhase(): MarketPhase {
  return getMarketSession() === 'open' ? 'open' : 'closed';
}

const registry = createToolRegistry({
  fetchSnapshot,
  marketPhase,
  now: () => new Date(),
});

// ---------------------------------------------------------------------------
// HTTP methods
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');

  if (!isAllowedOrigin(origin)) {
    return json(
      rpcError(null, RPC.INVALID_REQUEST, 'Origin not allowed.'),
      403,
      null,
    );
  }

  // Only validate the version when the client states one. `initialize` legally
  // arrives without the header, because the version is what it is negotiating.
  const requestedVersion = request.headers.get('mcp-protocol-version');
  if (requestedVersion && !isSupportedProtocolVersion(requestedVersion)) {
    return json(
      rpcError(
        null,
        RPC.INVALID_REQUEST,
        `Unsupported MCP-Protocol-Version: ${requestedVersion}. This server speaks ${PROTOCOL_VERSION}.`,
      ),
      400,
      origin,
    );
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json(rpcError(null, RPC.INVALID_REQUEST, 'Request body too large.'), 413, origin);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json(rpcError(null, RPC.PARSE_ERROR, 'Could not read request body.'), 400, origin);
  }
  if (raw.length > MAX_BODY_BYTES) {
    return json(rpcError(null, RPC.INVALID_REQUEST, 'Request body too large.'), 413, origin);
  }

  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return json(rpcError(null, RPC.PARSE_ERROR, 'Request body is not valid JSON.'), 400, origin);
  }

  // JSON-RPC batching was removed from MCP in 2025-06-18: a POST body must be a
  // single request, notification or response. Say that plainly rather than
  // silently answering only the first element.
  if (Array.isArray(message)) {
    return json(
      rpcError(
        null,
        RPC.INVALID_REQUEST,
        'Batched requests are not supported. Send one JSON-RPC message per POST.',
      ),
      400,
      origin,
    );
  }

  let response;
  try {
    response = await handleRpcMessage(message, registry);
  } catch (err) {
    // handleRpcMessage is written not to throw; this is the belt-and-braces
    // path so a bug in it returns valid JSON-RPC instead of an HTML 500 that no
    // MCP client can parse.
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[mcp] unhandled dispatch failure: ${detail}`);
    return json(rpcError(null, RPC.INTERNAL_ERROR, 'Internal server error.'), 500, origin);
  }

  // A notification (or a response to a request we never sent) has nothing to
  // reply with. The spec's answer is 202 with no body.
  if (response === null) {
    return new Response(null, { status: 202, headers: baseHeaders(origin) });
  }

  return json(response, 200, origin);
}

/**
 * No server-initiated stream.
 *
 * The spec's alternative to returning `text/event-stream` here is exactly this
 * 405, and it is the correct answer for a stateless server that never pushes:
 * every reply this server has is already delivered on the POST that asked for
 * it. Clients treat the 405 as "no stream available" and carry on.
 */
export async function GET(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  return json(
    rpcError(
      null,
      RPC.METHOD_NOT_FOUND,
      'This server does not offer an SSE stream. POST JSON-RPC messages to this endpoint instead.',
    ),
    405,
    origin,
  );
}

/**
 * No sessions to terminate. We never issue an `MCP-Session-Id`, so there is no
 * server-side state a client could end — which the spec lets us say with a 405.
 */
export async function DELETE(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  return json(
    rpcError(null, RPC.METHOD_NOT_FOUND, 'This server is stateless and issues no session id.'),
    405,
    origin,
  );
}

export async function OPTIONS(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
