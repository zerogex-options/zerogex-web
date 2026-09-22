import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadEnvLocal } from '../scripts/env-local.mts';

// The env loader every bare-Node script uses, and the class of bug it exists to
// kill: a script naming the handful of variables it thinks it needs, while the
// real requirement lives at MODULE LOAD inside files it never mentions. When
// that list drifts nothing fails — core/stripe.ts just builds an empty
// price→SKU table, every plan reads "unknown", and it looks like a
// classification bug rather than a missing variable. That exact failure shipped.

function withEnvFile(contents: string, run: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-env-'));
  fs.writeFileSync(path.join(dir, '.env.local'), contents);
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('every key is hoisted, not a chosen few', () => {
  withEnvFile('AUTH_DB_PATH=/tmp/a.db\nSTRIPE_PRICE_PRO_MONTHLY=price_x\nRESEND_FROM_EMAIL=a@b.c\n', (dir) => {
    for (const key of ['AUTH_DB_PATH', 'STRIPE_PRICE_PRO_MONTHLY', 'RESEND_FROM_EMAIL']) delete process.env[key];
    const loaded = loadEnvLocal(dir);
    // The price id is the one that used to be missed, and its absence is silent.
    assert.ok(loaded.includes('STRIPE_PRICE_PRO_MONTHLY'));
    assert.equal(process.env.STRIPE_PRICE_PRO_MONTHLY, 'price_x');
    assert.equal(process.env.RESEND_FROM_EMAIL, 'a@b.c');
    for (const key of ['AUTH_DB_PATH', 'STRIPE_PRICE_PRO_MONTHLY', 'RESEND_FROM_EMAIL']) delete process.env[key];
  });
});

test('the real environment always wins over the file', () => {
  withEnvFile('AUTH_DB_PATH=/tmp/from-file.db\n', (dir) => {
    process.env.AUTH_DB_PATH = '/tmp/explicit.db';
    const loaded = loadEnvLocal(dir);
    // `AUTH_DB_PATH=… make …` must not be silently overridden by the file.
    assert.ok(!loaded.includes('AUTH_DB_PATH'));
    assert.equal(process.env.AUTH_DB_PATH, '/tmp/explicit.db');
    delete process.env.AUTH_DB_PATH;
  });
});

test('quotes are stripped and comments and blanks ignored', () => {
  withEnvFile('# a comment\n\nQUOTED="hello"\nSINGLE=\'world\'\nBARE=plain\nNOEQUALS\n', (dir) => {
    for (const key of ['QUOTED', 'SINGLE', 'BARE']) delete process.env[key];
    loadEnvLocal(dir);
    assert.equal(process.env.QUOTED, 'hello');
    assert.equal(process.env.SINGLE, 'world');
    assert.equal(process.env.BARE, 'plain');
    for (const key of ['QUOTED', 'SINGLE', 'BARE']) delete process.env[key];
  });
});

test('a value containing = survives intact', () => {
  withEnvFile('KEY=a=b=c\n', (dir) => {
    delete process.env.KEY;
    loadEnvLocal(dir);
    assert.equal(process.env.KEY, 'a=b=c');
    delete process.env.KEY;
  });
});

test('a missing file is not an error', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-env-none-'));
  assert.deepEqual(loadEnvLocal(dir), []);
  fs.rmSync(dir, { recursive: true, force: true });
});
