// https://zerogex.io/llms-full.txt — the curated map plus the full text of
// every explainer, for a client that would rather make one request than
// thirty-six. Content and rationale live in core/llmsTxt.ts.

import { LLMS_HEADERS, buildLlmsFullTxt, loadSnapshots } from '@/core/llmsTxt';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return new Response(buildLlmsFullTxt(await loadSnapshots()), { headers: LLMS_HEADERS });
}
