import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describeHttpError } from '../core/api/httpError.ts';
import {
  DATA_SERVICE_UNREACHABLE_MESSAGE,
  scheduledMaintenanceNotice,
  unreachableUpstreamReply,
} from '../core/maintenanceWindow.ts';

// The weekly maintenance (zerogex-oa's zerogex-oa-db-vacuum-full timer, Sunday
// 02:30 ET) stops the API for up to four hours. The browser proxy uses these to
// tell a member that's what they're seeing instead of answering "HTTP 502".

const at = (iso: string) => Date.parse(iso);

// 2026-11-22 is a Sunday in EST (UTC-5); 2026-07-12 is a Sunday in EDT (UTC-4).

test('the measured 2026-11-22 run, start to end, is inside the window', () => {
  for (const iso of [
    '2026-11-22T07:31:54Z', // 02:31:54 ET, the run started
    '2026-11-22T07:56:00Z', // 02:56 ET, when the member wrote in
    '2026-11-22T09:25:40Z', // 04:25:40 ET, the run finished
  ]) {
    assert.ok(scheduledMaintenanceNotice(at(iso)), iso);
  }
});

test('the window opens at 02:30 ET Sunday and closes at 06:45 ET', () => {
  assert.equal(scheduledMaintenanceNotice(at('2026-11-22T07:29:59Z')), null); // 02:29:59
  assert.ok(scheduledMaintenanceNotice(at('2026-11-22T07:30:00Z'))); // 02:30
  assert.ok(scheduledMaintenanceNotice(at('2026-11-22T11:44:59Z'))); // 06:44:59
  assert.equal(scheduledMaintenanceNotice(at('2026-11-22T11:45:00Z')), null); // 06:45
});

test('it follows Eastern time through daylight saving', () => {
  assert.ok(scheduledMaintenanceNotice(at('2026-07-12T07:00:00Z'))); // 03:00 EDT
  assert.equal(scheduledMaintenanceNotice(at('2026-07-12T06:00:00Z')), null); // 02:00 EDT
  assert.equal(scheduledMaintenanceNotice(at('2026-07-12T11:00:00Z')), null); // 07:00 EDT
});

test('no other day of the week is maintenance', () => {
  // 03:00 ET on Saturday 2026-11-21 and Monday 2026-11-23.
  assert.equal(scheduledMaintenanceNotice(at('2026-11-21T08:00:00Z')), null);
  assert.equal(scheduledMaintenanceNotice(at('2026-11-23T08:00:00Z')), null);
  // Sunday in ET but already Monday in UTC must still count: 06:00 ET is 11:00Z.
  assert.ok(scheduledMaintenanceNotice(at('2026-11-22T11:00:00Z')));
});

test('before 04:30 ET it names the usual end; after, the latest one', () => {
  const usual = scheduledMaintenanceNotice(at('2026-11-22T07:30:00Z'))!; // 02:30
  assert.match(usual.message, /usually back by 4:30 AM ET/);
  assert.equal(usual.retryAfterSeconds, 2 * 60 * 60);

  const late = scheduledMaintenanceNotice(at('2026-11-22T09:30:00Z'))!; // 04:30
  assert.match(late.message, /longer than usual/);
  assert.match(late.message, /6:45 AM ET at the latest/);
  assert.equal(late.retryAfterSeconds, (6 * 60 + 45 - (4 * 60 + 30)) * 60);
});

test('Retry-After is never under a minute', () => {
  const lastMinute = scheduledMaintenanceNotice(at('2026-11-22T11:44:30Z'))!; // 06:44:30
  assert.equal(lastMinute.retryAfterSeconds, 60);
});

test('inside the window the proxy answers 503 with the notice under every key the browser reads', () => {
  const reply = unreachableUpstreamReply(at('2026-11-22T07:56:00Z'));
  assert.equal(reply.status, 503);
  assert.equal(reply.body.maintenance, true);
  assert.match(reply.body.message, /Scheduled maintenance/);
  // clients.ts reads `message`; useApiData.ts reads `detail`.
  assert.equal(reply.body.detail, reply.body.message);
  assert.equal(reply.body.error, reply.body.message);
  // 02:56 ET, so 94 minutes to the usual 04:30 end.
  assert.equal(reply.headers['Retry-After'], String(94 * 60));
  assert.equal(reply.headers['Cache-Control'], 'no-store');
});

test('outside the window it stays a 502, worded for a member', () => {
  const reply = unreachableUpstreamReply(at('2026-11-23T15:00:00Z')); // Monday 10:00 ET
  assert.equal(reply.status, 502);
  assert.equal(reply.body.maintenance, false);
  assert.equal(reply.body.message, DATA_SERVICE_UNREACHABLE_MESSAGE);
  assert.equal(reply.body.detail, DATA_SERVICE_UNREACHABLE_MESSAGE);
  assert.equal(reply.headers['Retry-After'], undefined);
});

test('the browser proxy answers an unreachable API through unreachableUpstreamReply', () => {
  const src = readFileSync(new URL('../core/api/proxy.ts', import.meta.url), 'utf8');
  assert.match(src, /const reply = unreachableUpstreamReply\(Date\.now\(\)\);/);
  assert.doesNotMatch(src, /'Upstream API unreachable'/);
});

test('the browser helpers still read the keys the reply fills', () => {
  // If either helper stops reading its key, pages go back to "HTTP 502".
  const clients = readFileSync(new URL('../core/api/clients.ts', import.meta.url), 'utf8');
  assert.match(clients, /errorData\?\.message/);
  const hooks = readFileSync(new URL('../core/api/httpError.ts', import.meta.url), 'utf8');
  assert.match(hooks, /\.detail;/);
});

test('the data hooks turn the reply into its sentence', async () => {
  for (const nowMs of [at('2026-11-22T07:56:00Z'), at('2026-11-23T15:00:00Z')]) {
    const reply = unreachableUpstreamReply(nowMs);
    const response = new Response(JSON.stringify(reply.body), { status: reply.status });
    assert.equal(await describeHttpError(response), reply.body.message);
  }
});

test('no data hook builds a bare "API error: <status>" of its own', () => {
  // Each one that did showed "API error: 503" during maintenance while the
  // panels beside it explained the outage. core/api/httpError.ts is the one
  // place allowed to fall back to the bare status.
  for (const name of readdirSync(new URL('../hooks/', import.meta.url))) {
    if (!/\.tsx?$/.test(name)) continue;
    const src = readFileSync(new URL(`../hooks/${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /`API error: \$\{/, name);
  }
});
