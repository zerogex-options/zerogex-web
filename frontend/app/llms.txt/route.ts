// https://zerogex.io/llms.txt — the curated map answer engines read.
// Content and rationale live in core/llmsTxt.ts.

import { LLMS_HEADERS, buildLlmsTxt, loadSnapshots } from '@/core/llmsTxt';

// Quotes today's levels, so it cannot be built once at deploy time. The
// upstream reads are still 900s-cached and shared with the free levels pages,
// and the response carries the same s-maxage.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return new Response(buildLlmsTxt(await loadSnapshots()), { headers: LLMS_HEADERS });
}
