import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIpFromHeaders } from '../core/clientIp.ts';

// nginx sets X-Real-IP from Cloudflare's CF-Connecting-IP and replaces any the
// visitor sent, but it APPENDS to X-Forwarded-For. Reading the first
// X-Forwarded-For entry let a script choose its own address per request and
// skip every per-IP limit (login, reset, signup, levels email).

const headers = (h: Record<string, string>) => ({ get: (name: string) => h[name.toLowerCase()] ?? null });

test('X-Real-IP, which nginx sets, is the address', () => {
  assert.equal(
    clientIpFromHeaders(headers({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '1.2.3.4, 203.0.113.9' })),
    '203.0.113.9',
  );
});

test('a forged first X-Forwarded-For entry is never the address', () => {
  // What arrives when a visitor sends "X-Forwarded-For: 1.2.3.4" and nginx
  // appends the real address.
  assert.equal(clientIpFromHeaders(headers({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' })), '203.0.113.9');
  assert.equal(clientIpFromHeaders(headers({ 'x-forwarded-for': ' 203.0.113.9 ' })), '203.0.113.9');
});

test('no usable header gives null', () => {
  assert.equal(clientIpFromHeaders(headers({})), null);
  assert.equal(clientIpFromHeaders(headers({ 'x-real-ip': '  ', 'x-forwarded-for': ' , ' })), null);
});
