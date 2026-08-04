import { proxyToApi } from '@/core/api/proxy';

// Same-origin BFF passthrough for the replay endpoints (/api/replay/sessions,
// /api/replay/range, …). The server-rendered /replay pages read these via
// serverApiGet, but the Pair Comparison scrubber is a client component that
// buffers a whole session in the browser, so it needs the replay surface
// reachable from the browser too — exactly like /api/gex/* already is. The
// replay router carries the same auth scope as /api/gex/*, so the bearer key
// proxyToApi attaches already authorizes it.
export const dynamic = 'force-dynamic';

export const GET = proxyToApi;
export const POST = proxyToApi;
export const PUT = proxyToApi;
export const PATCH = proxyToApi;
export const DELETE = proxyToApi;
export const HEAD = proxyToApi;
