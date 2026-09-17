import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  issueCsrfCookie,
  mutateSavedLayoutForRequest,
  validateCsrf,
} from '@/core/serverAuth';

/**
 * Rename (PATCH) or remove (DELETE) one saved board.
 *
 * Both resolve the board by id AND user_id, so knowing an id is not enough to
 * touch someone else's board.
 */

export const dynamic = 'force-dynamic';

async function handle(
  request: NextRequest,
  id: string,
  input: { name?: unknown; deleted?: unknown },
) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const result = await mutateSavedLayoutForRequest(request, id, input);
  if (!result) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if ('error' in result) {
    // "No such board" covers both a board that never existed and one owned by
    // somebody else — deliberately the same answer, so an id cannot be probed.
    const status = result.error === 'No such board' ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  const response = NextResponse.json({ ok: true, layouts: result.layouts });
  response.headers.set('Cache-Control', 'no-store, private');
  issueCsrfCookie(response, result.csrfToken);
  if (result.rotatedToken) attachSessionCookie(response, result.rotatedToken);
  return response;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }
  return handle(request, id, { name: body.name });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handle(request, id, { deleted: true });
}
