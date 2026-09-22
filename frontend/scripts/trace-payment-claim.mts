#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/trace-payment-claim.mts \
//     [--email <addr>] [--amount 29.50] [--date 2026-09-14] [--last4 3392] \
//     [--lead-days N] [--lag-days N] [--verbose]
//
// Answer, with evidence, the one question a member's "you charged me" email
// asks: did ZeroGEX ever take this person's money?
//
// WHY THIS EXISTS. The Dashboard's search is keyed on the CUSTOMER, so typing
// the member's email answers a narrower question than the one being asked —
// "did this customer record pay us", not "did this person pay us". The two come
// apart in every interesting case:
//
//   - they hold a second account under another email,
//   - Checkout made a second customer from a typed address,
//   - the charge has no customer at all (a Payment Link, a one-off invoice),
//   - the PaymentIntent is incomplete, which the Payments list hides by default
//     and which can still have left a real authorization on their statement,
//   - the local user row was deleted, so nothing maps the customer back.
//
// In all of those, the email search says "no payments" and the member is
// holding a statement line that says otherwise. They are right and we are about
// to tell them they are wrong.
//
// So this sweep runs on the one identifier a customer record cannot hide: the
// CARD. Stripe gives every distinct card number a stable fingerprint, shared
// across customers and queryable in charge search. That makes the question
// answerable account-wide — every charge ever made with this physical card,
// under any customer, any email, linked to a local user or not.
//
// STRICTLY READ-ONLY. It creates nothing, writes no DB rows, sends no email,
// and never touches Stripe state.
//
// Reads STRIPE_SECRET_KEY from env or .env.local. Set AUTH_DB_PATH to override
// the default DB path (data/auth.db).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

import {
  buildChargeSearchQueries,
  decidePaymentClaim,
  DEFAULT_LAG_DAYS,
  DEFAULT_LEAD_DAYS,
  formatMinor,
  isAttributable,
  parseStatementAmount,
  quoteSearchValue,
  statementSearchWindow,
  type ChargeEvidence,
  type ChargeMatchStrength,
  type ChargeSearchQuery,
} from '../core/paymentClaim.ts';

// A runaway guard, not a business rule: charge search pages forever if a query
// is too broad (an amount every subscriber pays). Report the cap, never
// silently truncate.
const MAX_PER_QUERY = 500;

type Args = {
  email: string | null;
  amount: string | null;
  date: string | null;
  last4: string | null;
  leadDays: number | null;
  lagDays: number | null;
  verbose: boolean;
  help: boolean;
};

function usage() {
  console.log(`Trace a member's "you charged me" claim across the WHOLE Stripe account.

Usage:
  node --experimental-strip-types --no-warnings scripts/trace-payment-claim.mts [options]

Options:
  --email <addr>     The member who wrote in. Seeds the search with every Stripe
                     customer on that address and every card on them.
  --amount <n>       The amount on their statement, e.g. 29.50 or "$29.50".
  --date <date>      The date on their statement (YYYY-MM-DD). Treated as the
                     POSTED date, so the window reaches back further than
                     forward.
  --last4 <digits>   Card last four, when we hold no card for them.
  --lead-days <n>    How far BEFORE the statement date to search (default ${DEFAULT_LEAD_DAYS}).
  --lag-days <n>     How far AFTER (default ${DEFAULT_LAG_DAYS}).
  --verbose          Print every query run and every charge considered.
  --help             Show this help.

At least one of --email, --amount or --last4 is required.

Read-only. Nothing is created, written, sent or modified.

Examples:
  # "You charged my Capital One card $29.50 on Sept 13"
  node ... scripts/trace-payment-claim.mts --email them@example.com --amount 29.50 --date 2026-09-13

  # We hold nothing for them at all
  node ... scripts/trace-payment-claim.mts --amount 29.50 --date 2026-09-13 --last4 3392
`);
}

