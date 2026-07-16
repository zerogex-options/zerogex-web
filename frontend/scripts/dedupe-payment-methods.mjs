#!/usr/bin/env node

// Detach DUPLICATE payment methods from Stripe customers, and/or INSPECT what a
// customer actually has attached. Repeated Checkout sessions (e.g. a churned
// member resubscribing, often via Link) attach the same card again and again,
// so a customer accumulates several payment methods that are really one card.
//
// It lists ALL payment method types (not just `card`) and groups them by a
// stable per-card key:
//   • card-type PMs (including Link-wallet cards)  -> card.fingerprint
//   • link-type PMs                                -> link.email
//   • anything with neither                        -> left alone (never grouped)
// For each group with more than one, it keeps a single method and detaches the
// rest.
//
// SAFE-BY-DESIGN
//   • Never detaches a PROTECTED payment method: the customer's
//     invoice_settings.default_payment_method, or any subscription's
//     default_payment_method. Those are what actually get charged.
//   • Within a group it keeps the protected method if present, else the newest,
//     and detaches only the other same-card copies.
//   • Groups of one are never touched. Methods with no usable key are skipped.
//   • Dry-run by default — prints what it WOULD detach. Pass --apply to detach.
//   • Best-effort per customer/PM: one failure never aborts the run.
//
// Intentionally a manual backfill, NOT a webhook auto-detach — auto-detaching
// cards in the payment hot path is disproportionate risk for a cosmetic dedup.
//
// Run from the frontend/ directory (nvm 22):
//   node --no-warnings scripts/dedupe-payment-methods.mjs \
//     (--email <addr> | --customer cus_... | --all) [--inspect | --apply]
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
  const args = { email: null, customer: null, all: false, inspect: false, apply: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--customer' || arg === '-c') args.customer = (argv[++i] ?? '').trim() || null;
    else if (arg === '--all') args.all = true;
    else if (arg === '--inspect') args.inspect = true;
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
  node --no-warnings scripts/dedupe-payment-methods.mjs \\
    (--email <addr> | --customer cus_... | --all) [--inspect | --apply]

Detaches duplicate (same card / same Link email) payment methods from Stripe
customers, always keeping the default / subscription method. Dry-run unless
--apply. Use --inspect to dump what a customer has (type, fingerprint, Link
email, which are protected) without changing anything.

Target (exactly one):
  -e, --email <addr>       Customer(s) with this email.
  -c, --customer cus_...   One customer by id (works on orphaned customers too).
      --all                Every customer (paginated).

Mode:
      --inspect            List payment methods + flags; never detaches. With
                           --all, only shows customers with 2+ methods.
      --apply              Detach duplicates. Omit for a dry-run preview.
  -h, --help               Show this help.

Reads STRIPE_SECRET_KEY from env or .env.local.`);
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
}
const targetCount = [cliArgs.email, cliArgs.customer, cliArgs.all ? 'all' : null].filter(Boolean).length;
if (targetCount !== 1) {
  console.error('Error: provide exactly one of --email <addr>, --customer cus_..., or --all. See --help.');
  process.exit(1);
}
if (cliArgs.inspect && cliArgs.apply) {
  console.error('Error: --inspect and --apply are mutually exclusive.');
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
const isoOf = (unix) => (typeof unix === 'number' ? new Date(unix * 1000).toISOString() : '—');

// Stable per-card identity used to group "the same card". card.fingerprint is
// the same across PMs for one card (incl. Link-wallet cards); link-type PMs
// carry no card object, so fall back to the Link email. No key => never grouped.
function dedupKey(pm) {
  const fp = pm.card?.fingerprint;
  if (fp) return `fp:${fp}`;
  if (pm.type === 'link' && pm.link?.email) return `link:${pm.link.email.toLowerCase()}`;
  return null;
}

// Subscription statuses that can still produce a charge — their
// default_payment_method must be protected. canceled / incomplete_expired subs
// never charge again, so the card they once used is free to dedupe. (A customer
// who resubscribed several times has a dead sub per old card; protecting those
// would make the dedupe a no-op.)
const LIVE_SUB_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'paused',
  'incomplete',
]);

// Map of payment-method-id -> why it is protected (must never be detached): the
// customer's invoice default, or the default of a still-live subscription.
async function protectedPmInfo(customer) {
  const reasons = new Map();
  const invoiceDefault = idOf(customer.invoice_settings?.default_payment_method);
  if (invoiceDefault) reasons.set(invoiceDefault, 'invoice-default');
  const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 });
  for (const s of subs.data) {
    if (!LIVE_SUB_STATUSES.has(s.status)) continue; // dead sub — its card can be deduped
    const d = idOf(s.default_payment_method);
    if (d && !reasons.has(d)) reasons.set(d, `sub:${s.status}`);
  }
  return reasons;
}

// Returns the PMs to detach (never a protected PM). Keeps, per key group, the
// protected method(s) if present, else the newest.
function planDetachments(pms, protectedIds) {
  const groups = new Map();
  for (const pm of pms) {
    const key = dedupKey(pm);
    if (!key) continue; // can't prove it's a duplicate — leave it
    (groups.get(key) ?? groups.set(key, []).get(key)).push(pm);
  }
  const toDetach = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const hasProtected = group.some((pm) => protectedIds.has(pm.id));
    if (hasProtected) {
      for (const pm of group) if (!protectedIds.has(pm.id)) toDetach.push(pm);
    } else {
      const newest = group.reduce((a, b) => (b.created > a.created ? b : a));
      for (const pm of group) if (pm.id !== newest.id && !protectedIds.has(pm.id)) toDetach.push(pm);
    }
  }
  return toDetach;
}

function pmDescriptor(pm) {
  const who = pm.card ? `${pm.card.brand ?? 'card'} ••••${pm.card.last4 ?? '????'}` : pm.link?.email ?? '—';
  const fp = pm.card?.fingerprint ?? '—';
  const wallet = pm.card?.wallet?.type ?? '—';
  return `${pm.id} type=${pm.type} ${who} fp=${fp} wallet=${wallet} key=${dedupKey(pm) ?? '—'} created=${isoOf(pm.created)}`;
}

async function listPmsAndProtected(customer) {
  const reasons = await protectedPmInfo(customer);
  // No `type` filter => all payment method types (cards, link, etc.).
  const pms = (await stripe.paymentMethods.list({ customer: customer.id, limit: 100 })).data;
  return { reasons, protectedIds: new Set(reasons.keys()), pms };
}

async function inspectCustomer(customer, showEmptyish) {
  let data;
  try {
    data = await listPmsAndProtected(customer);
  } catch (err) {
    console.error(`  ! ${customer.id} (${customer.email ?? '—'}): ${err.message}`);
    return;
  }
  const { reasons, protectedIds, pms } = data;
  if (!showEmptyish && pms.length < 2) return; // --all inspect: skip singletons
  const detachSet = new Set(planDetachments(pms, protectedIds).map((p) => p.id));
  console.log(`\nCustomer ${customer.id} (${customer.email ?? '—'}) — ${pms.length} payment method(s):`);
  for (const pm of [...pms].sort((a, b) => a.created - b.created)) {
    const flag = detachSet.has(pm.id)
      ? 'DUP → would detach'
      : reasons.has(pm.id)
        ? `keep (${reasons.get(pm.id)})`
        : 'keep';
    console.log(`  [${flag}] ${pmDescriptor(pm)}`);
  }
}

async function dedupeCustomer(customer) {
  let data;
  try {
    data = await listPmsAndProtected(customer);
  } catch (err) {
    console.error(`  ! ${customer.id} (${customer.email ?? '—'}): ${err.message}`);
    return { detached: 0 };
  }
  const { protectedIds, pms } = data;
  const toDetach = planDetachments(pms, protectedIds);
  if (toDetach.length === 0) return { detached: 0 };

  console.log(`  ${customer.id} (${customer.email ?? '—'}): ${pms.length} methods, ${toDetach.length} duplicate(s) to detach`);
  let detached = 0;
  for (const pm of toDetach) {
    if (!cliArgs.apply) {
      console.log(`      would detach ${pmDescriptor(pm)}`);
      continue;
    }
    try {
      await stripe.paymentMethods.detach(pm.id);
      console.log(`      detached ${pmDescriptor(pm)}`);
      detached++;
    } catch (err) {
      console.error(`      ! failed to detach ${pm.id}: ${err.message}`);
    }
  }
  return { detached };
}

async function* customersToProcess() {
  if (cliArgs.customer) {
    try {
      const c = await stripe.customers.retrieve(cliArgs.customer);
      if (!c || c.deleted) {
        console.error(`No such customer ${cliArgs.customer} (or it is deleted).`);
        return;
      }
      yield c;
    } catch (err) {
      console.error(`Could not retrieve customer ${cliArgs.customer}: ${err.message}`);
    }
    return;
  }
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
console.log(cliArgs.inspect ? 'Mode:   INSPECT (no changes)' : cliArgs.apply ? 'Mode:   APPLY (detaching duplicates)' : 'Mode:   dry-run (no changes)');

// A single-customer target (email/customer) prints even singletons; --all only
// surfaces customers with 2+ methods so the scan stays readable.
const showEmptyish = !cliArgs.all;

let customersSeen = 0;
let totalDetached = 0;
try {
  for await (const customer of customersToProcess()) {
    customersSeen++;
    if (cliArgs.inspect) await inspectCustomer(customer, showEmptyish);
    else {
      const { detached } = await dedupeCustomer(customer);
      totalDetached += detached;
    }
  }
} catch (err) {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
}

console.log('');
if ((cliArgs.email || cliArgs.customer) && customersSeen === 0) {
  console.log(`No matching Stripe customer found.`);
} else if (cliArgs.inspect) {
  console.log(`Inspected ${customersSeen} customer(s).`);
} else if (cliArgs.apply) {
  console.log(`Done. Scanned ${customersSeen} customer(s); detached ${totalDetached} duplicate(s).`);
} else {
  console.log(`Dry-run complete. Scanned ${customersSeen} customer(s); ${totalDetached} duplicate(s) would be detached. Re-run with --apply.`);
}
