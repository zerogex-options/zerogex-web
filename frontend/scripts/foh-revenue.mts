#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22), or via `make foh-revenue`:
//   node --experimental-strip-types --no-warnings scripts/foh-revenue.mts [--quarter <"Q3 2026">]
//
// Prints a quarter's gross subscription revenue and the Folds of Honor donation
// it owes (pledgePct from content/giving/totals.json). This is Step 1 of the
// quarterly donation, done over Stripe's ordinary API instead of Stripe Sigma,
// which is a paid add-on. See core/fohRevenue.ts for exactly what is counted.
//
// STRICTLY READ-ONLY: lists invoices, writes nothing, sends nothing.
//
// Env: STRIPE_SECRET_KEY (env or .env.local).
// Flags:
//   --quarter <label>  Quarter to total (default: the one that most recently closed)

import fs from 'node:fs';
import path from 'node:path';

import Stripe from 'stripe';

import { loadEnvLocal } from './env-local.mts';
import { closingQuarterFor, formatQuarterRevenue, parseQuarterLabel } from '../core/fohRevenue.ts';
import { computeQuarterRevenue } from '../core/fohRevenueServer.ts';

loadEnvLocal();

let quarterLabel: string | null = null;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  switch (argv[i]) {
    case '--quarter': quarterLabel = argv[++i] ?? null; break;
    case '--help':
    case '-h':
      console.log('Usage: node --experimental-strip-types --no-warnings scripts/foh-revenue.mts [--quarter <"Q3 2026">]');
      process.exit(0);
  }
}

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('STRIPE_SECRET_KEY is not set (env or .env.local).');
  process.exit(1);
}

const quarter = quarterLabel ? parseQuarterLabel(quarterLabel) : closingQuarterFor(new Date());
if (quarter.endUnixExclusive * 1000 > Date.now()) {
  console.warn(`Note: ${quarter.label} has not closed yet, so this is a running total, not the final one.\n`);
}

const totals = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'giving', 'totals.json'), 'utf8')) as {
  pledgePct: number;
};

const revenue = await computeQuarterRevenue(new Stripe(secretKey), quarter, totals.pledgePct);
console.log(formatQuarterRevenue(revenue).join('\n'));
