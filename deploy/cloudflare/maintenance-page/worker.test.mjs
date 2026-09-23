// Run: node --test deploy/cloudflare/maintenance-page/worker.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';

register('./html-loader.mjs', import.meta.url);
const { default: worker } = await import('./worker.mjs');
const MAINTENANCE_HTML = await readFile(new URL('./maintenance.html', import.meta.url), 'utf8');

// Stand-in for the origin behind Cloudflare: each test decides what the
// Worker's fetch(request) gets back, and records what reached it.
let origin;
let forwarded;
globalThis.fetch = async (request) => {
  forwarded.push(request);
  return origin(request);
};

function answering(status, body = `origin ${status}`) {
  origin = async () => new Response(body, { status });
  forwarded = [];
}

function unreachable() {
  origin = async () => {
    throw new TypeError('Network connection lost.');
  };
  forwarded = [];
}

// Invoke the Worker the way the runtime does, recording whether it opted into
// passThroughOnException before doing anything else.
let passedThrough;
function serve(request) {
  passedThrough = false;
  const ctx = {
    passThroughOnException() {
      passedThrough = forwarded.length === 0;
    },
  };
  return worker.fetch(request, {}, ctx);
}

// What a browser sends for a navigation.
const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

function pageLoad(path = '/', init = {}) {
  return new Request(`https://zerogex.io${path}`, {
    ...init,
    headers: { Accept: BROWSER_ACCEPT, ...init.headers },
  });
}

async function assertMaintenancePage(response, originStatus) {
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Retry-After'), '300');
  assert.equal(response.headers.get('X-Origin-Status'), originStatus);
  assert.equal(await response.text(), MAINTENANCE_HTML);
}

test('a healthy page load is the origin response, untouched', async () => {
  const live = new Response('<html>live</html>', { status: 200 });
  origin = async () => live;
  forwarded = [];
  const request = pageLoad('/spx-gamma-levels');
  assert.equal(await serve(request), live);
  assert.deepEqual(forwarded, [request]);
});

for (const status of [502, 504, 520, 521, 522, 523, 524, 525, 526, 530]) {
  test(`a page load the origin answers ${status} gets the maintenance page`, async () => {
    answering(status);
    await assertMaintenancePage(await serve(pageLoad()), String(status));
    assert.equal(forwarded.length, 1, 'the origin is always asked first');
  });
}

test('a page load the origin cannot be reached for gets the maintenance page', async () => {
  unreachable();
  await assertMaintenancePage(await serve(pageLoad('/dashboard')), 'unreachable');
});

// 500 and 503 are the app itself answering; its own page is the accurate one.
for (const status of [200, 301, 304, 404, 500, 503]) {
  test(`an origin ${status} on a page load passes through`, async () => {
    answering(status, status === 304 ? null : `origin ${status}`);
    const response = await serve(pageLoad());
    assert.equal(response.status, status);
    assert.equal(response.headers.get('X-Origin-Status'), null);
  });
}

test('a HEAD page load during an outage gets the headers and no body', async () => {
  answering(521);
  const response = await serve(pageLoad('/', { method: 'HEAD' }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('X-Origin-Status'), '521');
  assert.equal(await response.text(), '');
});

test('requests that are not page loads get the origin answer even when it is down', async () => {
  const requests = [
    // The app's live-data polling.
    new Request('https://zerogex.io/api/gex/summary?symbol=SPX', { headers: { Accept: 'application/json' } }),
    // A Next.js RSC fetch and a static chunk.
    new Request('https://zerogex.io/spx-gamma-levels?_rsc=1a2b3', { headers: { Accept: '*/*', RSC: '1' } }),
    new Request('https://zerogex.io/_next/static/chunks/main.js', { headers: { Accept: '*/*' } }),
    // The maintenance page's own probe: a plain fetch, so it must see the real status.
    new Request('https://zerogex.io/dashboard', { method: 'HEAD' }),
    // A form post that happens to accept HTML.
    new Request('https://zerogex.io/login', { method: 'POST', headers: { Accept: BROWSER_ACCEPT }, body: 'x' }),
  ];
  for (const request of requests) {
    for (const outage of [() => answering(521), () => answering(502)]) {
      outage();
      const response = await serve(request);
      assert.notEqual(response.status, 503, `${request.method} ${request.url}`);
      assert.equal(response.headers.get('X-Origin-Status'), null, `${request.method} ${request.url}`);
      assert.deepEqual(forwarded, [request]);
    }
  }
});

test('every request opts into passThroughOnException before the origin is asked', async () => {
  for (const request of [pageLoad(), new Request('https://zerogex.io/api/x', { headers: { Accept: 'application/json' } })]) {
    answering(200);
    await serve(request);
    assert.equal(passedThrough, true, request.url);
  }
});

test('a request that is not a page load and cannot reach the origin is handed back to Cloudflare', async () => {
  // Rejecting is the hand-back: with passThroughOnException set, the runtime
  // retries the request against the origin as though the Worker weren't
  // there, which answers exactly what it would have without the Worker.
  unreachable();
  const probe = new Request('https://zerogex.io/dashboard', { method: 'HEAD' });
  await assert.rejects(serve(probe), /Network connection lost/);
  assert.equal(passedThrough, true);
});

test('the maintenance page stands on its own', () => {
  // The origin is down whenever this page is shown, so it can't lean on it.
  assert.doesNotMatch(MAINTENANCE_HTML, /<link\b/i, 'no external stylesheets');
  assert.doesNotMatch(MAINTENANCE_HTML, /<script\b[^>]*\bsrc=/i, 'no external scripts');
  assert.doesNotMatch(MAINTENANCE_HTML, /<img\b/i, 'no images');
  assert.doesNotMatch(MAINTENANCE_HTML, /url\(/i, 'no CSS-loaded resources');
});
