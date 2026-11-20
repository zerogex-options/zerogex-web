// The backend calls pages make while rendering (core/api/serverFetch.ts) give
// up after UPSTREAM_TIMEOUT_MS.
//
// Without a limit, a backend that takes the connection and then never answers
// held the page open. On Nov 20, 2026, against a stand-in backend like that,
// the homepage hadn't answered after 15 s. In production nginx gives up on a
// page at 60 s and answers 504 itself.
//
// core/api/serverFetch.ts can't be imported here: it starts with
// `import 'server-only'`, which refuses to resolve under node's
// --experimental-strip-types loader (see tests/datedPermalinks.test.ts). So
// these tests pin the source's shape, plus the one platform behavior it relies
// on: that Node's fetch rejects with a TimeoutError when the signal runs out.
// End to end it was checked against two stand-in backends: one that never
// answers (the homepage renders without the track record in about 10 s) and
// one that does (repeat page views are still served from Next's cache).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const REPO = path.join(ROOT, '..');

const serverFetch = readFileSync(path.join(ROOT, 'core/api/serverFetch.ts'), 'utf8');

function timeoutMs(): number {
  const m = serverFetch.match(/const UPSTREAM_TIMEOUT_MS = ([\d_]+);/);
  assert.ok(m, 'UPSTREAM_TIMEOUT_MS is declared as a number');
  return Number(m[1].replace(/_/g, ''));
}

test('the one backend request carries the time limit', () => {
  const calls = serverFetch.match(/await fetch\(/g) ?? [];
  assert.equal(calls.length, 1, 'one request path, in serverApiGetResult');
  assert.match(serverFetch, /signal: AbortSignal\.timeout\(UPSTREAM_TIMEOUT_MS\)/);
});

test('a timeout is logged as one and returned as unavailable', () => {
  const catchBlock = serverFetch.slice(serverFetch.indexOf('} catch (err) {'));
  assert.match(catchBlock, /err\.name === 'TimeoutError'/);
  assert.match(catchBlock, /no answer from \$\{UPSTREAM_BASE\} within/);
  assert.match(catchBlock, /return \{ ok: false, reason: 'unavailable' \};/);
});

// nginx's `location /` timeout is how long a page gets before nginx answers 504
// itself: the HTTP bootstrap config, and the HTTPS one the server runs. Blocks
// end at a closing brace on its own line, since `${WEB_PORT}` in the heredocs
// carries a brace too. 070's port-80 `location /` only redirects, so only the
// blocks that proxy to the app count.
function pageProxyTimeoutsMs(step: string): number[] {
  const conf = readFileSync(path.join(REPO, step), 'utf8');
  const blocks = conf.match(/^ {4}location \/ \{\n[\s\S]*?\n {4}\}$/gm) ?? [];
  return blocks
    .filter((block) => block.includes('proxy_pass'))
    .map((block) => {
      const m = block.match(/proxy_read_timeout (\d+)s;/);
      assert.ok(m, `${step}: every proxying location / sets proxy_read_timeout`);
      return Number(m[1]) * 1000;
    });
}

for (const step of ['deploy/steps/050.nginx', 'deploy/steps/070.ssl']) {
  test(`three calls in a row fit inside nginx's page timeout (${step})`, () => {
    const timeouts = pageProxyTimeoutsMs(step);
    assert.ok(timeouts.length > 0, `${step} proxies location / to the app`);
    for (const nginxMs of timeouts) {
      assert.ok(
        timeoutMs() * 3 <= nginxMs,
        `UPSTREAM_TIMEOUT_MS (${timeoutMs()} ms) × 3 should fit in nginx's ${nginxMs} ms`,
      );
    }
  });
}

test("Node's fetch rejects with a TimeoutError when the limit runs out", async () => {
  // A stand-in backend that takes the connection and never answers.
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => sockets.add(socket));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  const started = Date.now();
  try {
    await assert.rejects(
      fetch(`http://127.0.0.1:${port}/api/forecast/available-dates`, {
        signal: AbortSignal.timeout(200),
      }),
      (err: unknown) => err instanceof Error && err.name === 'TimeoutError',
    );
    assert.ok(Date.now() - started < 2000, 'gave up close to the limit, not minutes later');
  } finally {
    for (const socket of sockets) socket.destroy();
    server.close();
  }
});
