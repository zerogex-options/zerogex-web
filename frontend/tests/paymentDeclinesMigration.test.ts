import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Production already HAS a payment_declines table, with real rows, in the shape
// it had before the diagnostic columns. The migration in core/db.ts must add the
// new columns around that data — never drop, rebuild or rewrite it — and must be
// safe to run again on every boot.

const NEW_COLUMNS = [
  'payment_intent_id',
  'payment_intent_status',
  'pi_error_type',
  'pi_error_code',
  'pi_error_decline_code',
  'pi_error_message',
  'advice_code',
  'network_advice_code',
  'network_status',
  'outcome_type',
  'outcome_reason',
  'risk_level',
  'risk_score',
  'outcome_rule',
  'card_network',
  'card_cvc_check',
  'card_postal_check',
  'card_3ds_result',
  'card_3ds_result_reason',
  'diagnostic_error',
];

// Boot core/db.ts against the file in a fresh process, the way a deploy does.
function bootApp(dbPath: string) {
  const dbModule = new URL('../core/db.ts', import.meta.url).href;
  execFileSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--no-warnings',
      '--input-type=module',
      '-e',
      `const { getDb } = await import(${JSON.stringify(dbModule)}); getDb();`,
    ],
    { env: { ...process.env, AUTH_DB_PATH: dbPath }, stdio: 'pipe' },
  );
}

test('the diagnostic columns are added around existing rows, and adding them again is a no-op', () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-decl-mig-')), 'auth.db');

  // The table as production created it, before method_type and everything since.
  const legacy = new DatabaseSync(dbPath);
  legacy.exec(`
    CREATE TABLE payment_declines (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      attempt_count INTEGER NOT NULL,
      charge_id TEXT,
      user_id TEXT,
      email TEXT,
      customer_id TEXT,
      subscription_id TEXT,
      price_id TEXT,
      tier TEXT,
      cadence TEXT,
      kind TEXT NOT NULL,
      billing_reason TEXT,
      amount_due INTEGER NOT NULL DEFAULT 0,
      currency TEXT,
      failure_code TEXT,
      decline_code TEXT,
      network_decline_code TEXT,
      failure_message TEXT,
      seller_message TEXT,
      category TEXT NOT NULL,
      card_brand TEXT,
      card_last4 TEXT,
      card_funding TEXT,
      card_country TEXT,
      next_attempt_at TEXT,
      grace_until TEXT,
      failed_at TEXT NOT NULL,
      outcome TEXT NOT NULL DEFAULT 'open',
      resolved_at TEXT,
      recovered_amount INTEGER,
      recovery_route TEXT,
      lost_reason TEXT,
      source TEXT NOT NULL DEFAULT 'webhook',
      recorded_at TEXT NOT NULL,
      UNIQUE(invoice_id, attempt_count)
    );
  `);
  legacy
    .prepare(
      `INSERT INTO payment_declines (id, invoice_id, attempt_count, email, tier, cadence, kind, amount_due,
         failure_code, decline_code, failure_message, category, card_brand, card_last4, failed_at, outcome,
         source, recorded_at)
       VALUES ('decl_old', 'in_old', 3, 'member@example.com', 'pro', 'monthly', 'renewal', 2900,
         'card_declined', 'payment_intent_generic_payment_failed', 'The payment failed.', 'unknown',
         'visa', '4242', '2026-09-16T01:50:00.000Z', 'open', 'webhook', '2026-09-16T01:50:01.000Z')`,
    )
    .run();
  const before = legacy.prepare(`SELECT * FROM payment_declines`).all();
  legacy.close();

  bootApp(dbPath);
  bootApp(dbPath);

  const after = new DatabaseSync(dbPath, { readOnly: true });
  const columns = (after.prepare(`PRAGMA table_info(payment_declines)`).all() as Array<{ name: string }>).map(
    (column) => column.name,
  );
  for (const column of NEW_COLUMNS) {
    assert.ok(columns.includes(column), `${column} was added`);
    assert.equal(columns.filter((name) => name === column).length, 1, `${column} was added once`);
  }

  const rows = after.prepare(`SELECT * FROM payment_declines`).all() as Array<Record<string, unknown>>;
  assert.equal(rows.length, 1);
  // Every value that was there is still there, unchanged …
  for (const [key, value] of Object.entries(before[0] as Record<string, unknown>)) {
    assert.deepEqual(rows[0][key], value, `${key} survived the migration`);
  }
  // … and the new columns read as "not captured", not as invented values.
  for (const column of NEW_COLUMNS) assert.equal(rows[0][column], null);
  after.close();
});
