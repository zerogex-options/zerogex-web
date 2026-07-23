import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/core/serverAuth';
import { isAmbassadorProgramEnabled } from '@/core/ambassadorConfig';
import { recordAmbassadorVisit } from '@/core/ambassadors';

export const dynamic = 'force-dynamic';

// Public referral-link visit beacon. Deliberately minimal and defensive:
//   - IP rate-limited (in-memory) so it can't be hammered to inflate counters.
//   - The code is validated SERVER-SIDE inside recordAmbassadorVisit (only a real
//     ambassador's code ever increments a counter); unknown/non-ambassador codes
//     are silently ignored.
//   - Always returns 204 regardless of outcome, so it never leaks whether a code
//     is a valid ambassador code.
//   - Stores no IP/device/user data — only a per-code aggregate count.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_PER_WINDOW) return true;
  entry.count += 1;
  return false;
}

export async function POST(request: NextRequest) {
  const noContent = () => new NextResponse(null, { status: 204 });
  if (!isAmbassadorProgramEnabled()) return noContent();

  const ip = getClientIp(request);
  if (rateLimited(ip)) return new NextResponse(null, { status: 429 });

  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === 'string' ? body.code.trim().slice(0, 64) : '';
  if (code) {
    try {
      recordAmbassadorVisit(code);
    } catch {
      /* best-effort; never surface tracking errors to the visitor */
    }
  }
  return noContent();
}
