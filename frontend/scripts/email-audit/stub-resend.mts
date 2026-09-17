// Preloaded with `node --import`: replaces the Resend transport so a standalone
// send-*.mts script renders and "sends" without leaving the box. The captured
// payload is appended to $CAPTURE_OUT as one JSON object per line.
import { appendFileSync } from 'node:fs';

const out = process.env.CAPTURE_OUT ?? '/tmp/captured-scripts.ndjson';
const real = globalThis.fetch;

globalThis.fetch = (async (input: unknown, init?: { body?: unknown; method?: string }) => {
  const url = String(
    typeof input === 'string' ? input : ((input as { url?: string })?.url ?? ''),
  );
  if (url.includes('resend.com')) {
    // Tag the line with the catalogue id from the environment. Positional
    // matching would silently mislabel every later body if one script failed to
    // reach its send, which in an audit is worse than a missing render.
    const payload = { __id: process.env.CAPTURE_ID ?? null, ...JSON.parse(String(init?.body ?? '{}')) };
    appendFileSync(out, JSON.stringify(payload) + '\n');
    return new Response(JSON.stringify({ id: 'email_audit' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return real(input as Parameters<typeof real>[0], init as Parameters<typeof real>[1]);
}) as typeof globalThis.fetch;
