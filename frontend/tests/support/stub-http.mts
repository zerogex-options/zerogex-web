// Preloaded with `node --import` by tests/busyDatabase.test.ts, after
// scripts/email-audit/stub-resend.mts: answers the HTTP calls a scheduled
// script makes besides Resend (Stripe, the ZeroGEX backend) from canned JSON,
// so the script runs end to end without leaving the box.
//
//   STUB_HTTP_ROUTES  JSON object of "<METHOD> <host><path>" -> the JSON body
//                     to answer with, status 200. The query string is ignored.
//   STUB_HTTP_LOG     file each answered request is appended to, one JSON line
//                     ({ method, url, body }), so a test can count the calls.
//
// Anything else goes to the fetch underneath (stub-resend's, which captures
// Resend and passes the rest on), except that a Stripe call with no route gets
// a 404 in Stripe's error shape rather than reaching the real API.
import { appendFileSync } from 'node:fs';
import { register } from 'node:module';

// The stripe package's Node build talks over node:https, out of a fetch stub's
// reach. Its worker build, the one edge runtimes get, sends the same requests
// through fetch, so 'stripe' resolves to that build here.
register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, next) {
      if (specifier !== 'stripe') return next(specifier, context);
      return next(specifier, { ...context, conditions: ['worker', ...context.conditions] });
    }
  `)}`,
);

const routes = JSON.parse(process.env.STUB_HTTP_ROUTES ?? '{}') as Record<string, unknown>;
const log = process.env.STUB_HTTP_LOG;
const underlying = globalThis.fetch;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? 'GET').toUpperCase();
  const route = `${method} ${url.host}${url.pathname}`;
  if (Object.hasOwn(routes, route)) {
    if (log) {
      appendFileSync(log, `${JSON.stringify({ method, url: url.href, body: init?.body == null ? null : String(init.body) })}\n`);
    }
    return json(200, routes[route]);
  }
  if (url.host === 'api.stripe.com') {
    return json(404, { error: { type: 'invalid_request_error', code: 'resource_missing', message: `No stub for ${route}` } });
  }
  return underlying(input, init);
}) as typeof globalThis.fetch;
