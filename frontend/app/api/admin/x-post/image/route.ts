import { NextRequest, NextResponse } from 'next/server';

import { requireSession } from '@/core/serverAuth';
import { getLatestXPostImage, XPostAdminError } from '@/core/xPost';

export const dynamic = 'force-dynamic';

// The Live Bulletin PNG the last scheduled run attached to the post, so the
// review page can show it and hand it over for a manual post.
export async function GET(request: NextRequest) {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    const forbidden = NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    forbidden.headers.set('Cache-Control', 'no-store, private');
    return forbidden;
  }
  const symbol = request.nextUrl.searchParams.get('symbol') || '';
  const mode = request.nextUrl.searchParams.get('mode') || '';
  if (!symbol || !mode) {
    return NextResponse.json({ error: 'symbol and mode are required' }, { status: 400 });
  }
  try {
    const png = await getLatestXPostImage(symbol, mode);
    if (!png) {
      const missing = NextResponse.json({ error: 'No image for this post' }, { status: 404 });
      missing.headers.set('Cache-Control', 'no-store, private');
      return missing;
    }
    return new NextResponse(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, private',
      },
    });
  } catch (err) {
    const status = err instanceof XPostAdminError && err.status ? err.status : 502;
    const message = err instanceof Error ? err.message : 'X-post service error';
    const response = NextResponse.json({ error: message }, { status });
    response.headers.set('Cache-Control', 'no-store, private');
    return response;
  }
}
