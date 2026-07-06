/**
 * POST /api/ws/ticket
 *
 * Mints a short-lived HS256 JWT the browser passes to the FastAPI /ws
 * handshake as ?ticket=<jwt>. This is the ONLY authenticated indirection
 * — once the WS handshake succeeds, the connection carries no headers
 * and every subsequent frame is trusted for the duration of the socket.
 *
 * Flow:
 *   requireSession()  → the logged-in user
 *   mintWsTicket()    → { ticket, expiresAt }
 *   { url }           → wss://.../ws?ticket=<jwt>  (built server-side so
 *                        the browser doesn't have to know NEXT_PUBLIC_WS_URL)
 *
 * Failure modes are ALL non-500: the frontend treats any non-200 as
 * "no live stream available; keep polling," and we never want a WS
 * misconfiguration to break the page.
 *
 *   401  — no session (frontend polls anonymously anyway)
 *   503  — ticket minting disabled (secret unset) OR WS feature flag off
 */

import { NextResponse } from 'next/server';
import { requireSession } from '@/core/serverAuth';
import { mintWsTicket } from '@/core/api/wsTicket';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isEnabled(): boolean {
  const flag = (process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET ?? '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

function wsUrl(ticket: string): string | null {
  // NEXT_PUBLIC_WS_URL is the base URL of the FastAPI /ws endpoint
  // (e.g. wss://api.zerogex.io/ws). We build the query string here so
  // the browser bundle never has to know the host — only that
  // /api/ws/ticket returns a ready-to-open URL.
  const base = (process.env.NEXT_PUBLIC_WS_URL ?? '').trim();
  if (!base) return null;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}ticket=${encodeURIComponent(ticket)}`;
}

export async function POST(): Promise<NextResponse> {
  if (!isEnabled()) {
    return NextResponse.json(
      { error: 'websocket_disabled', detail: 'WebSocket streaming is disabled' },
      { status: 503 },
    );
  }

  let session: Awaited<ReturnType<typeof requireSession>>;
  try {
    session = await requireSession();
  } catch {
    session = null;
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const minted = await mintWsTicket(session.user.id);
  if (!minted) {
    return NextResponse.json(
      { error: 'ticket_unavailable', detail: 'Ticket signing secret not configured' },
      { status: 503 },
    );
  }

  const url = wsUrl(minted.ticket);
  if (!url) {
    return NextResponse.json(
      { error: 'ws_url_unset', detail: 'NEXT_PUBLIC_WS_URL not configured' },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      ticket: minted.ticket,
      expiresAt: minted.expiresAt,
      url,
    },
    {
      status: 200,
      headers: {
        // Never cache the ticket — each one is single-use / short-lived.
        'Cache-Control': 'no-store',
      },
    },
  );
}