function parsePositive(raw: string | undefined, flag: string): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.error(`Error: ${flag} needs a non-negative number (got ${raw ?? 'nothing'}).`);
    process.exit(1);
  }
  return parsed;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    email: null,
    amount: null,
    date: null,
    last4: null,
    leadDays: null,
    lagDays: null,
    verbose: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--verbose') args.verbose = true;
    else if (arg === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase();
    else if (arg === '--amount') args.amount = argv[++i] ?? '';
    else if (arg === '--date') args.date = (argv[++i] ?? '').trim();
    else if (arg === '--last4') args.last4 = (argv[++i] ?? '').trim();
    else if (arg === '--lead-days') args.leadDays = parsePositive(argv[++i], '--lead-days');
    else if (arg === '--lag-days') args.lagDays = parsePositive(argv[++i], '--lag-days');
    else {
      console.error(`Error: unknown argument ${arg}. See --help.`);
      process.exit(1);
    }
  }
  return args;
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH.');
    console.error('Install it with: sudo apt-get install sqlite3');
    process.exit(1);
  }
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function querySqlite<T = Record<string, unknown>>(dbPath: string, sql: string): T[] {
  try {
    const output = execFileSync('sqlite3', ['-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return output ? (JSON.parse(output) as T[]) : [];
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr;
    const message =
      typeof stderr === 'string' ? stderr : stderr?.toString?.() ?? (err as Error).message;
    throw new Error(message.trim() || (err as Error).message);
  }
}

function isoOf(unix: number | null | undefined): string {
  return typeof unix === 'number' ? new Date(unix * 1000).toISOString() : '—';
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
}
if (!cliArgs.email && !cliArgs.amount && !cliArgs.last4) {
  console.error('Error: pass at least one of --email, --amount or --last4. See --help.');
  process.exit(1);
}

const amountMinor = cliArgs.amount == null ? null : parseStatementAmount(cliArgs.amount);
if (cliArgs.amount != null && amountMinor == null) {
  // Refused rather than guessed: a misread amount searches for the wrong number
  // and comes back with a confident, wrong "no such charge".
  console.error(`Error: could not read --amount ${JSON.stringify(cliArgs.amount)} as a money amount.`);
  console.error('Try a plain decimal, e.g. --amount 29.50');
  process.exit(1);
}

const window = cliArgs.date
  ? statementSearchWindow({
      postedDateIso: cliArgs.date,
      leadDays: cliArgs.leadDays ?? undefined,
      lagDays: cliArgs.lagDays ?? undefined,
    })
  : null;
if (cliArgs.date && !window) {
  console.error(`Error: could not read --date ${JSON.stringify(cliArgs.date)}. Use YYYY-MM-DD.`);
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
const liveMode = STRIPE_SECRET_KEY.startsWith('sk_live_') || STRIPE_SECRET_KEY.startsWith('rk_live_');

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
const haveDb = fs.existsSync(dbPath);
if (haveDb) ensureSqlite3Cli();

console.log('=== Payment claim ===');
console.log(`  Email                        ${cliArgs.email ?? '—'}`);
console.log(`  Amount claimed               ${amountMinor == null ? '—' : formatMinor(amountMinor)}`);
console.log(`  Statement date               ${cliArgs.date ?? '—'}`);
console.log(`  Card last four               ${cliArgs.last4 ?? '—'}`);
console.log(
  `  Search window                ${window ? `${isoOf(window.fromUnix)} → ${isoOf(window.toUnix)}` : 'whole history'}`,
);
console.log(`  Stripe mode                  ${liveMode ? 'LIVE' : 'TEST'}`);
if (!liveMode) {
  console.log('  ⚠ This is a TEST key. Real member money lives on the live account.');
}

// --- Seed: every Stripe customer on that email, and every card on them -------
// customers.list({email}) matches ALL customers on the address, which is the
// duplicate case the Dashboard search papers over by showing the first.

type LocalUser = {
  id: string;
  email: string;
  tier: string | null;
  stripe_customer_id: string | null;
  deleted_at: string | null;
};

const localUsers: LocalUser[] = [];
if (haveDb && cliArgs.email) {
  localUsers.push(
    ...querySqlite<LocalUser>(
      dbPath,
      `SELECT id, email, tier, stripe_customer_id, deleted_at
         FROM users WHERE lower(email) = '${escapeSqlLiteral(cliArgs.email)}';`,
    ),
  );
}

const claimedCustomerIds = new Set<string>();
const customers: Stripe.Customer[] = [];
if (cliArgs.email) {
  for await (const customer of stripe.customers.list({ email: cliArgs.email, limit: 100 })) {
    customers.push(customer);
    claimedCustomerIds.add(customer.id);
  }
}
for (const user of localUsers) {
  // A customer id cached locally but no longer matching the Stripe email (they
  // changed it on one side only) would be missed by the list above.
  if (!user.stripe_customer_id || claimedCustomerIds.has(user.stripe_customer_id)) continue;
  try {
    const customer = await stripe.customers.retrieve(user.stripe_customer_id);
    if (!customer.deleted) {
      customers.push(customer as Stripe.Customer);
      claimedCustomerIds.add(customer.id);
    }
  } catch {
    /* a customer id that no longer resolves tells us nothing; keep going */
  }
}

console.log('\n=== Accounts on this email ===');
console.log(`  Local user rows              ${localUsers.length}`);
for (const user of localUsers) {
  console.log(
    `    ${user.id}  tier=${user.tier ?? '—'}  customer=${user.stripe_customer_id ?? '—'}${user.deleted_at ? '  DELETED' : ''}`,
  );
}
console.log(`  Stripe customers             ${customers.length}`);
for (const customer of customers) {
  console.log(`    ${customer.id}  ${customer.email ?? '—'}  created=${isoOf(customer.created)}`);
}
if (customers.length > 1) {
  console.log('  ⚠ More than one Stripe customer on this address — a Dashboard email search');
  console.log('    shows one of these and hides the rest.');
}

// Every card we can reach for this person, by fingerprint. This is what makes
// the sweep account-wide rather than customer-scoped.
const fingerprints = new Set<string>();
const cardLabels = new Map<string, string>();
// Payment methods that carry no card object — Stripe Link, a wallet, a bank
// debit. They have NO fingerprint, so the card sweep is blind to them, and a
// member paying this way cannot be linked to another account by card at all.
// Recorded so the report can say that out loud instead of returning a confident
// "nothing on their card" that was never capable of finding anything.
const unfingerprintable: string[] = [];
for (const customer of customers) {
  for await (const pm of stripe.paymentMethods.list({ customer: customer.id, limit: 100 })) {
    const card = pm.card;
    if (!card?.fingerprint) {
      unfingerprintable.push(`${pm.type} ${pm.id}`);
      continue;
    }
    fingerprints.add(card.fingerprint);
    cardLabels.set(
      card.fingerprint,
      `${card.brand ?? 'card'} ····${card.last4 ?? '????'} exp ${card.exp_month ?? '?'}/${card.exp_year ?? '?'}`,
    );
  }
}
// Their own customers' charge history, walked for two reasons: cards that only
// ever appeared on a charge (a Checkout that saved nothing) still carry a
// fingerprint, and every charge on a customer resolved from their own email is
// evidence in its own right.
const accountCharges = new Map<string, Stripe.Charge>();
for (const customerId of claimedCustomerIds) {
  for await (const charge of stripe.charges.list({ customer: customerId, limit: 100 })) {
    accountCharges.set(charge.id, charge);
    const card = charge.payment_method_details?.card;
    if (!card?.fingerprint || fingerprints.has(card.fingerprint)) continue;
    fingerprints.add(card.fingerprint);
    cardLabels.set(
      card.fingerprint,
      `${card.brand ?? 'card'} ····${card.last4 ?? '????'} (from charge ${charge.id})`,
    );
  }
}

// A second account under a different email and a different card is invisible to
// every charge-side query there is — Stripe's charge search has no email field,
// and a different card has a different fingerprint. The one thread left is the
// CARDHOLDER NAME, which Checkout collects and customer search can query.
//
// This is a pointer, not evidence: two people share a name often enough that a
// hit here proves nothing on its own. It is reported so an operator can go and
// look, and it is deliberately kept out of the fingerprint set so a stranger's
// card can never be promoted to "theirs".
const relatedByName: Stripe.Customer[] = [];
const claimedNames = [...new Set(customers.map((c) => c.name).filter((n): n is string => !!n))];
for (const name of claimedNames) {
  try {
    const found = await stripe.customers.search({
      query: `name:${quoteSearchValue(name)}`,
      limit: 100,
    });
    for (const customer of found.data) {
      if (claimedCustomerIds.has(customer.id)) continue;
      relatedByName.push(customer);
    }
  } catch (err) {
    console.log(`  ! customer name search failed for ${name}: ${(err as Error).message}`);
  }
}

console.log(`  Distinct cards known         ${fingerprints.size}`);
for (const fingerprint of fingerprints) {
  console.log(`    ${cardLabels.get(fingerprint)}  fp=${fingerprint}`);
}
if (unfingerprintable.length > 0) {
  console.log(`  Not fingerprintable          ${unfingerprintable.length}`);
  for (const pm of unfingerprintable) console.log(`    ${pm}`);
  console.log('    ↑ Link/wallet/bank methods carry no card fingerprint. The card sweep');
  console.log('      CANNOT see payments made this way, here or on any other account.');
}
if (fingerprints.size === 0) {
  console.log('  ⚠ No card fingerprint available for this person. The strongest query in');
  console.log('    this tool cannot run; everything below is circumstantial.');
}
if (relatedByName.length > 0) {
  console.log(`  Same cardholder name         ${relatedByName.length} OTHER customer(s)`);
  for (const customer of relatedByName) {
    console.log(`    ${customer.id}  ${customer.email ?? '—'}  "${customer.name ?? ''}"  created=${isoOf(customer.created)}`);
  }
  console.log('    ↑ a pointer, not proof — names collide. Check these before concluding.');
}

// --- Other accounts seen from the same IP ------------------------------------
// The card sweep answers "did this CARD pay us". It cannot answer "does this
// PERSON hold another account", and those come apart exactly when it matters:
// a second account, a second email, and a payment method with no fingerprint at
// all (Link, a wallet) is invisible to every query above.
//
// Our own audit log has the one signal that survives all of that. Every
// checkout, login and logout is stamped with an IP, so an account operated from
// the same address as this member's is a candidate for being theirs.
//
// A pointer, not proof — CGNAT, offices, households and VPNs share addresses —
// so it is reported with the overlap and left for a human to judge. An IP with
// a crowd behind it is dropped rather than shown, because that is a network,
// not a person.
const MAX_USERS_PER_IP = 20;
type IpNeighbour = { user_id: string; email: string; ip: string; hits: number; last_seen: string };
const neighbours: IpNeighbour[] = [];
if (haveDb && localUsers.length > 0) {
  const ownIds = localUsers.map((u) => `'${escapeSqlLiteral(u.id)}'`).join(', ');
  const ownIps = querySqlite<{ ip: string }>(
    dbPath,
    `SELECT DISTINCT ip FROM audit_events
      WHERE user_id IN (${ownIds}) AND ip IS NOT NULL AND ip != '';`,
  ).map((row) => row.ip);

  if (ownIps.length > 0) {
    const ipList = ownIps.map((ip) => `'${escapeSqlLiteral(ip)}'`).join(', ');
    const crowded = new Set(
      querySqlite<{ ip: string; users: number }>(
        dbPath,
        `SELECT ip, COUNT(DISTINCT user_id) AS users FROM audit_events
          WHERE ip IN (${ipList}) AND user_id IS NOT NULL
          GROUP BY ip HAVING users > ${MAX_USERS_PER_IP};`,
      ).map((row) => row.ip),
    );
    neighbours.push(
      ...querySqlite<IpNeighbour>(
        dbPath,
        `SELECT a.user_id AS user_id, u.email AS email, a.ip AS ip,
                COUNT(*) AS hits, MAX(a.created_at) AS last_seen
           FROM audit_events a JOIN users u ON u.id = a.user_id
          WHERE a.ip IN (${ipList}) AND a.user_id IS NOT NULL
            AND a.user_id NOT IN (${ownIds})
          GROUP BY a.user_id, a.ip
          ORDER BY hits DESC;`,
      ).filter((row) => !crowded.has(row.ip)),
    );
  }
}

console.log('\n=== Other accounts seen from the same IP ===');
if (neighbours.length === 0) {
  console.log('  none');
} else {
  for (const n of neighbours) {
    console.log(`  ${n.email.padEnd(34)} ${n.ip.padEnd(16)} ${String(n.hits).padStart(4)} event(s)  last ${n.last_seen}`);
    console.log(`      ${n.user_id}`);
  }
  console.log('  ↑ a pointer, not proof — addresses are shared. But a member telling you');
  console.log('    they paid, whose own card shows nothing, very often paid from here.');
  console.log('    Check with:  make diagnose-user EMAIL=<one of the above>');
}

// --- The sweep ---------------------------------------------------------------

const queries: ChargeSearchQuery[] = buildChargeSearchQueries({
  fingerprints: [...fingerprints],
  claim: { amountMinor, postedDateIso: cliArgs.date, last4: cliArgs.last4 },
  window,
});

console.log('\n=== Charge search (whole Stripe account) ===');
if (queries.length === 0) {
  console.log('  Nothing to search on — pass --amount or --last4.');
  process.exit(1);
}

type Seen = { charge: Stripe.Charge; via: Set<string>; strengths: Set<ChargeSearchQuery['strength']> };
const seen = new Map<string, Seen>();
const failedQueries: string[] = [];
let capped = false;

// Their own accounts' charges first, so the evidence is complete whether or not
// a search happens to return them.
for (const [id, charge] of accountCharges) {
  seen.set(id, { charge, via: new Set(['their own Stripe customer']), strengths: new Set() });
}

for (const q of queries) {
  let count = 0;
  try {
    for await (const charge of stripe.charges.search({ query: q.query, limit: 100 })) {
      count += 1;
      if (count > MAX_PER_QUERY) {
        capped = true;
        break;
      }
      const entry = seen.get(charge.id) ?? {
        charge,
        via: new Set<string>(),
        strengths: new Set<ChargeSearchQuery['strength']>(),
      };
      entry.via.add(q.label);
      entry.strengths.add(q.strength);
      seen.set(charge.id, entry);
    }
    console.log(`  ${count} hit(s) — ${q.label}${q.strength === 'circumstantial' ? '  [leads only]' : ''}`);
    if (cliArgs.verbose) console.log(`      query: ${q.query}`);
  } catch (err) {
    // A rejected query must not silently become "no charges found". It is
    // recorded so the verdict downgrades "nothing" to "inconclusive".
    const message = err instanceof Error ? err.message : String(err);
    failedQueries.push(`${q.label}: ${message}`);
    console.log(`  ERROR  — ${q.label}: ${message}`);
  }
}
if (failedQueries.length > 0) {
  console.log('  ⚠ A query did not run. A negative result from this sweep is INCONCLUSIVE.');
}
if (capped) {
  console.log(`  ⚠ A query hit the ${MAX_PER_QUERY}-result cap; narrow it with --date or --amount.`);
}

// Map each charge's customer back to a local user, so "we have money nothing
// local owns" is visible rather than inferred.
const localByCustomer = new Map<string, string>();
if (haveDb) {
  const customerIds = [...new Set([...seen.values()].map((e) => customerIdOf(e.charge)).filter(Boolean))];
  if (customerIds.length > 0) {
    const list = customerIds.map((id) => `'${escapeSqlLiteral(id as string)}'`).join(', ');
    for (const row of querySqlite<{ id: string; stripe_customer_id: string }>(
      dbPath,
      `SELECT id, stripe_customer_id FROM users WHERE stripe_customer_id IN (${list});`,
    )) {
      localByCustomer.set(row.stripe_customer_id, row.id);
    }
  }
}

function customerIdOf(charge: Stripe.Charge): string | null {
  return typeof charge.customer === 'string' ? charge.customer : charge.customer?.id ?? null;
}

const evidence: ChargeEvidence[] = [...seen.values()].map(({ charge, strengths }) => {
  const customerId = customerIdOf(charge);
  const onClaimedCustomer = customerId != null && claimedCustomerIds.has(customerId);
  const card = charge.payment_method_details?.card;
  // Precedence: the same physical card outranks everything; then a charge on a
  // customer resolved from their own email; anything else only looked similar.
  const matchStrength: ChargeMatchStrength = strengths.has('card')
    ? 'card'
    : onClaimedCustomer
      ? 'account'
      : 'circumstantial';
  return {
    id: charge.id,
    amountMinor: charge.amount ?? 0,
    amountRefundedMinor: charge.amount_refunded ?? 0,
    currency: charge.currency ?? 'usd',
    status: charge.status ?? 'unknown',
    createdUnix: charge.created ?? 0,
    customerId,
    localUserId: customerId ? localByCustomer.get(customerId) ?? null : null,
    onClaimedCustomer,
    matchStrength,
    cardLabel: card ? `${card.brand ?? 'card'} ····${card.last4 ?? '????'}` : null,
    disputed: charge.disputed === true,
    description: charge.description ?? null,
    invoiceId: typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id ?? null,
  };
});
evidence.sort((a, b) => b.createdUnix - a.createdUnix);

function printCharge(item: ChargeEvidence) {
  const refunded = item.amountRefundedMinor > 0 ? ` refunded=${formatMinor(item.amountRefundedMinor, item.currency)}` : '';
  const owner = item.localUserId
    ? `user=${item.localUserId}`
    : item.customerId
      ? 'NO LOCAL USER'
      : 'NO CUSTOMER';
  console.log(
    `  ${isoOf(item.createdUnix)}  ${formatMinor(item.amountMinor, item.currency).padStart(10)}  ` +
      `${item.status.padEnd(9)} ${owner}  ${item.id}${refunded}${item.disputed ? '  DISPUTED' : ''}`,
  );
  console.log(
    `      customer=${item.customerId ?? '—'}  invoice=${item.invoiceId ?? '—'}  ` +
      `card=${item.cardLabel ?? '—'}  ${item.onClaimedCustomer ? 'on the claimed customer' : 'NOT on the claimed customer'}`,
  );
  if (item.description) console.log(`      "${item.description}"`);
  if (cliArgs.verbose) console.log(`      matched by: ${[...(seen.get(item.id)?.via ?? [])].join(', ')}`);
}

// THEIRS and MAYBE-ANYONE'S are printed apart, because the first live run of
// this tool printed them in one list and the reader — and the verdict — read
// five strangers' charges as the member's money.
const theirs = evidence.filter(isAttributable);
const leadCharges = evidence.filter((c) => !isAttributable(c));

console.log('\n=== Charges that are THEIRS (same card, or their own customer) ===');
if (theirs.length === 0) console.log('  none');
for (const item of theirs) printCharge(item);

console.log('\n=== Leads: matched the amount/date only, owner NOT established ===');
if (leadCharges.length === 0) {
  console.log('  none');
} else {
  console.log('  Every member on the same rate matches this. None of it is counted as');
  console.log('  theirs. Compare the card and the local time against what they told you.');
  console.log('');
  for (const item of leadCharges) printCharge(item);
}

// --- Things the Payments list hides ------------------------------------------
// An incomplete PaymentIntent leaves no charge to find, and can still have put
// a pending authorization on the member's statement. Not money we hold — but
// the honest explanation for a statement line that later vanished, which is a
// far better answer than "there is no record of you".

console.log('\n=== Incomplete payment attempts (hidden in the Payments list by default) ===');
let incomplete = 0;
for (const customerId of claimedCustomerIds) {
  for await (const pi of stripe.paymentIntents.list({ customer: customerId, limit: 100 })) {
    if (pi.status === 'succeeded' || pi.status === 'canceled') continue;
    if (window && (pi.created < window.fromUnix || pi.created > window.toUnix)) continue;
    incomplete += 1;
    console.log(
      `  ${isoOf(pi.created)}  ${formatMinor(pi.amount ?? 0, pi.currency ?? 'usd').padStart(10)}  ${pi.status}  ${pi.id}`,
    );
  }
}
if (incomplete === 0) console.log('  none');

// --- The verdict -------------------------------------------------------------

const verdict = decidePaymentClaim({ charges: evidence, failedQueries });
console.log('\n=== Verdict ===');
switch (verdict.kind) {
  case 'collected':
    console.log(`  WE HAVE THEIR MONEY — ${formatMinor(verdict.netMinor)} net across ${verdict.charges.length} charge(s).`);
    console.log('  The member is right. Do NOT tell them they were never charged.');
    if (verdict.unlinked.length > 0) {
      console.log(`  ${verdict.unlinked.length} of those are NOT on the customer their email resolves to:`);
      for (const item of verdict.unlinked) {
        console.log(`    ${item.id}  customer=${item.customerId ?? '—'}  ${item.localUserId ? `user=${item.localUserId}` : 'no local user'}`);
      }
      console.log('  That is money collected against an account that cannot see it. Check');
      console.log('  `make scan-orphan-payments` and whether they hold a second account.');
    }
    break;
  case 'refunded':
    console.log(`  COLLECTED AND REFUNDED — net ${formatMinor(verdict.netMinor)}.`);
    console.log('  The charge they are looking at was real. Point them at the credit.');
    break;
  case 'attempted_only':
    console.log(`  NOTHING SETTLED ON THEIR CARD — ${verdict.charges.length} attempt(s), all declined.`);
    console.log('  On the evidence that is actually theirs, we have collected nothing.');
    break;
  case 'leads_only':
    console.log('  NOTHING ATTRIBUTABLE TO THEM, but the sweep found matching charges.');
    break;
  case 'inconclusive':
    console.log('  INCONCLUSIVE — nothing matched, but a query did not run:');
    for (const failure of verdict.failedQueries) console.log(`    ${failure}`);
    console.log('  Do not report this as "no charge". Fix the query and re-run.');
    break;
  case 'none':
    console.log('  NO MATCH on any query.');
    console.log('  This is the only result that supports "we have no charge from you" — and it');
    console.log('  is bounded by what was searched. Before saying it to a member:');
    console.log('    - ask for the statement DESCRIPTOR, amount and posted date;');
    console.log('    - re-run with --amount and --date from the statement, not from our records;');
    console.log('    - if they hold the card, re-run with --last4;');
    console.log('    - confirm this is the only Stripe account we bill on.');
    break;
}

// Leads outlive the verdict: "we took nothing from this card" and "somebody
// paid us that exact amount that day" are both true here, and the second is the
// thread worth pulling. A settled lead means the money is SOMEBODY'S — and if
// the member is holding a statement, the question is whether one of these is a
// second account of theirs.
const settledLeads = 'leads' in verdict ? verdict.leads : [];
if (settledLeads.length > 0) {
  console.log('');
  console.log(`  ${settledLeads.length} settled charge(s) matched the amount/date but NOT their card:`);
  for (const item of settledLeads) {
    console.log(
      `    ${isoOf(item.createdUnix)}  ${formatMinor(item.amountMinor, item.currency)}  ` +
        `card=${item.cardLabel ?? '—'}  ${item.localUserId ? `user=${item.localUserId}` : 'no local user'}  ${item.id}`,
    );
  }
  console.log('  These are other members until shown otherwise. To settle it, check each');
  console.log("  against the member's own statement — the card, and the date — then:");
  console.log('    make diagnose-user EMAIL=<the account that charge belongs to>');
  console.log('');
  console.log('  Times above are UTC; a statement date is the CARDHOLDER\'s local date. A');
  console.log('  charge late in the UTC day belongs to the previous day in the Americas, so');
  console.log('  convert before you rule one in or out — 00:10Z is 20:10 the evening before');
  console.log('  in US Eastern, and that one hour is the whole difference between the charge');
  console.log('  a member is describing and somebody else\'s.');
}
console.log('');
