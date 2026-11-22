import { proxyToApi } from '@/core/api/proxy';

// The public scorecard's API. The pages render the daily scorecard and the
// session list server-side (serverApiGet), but the signal pages fetch each
// signal's trailing record (/api/scorecard/signal-record) from the browser,
// and with no route here every one of those got Next's 404, so the "last 30
// sessions" line never showed. Scorecards are published openly, so this adds
// no tier rule.
export const dynamic = 'force-dynamic';

export const GET = proxyToApi;
export const HEAD = proxyToApi;
