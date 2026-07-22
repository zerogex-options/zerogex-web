import { createHash, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

// On-demand ISR revalidation for the Gamma Forecast surfaces.
//
// The /forecast landing page caches its available-dates fetch (5 min) and each
// /forecast/{symbol}/{date} permalink (30 min), so absent an explicit ping the
// public cards lag the DB by up to that window — the landing card keeps reading
// "Pending 4 PM" after the receipt has landed, and a freshly-committed morning
// row stays missing from the date list until its window rolls over. Two crons
// should POST here so every surface updates within seconds instead:
//   * the morning writer, right after committing the day's daily_forecast rows
//     (pass {date, symbols}), so today appears in the landing list immediately
//     — otherwise the constantly-re-cached default SPY list can serve a
//     pre-commit snapshot that omits today for up to a full ISR window;
//   * the 16:05 ET receipt cron, right after grading, so the cards flip to
//     receipt state immediately.
//
// Auth is a shared bearer token (FORECAST_REVALIDATE_TOKEN) — the same
// cross-box secret convention as BULLETIN_SNAPSHOT_TOKEN, with the OA host
// carrying the identical value in its own .env. Best-effort by design: the
// rows are already durably in the DB, so a missing/failed ping only means the
// pages self-heal on their normal ISR cadence instead of instantly.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SYMBOL = /^[A-Z]{1,10}$/;

// Constant-time token compare that tolerates length differences —
// timingSafeEqual throws on unequal-length buffers, so hash both sides to a
// fixed 32 bytes first. This keeps the comparison timing-safe without leaking
// the expected token's length.
function tokensMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

// Accept the token as `Authorization: Bearer <token>` (preferred) or a bare
// `x-revalidate-token` header.
function extractToken(request: NextRequest): string {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1].trim();
  return (request.headers.get('x-revalidate-token') ?? '').trim();
}

export async function POST(request: NextRequest) {
  const expected = process.env.FORECAST_REVALIDATE_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: 'FORECAST_REVALIDATE_TOKEN not configured' },
      { status: 503 },
    );
  }
  const provided = extractToken(request);
  if (!provided || !tokensMatch(provided, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const record = (body ?? {}) as { date?: unknown; symbols?: unknown };

  const date =
    typeof record.date === 'string' && ISO_DATE.test(record.date) ? record.date : null;
  const rawSymbols: unknown[] = Array.isArray(record.symbols) ? record.symbols : [];
  const symbols = Array.from(
    new Set(
      rawSymbols
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.toUpperCase())
        .filter((s) => SYMBOL.test(s)),
    ),
  );

  const revalidated: string[] = [];

  // The landing page's date list needs the just-committed/just-graded day to
  // surface — a new morning row must appear in the list, and today's card must
  // flip out of "Pending 4 PM" — regardless of which symbols were in the payload.
  revalidatePath('/forecast');
  revalidated.push('/forecast');

  // Each graded symbol's permalink (and its OG image) for the specific date.
  if (date) {
    for (const symbol of symbols) {
      const page = `/forecast/${symbol}/${date}`;
      revalidatePath(page);
      // OG image is a sibling route segment with its own cache — flip it too so
      // social unfurls show the receipt, not the stale morning card.
      revalidatePath(`${page}/opengraph-image`);
      revalidated.push(page);
    }
  }

  return NextResponse.json({ revalidated });
}
