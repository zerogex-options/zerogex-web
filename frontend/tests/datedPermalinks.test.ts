import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// A dated permalink must not 404 because the backend hiccuped.
//
// /forecast/<sym>/<date>, /scorecard/<sym>/<date> and /replay/<sym>/<date> are
// indexed — they rank for "<ticker> <date> gamma levels"-shaped searches — and
// notFound() tells Google the URL is gone. Both forecast and scorecard used to
// do `if (!data) notFound()` over `serverApiGet`, whose null means BOTH "the
// API says this date has nothing" and "the API never answered". So an outage
// during a crawl served a hard 404 for a permalink with perfectly good data
// behind it, and the URL had to earn its place back. This was open as a
// follow-up in docs/seo/2026-09-04-search-console-review.md.
//
// core/api/serverFetch.ts cannot be imported here — it starts with
// `import 'server-only'`, which refuses to resolve under node's
// --experimental-strip-types loader, and that is why no test in this suite
// imports it. The behavior itself was verified end to end against a stub API
// in all three states (404, 503, connection refused); these assertions pin the
// shape so it cannot quietly regress.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');

const serverFetch = readFileSync(path.join(ROOT, 'core/api/serverFetch.ts'), 'utf8');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

const DATED_PAGES = [
  { name: 'forecast', file: 'app/forecast/[symbol]/[date]/page.tsx' },
  { name: 'scorecard', file: 'app/scorecard/[symbol]/[date]/page.tsx' },
  { name: 'hedging-flow', file: 'app/hedging-flow/[symbol]/[date]/page.tsx' },
] as const;

test('serverApiGetResult separates "no such row" from "no answer"', () => {
  assert.match(serverFetch, /export async function serverApiGetResult/);
  assert.match(serverFetch, /export type ApiResult/);
  // 404 and 410 are the API answering about the DATA. Everything else — a 500,
  // a 503, a rotated key's 401, a refused connection — is a fact about the
  // SERVICE and says nothing about whether the date exists.
  assert.match(
    serverFetch,
    /res\.status === 404 \|\| res\.status === 410 \? 'missing' : 'unavailable'/,
    'the missing/unavailable split must key off 404/410 only',
  );
  for (const branch of ['not set on the server', 'fetch failed reaching']) {
    const at = serverFetch.indexOf(branch);
    assert.ok(at > 0, `lost the "${branch}" failure branch`);
    assert.match(
      serverFetch.slice(at, at + 400),
      /reason: 'unavailable'/,
      `"${branch}" must not be reported as missing`,
    );
  }
});

test('serverApiGet still collapses to null for the callers that want that', () => {
  // Most callers render a clean empty state either way and should not have to
  // care. Keeping it as a wrapper is also what stops the two drifting.
  assert.match(serverFetch, /export async function serverApiGet</);
  assert.match(serverFetch, /return result\.ok \? result\.data : null;/);
});

for (const { name, file } of DATED_PAGES) {
  test(`/${name}/<symbol>/<date> 404s only when the date is genuinely missing`, () => {
    const source = read(file);
    assert.match(source, /serverApiGetResult/, `${name} must use the result-returning fetch`);
    assert.match(
      source,
      /if \(!result\.ok && result\.reason === 'missing'\) notFound\(\);/,
      `${name} must reserve notFound() for a missing date`,
    );
    assert.match(source, /<DataUnavailable/, `${name} must render a 200 when the API did not answer`);
    // The old shape, which is the whole bug.
    assert.ok(
      !/if \(!data\) notFound\(\);/.test(source),
      `${name} still 404s on any null — that de-indexes the permalink on an outage`,
    );
  });
}

test('replay keeps its own version of the same distinction', () => {
  // It got this right first and its branch carries a third case (today, before
  // the open, legitimately has no frames yet). Not refactored onto the shared
  // component for that reason — but it must not lose the distinction either.
  const source = read('app/replay/[symbol]/[date]/page.tsx');
  assert.match(source, /const unavailable = !data;/);
  assert.match(source, /data\.frames\.length === 0 && !data\.is_today\) notFound\(\)/);
});

test('the unavailable state says whose fault it is, and stays indexable', () => {
  const component = read('components/DataUnavailable.tsx');
  // Telling a visitor "there is no data for this date" when the truth is "our
  // backend is down" is a confident claim about our own ingestion.
  assert.match(component, /on our side, not a gap in the session/);
  // No noindex: the page is fine, the data service was not.
  assert.ok(!component.includes('noindex'), 'an outage must not deindex the permalink');
  // The component is the alternative to a 404, so it must not be able to send
  // one. Checked by the import rather than the bare word, which appears in the
  // file's own explanation of when a 404 IS right.
  assert.ok(
    !/from 'next\/navigation'/.test(component),
    'this component is the alternative to a 404, not a route that can send one',
  );
});
