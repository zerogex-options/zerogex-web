#!/usr/bin/env node

// Detach DUPLICATE card payment methods from Stripe customers. Repeated Checkout
// sessions (e.g. a churned member resubscribing) each attach the card again via
// Link, so a customer accumulates several payment methods that are really the
// same card. This groups a customer's cards by Stripe's card.fingerprint and,
// for each group with more than one, keeps a single card and detaches the rest.
//
// SAFE-BY-DESIGN
//   • Never detaches a PROTECTED payment method: the customer's
//     invoice_settings.default_payment_method, or any of their subscriptions'
//     default_payment_method. Those are what actually get charged.
//   • Within a fingerprint group it keeps the protected card if one is present,
//     otherwise the newest, and detaches only the other exact-same-card copies.
//   • Groups of one are never touched. Cards with no fingerprint are skipped.
//   • Dry-run by default — prints exactly what it WOULD detach. Pass --apply to
//     detach. Best-effort per customer/PM: one failure never aborts the run.
//
// This is a backfill you run on demand (or occasionally). It is intentionally
// NOT wired into the Stripe webhook: auto-detaching cards in the payment hot
// path is disproportionate risk for what is a cosmetic dedup — run this instead.
//
// Run from the frontend/ directory (nvm 22):
//   node --no-warnings scripts/dedupe-payment-methods.mjs (--email <addr> | --all) [--apply]
// Reads STRIPE_SECRET_KEY from env or .env.local.

import fs from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, eq).trim()] = value;
  }
  return env;
}

function parseArgs(argv) {
  const args = { email: null, all: false, apply: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--all') args.all = true;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --no-warnings scripts/dedupe-payment-methods.mjs (--email <addr> | --all) [--apply]

Detaches duplicate (same-fingerprint) card payment methods from Stripe customers,
always keeping the default / subscription card. Dry-run unless --apply.

Options:
  -e, --email <addr>   Only the customer(s) with this email.
      --all            Every customer (paginated).
      --apply          Detach. Omit for a dry-run preview.
  -h, --help           Show this help.

Reads STRIPE_SECRET_KEY from env or .env.local.`);
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
}
if (cliArgs.email && cliArgs.all) {
  console.error('Error: --email and --all are mutually exclusive.');
  process.exit(1);
}
if (!cliArgs.email && !cliArgs.all) {
  console.error('Error: provide --email <addr> or --all. See --help.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || envLocal.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY not set in env or .env.local.');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);
const idOf = (v) => (typeof v === 'string' ? v : v && v.id ? v.id : null);

// The set of payment methods we must never detach for a customer: the invoice
// default plus every subscription's default_payment_method.
async function protectedPmIds(customer) {
  const ids = new Set();
  const invoiceDefault = idOf(customer.invoice_settings?.default_payment_method);
  if (invoiceDefault) ids.add(invoiceDefault);
  const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 });
  for (const s of subs.data) {
    const d = idOf(s.default_payment_method);
    if (d) ids.add(d);
  }
  return ids;
}

// Returns the PMs to detach for one customer (never any protected PM). Keeps,
// per fingerprint group: the protected card(s) if present, else the newest.
function planDetachments(cards, protectedIds) {
  const byFingerprint = new Map();
  for (const pm of cards) {
    const fp = pm.card?.fingerprint;
    if (!fp) continue; // can't prove it's a duplicate — leave it
    (byFingerprint.get(fp) ?? byFingerprint.set(fp, []).get(fp)).push(pm);
  }
  const toDetach = [];
  for (const group of byFingerprint.values()) {
    if (group.length < 2) continue;
    const hasProtected = group.some((pm) => protectedIds.has(pm.id));
    if (hasProtected) {
      // Keep the protected card(s); detach every other copy.
      for (const pm of group) if (!protectedIds.has(pm.id)) toDetach.push(pm);
    } else {
      // Keep the newest; detach the older copies. Never touch a protected PM
      // (there are none in this branch, but guard anyway).
      const newest = group.reduce((a, b) => (b.created > a.created ? b : a));
      for (const pm of group) {
        if (pm.id !== newest.id && !protectedIds.has(pm.id)) toDetach.push(pm);
      }
    }
  }
  return toDetach;
}

async function processCustomer(customer) {
  let protectedIds;
  try {
    protectedIds = await protectedPmIds(customer);
  } catch (err) {
    console.error(`  ! ${customer.id} (${customer.email ?? '—'}): could not read subscriptions: ${err.message}`);
    return { detached: 0 };
  }
  let cards;
  try {
    cards = (await stripe.paymentMethods.list({ customer: customer.id, type: 'card', limit: 100 })).data;
  } catch (err) {
    console.error(`  ! ${customer.id} (${customer.email ?? '—'}): could not list cards: ${err.message}`);
    return { detached: 0 };
  }
  const toDetach = planDetachments(cards, protectedIds);
  if (toDetach.length === 0) return { detached: 0 };

  const label = (pm) =>
    `${pm.id} ${pm.card?.brand ?? 'card'} ••••${pm.card?.last4 ?? '????'} (fp ${pm.card?.fingerprint?.slice(0, 8) ?? '—'})`;
  console.log(`  ${customer.id} (${customer.email ?? '—'}): ${cards.length} cards, ${toDetach.length} duplicate(s) to detach`);
  let detached = 0;
  for (const pm of toDetach) {
    if (!cliArgs.apply) {
      console.log(`      would detach ${label(pm)}`);
      continue;
    }
    try {
      await stripe.paymentMethods.detach(pm.id);
      console.log(`      detached ${label(pm)}`);
      detached++;
    } catch (err) {
      console.error(`      ! failed to detach ${pm.id}: ${err.message}`);
    }
  }
  return { detached };
}

async function* customersToProcess() {
  if (cliArgs.email) {
    const res = await stripe.customers.list({ email: cliArgs.email, limit: 100 });
    for (const c of res.data) yield c;
    return;
  }
  let startingAfter;
  for (;;) {
    const res = await stripe.customers.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const c of res.data) yield c;
    if (!res.has_more || res.data.length === 0) break;
    startingAfter = res.data[res.data.length - 1].id;
  }
}

console.log(`Stripe: ${STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE mode' : 'test mode'}`);
console.log(cliArgs.apply ? 'Mode:   APPLY (detaching duplicates)' : 'Mode:   dry-run (no changes)');
console.log('');

let customersSeen = 0;
let totalDetached = 0;
try {
  for await (const customer of customersToProcess()) {
    customersSeen++;
    const { detached } = await processCustomer(customer);
    totalDetached += detached;
  }
} catch (err) {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
}

console.log('');
if (cliArgs.email && customersSeen === 0) {
  console.log(`No Stripe customer found with email ${cliArgs.email}.`);
} else if (cliArgs.apply) {
  console.log(`Done. Scanned ${customersSeen} customer(s); detached ${totalDetached} duplicate card(s).`);
} else {
  console.log(`Dry-run complete. Scanned ${customersSeen} customer(s); ${totalDetached} duplicate card(s) would be detached. Re-run with --apply.`);
}
