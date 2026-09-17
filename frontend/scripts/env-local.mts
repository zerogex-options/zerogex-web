// Load .env.local into process.env for a bare-Node script.
//
// WHY THIS EXISTS RATHER THAN AN ALLOWLIST IN EACH SCRIPT. Next.js loads the
// whole file at app boot; a script does not, so each one used to name the
// handful of keys it thought it needed. That list has to stay in sync with
// every variable read at MODULE LOAD by anything the script transitively
// imports — and when it drifts, nothing fails. It degrades:
//
//   * core/stripe.ts builds its price→SKU table once at import. Miss
//     STRIPE_PRICE_* and the table is empty, every priceIdToSku() returns null,
//     and a backfill silently stamps every decline row with no tier or cadence.
//     The report then shows "plan unknown" for everything and looks like a
//     classification bug rather than a missing variable.
//   * core/mailer.ts reads RESEND_FROM_EMAIL inside the send. Miss it and the
//     script dies mid-run, after the first email has already gone out.
//
// Both of those happened. An allowlist cannot be kept correct by inspection,
// because the requirement lives in files the script never mentions. Loading the
// whole file is also simply closer to how the app runs, which is the behaviour a
// script operating on production data should be imitating.
//
// Never overwrites a variable already set in the real environment: an explicit
// `AUTH_DB_PATH=… make …` still wins.

import fs from 'node:fs';
import path from 'node:path';

export function loadEnvLocal(cwd: string = process.cwd()): string[] {
  const filePath = path.join(cwd, '.env.local');
  if (!fs.existsSync(filePath)) return [];
  const loaded: string[] = [];
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
    loaded.push(key);
  }
  return loaded;
}

/**
 * Warn when the plan price ids are absent, because their absence is INVISIBLE:
 * core/stripe.ts just builds an empty lookup and every plan reads "unknown".
 */
export function warnIfPricesUnconfigured(): void {
  const configured = [
    'STRIPE_PRICE_BASIC_MONTHLY',
    'STRIPE_PRICE_BASIC_ANNUAL',
    'STRIPE_PRICE_PRO_MONTHLY',
    'STRIPE_PRICE_PRO_ANNUAL',
  ].filter((key) => !!process.env[key]);
  if (configured.length === 0) {
    console.warn(
      '  ! No STRIPE_PRICE_* variables are set, so no invoice can be matched to a plan.\n' +
        '    Every plan will read "unknown". Set them in .env.local.',
    );
  }
}
