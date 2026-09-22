#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/money-back-refund.mts \
//     --email <addr> [--reason <feedback>] [--comment "..."] [--force] [--dry-run | --yes]
//
// Honor a 7-day money-back guarantee request that arrived by EMAIL rather than
// through the Account page — or finish one the Account page started and could
// not complete (the operator alert names this command).
//
// It runs the SAME code path as the Account page (core/moneyBackServer.ts), so
// everything the self-serve flow guarantees holds here too:
//   • every rule is re-checked live against Stripe (the covered plan, the 7-day
//     window, the one-refund-per-customer limit on account / email / card);
//   • the refund is FULL, carries a Stripe idempotency key per invoice, and a
//     re-run resumes an unfinished request instead of refunding twice;
//   • the subscription is canceled immediately, access ends, API keys are
//     revoked, the member gets the refund confirmation email and the refund is
//     recorded in the ledger — so it counts as their one refund.
//
// Refund by hand in the Stripe Dashboard instead and NONE of that happens: the
// member keeps access until the webhook catches up, and the ledger never learns
// the guarantee was used. Prefer this.
//
// --force honors a request outside the 7-day window or past the one-refund
// limit (a goodwill refund). It does not bypass anything else.
//
// Dry run by default: prints what the member is eligible for and changes
// nothing. --yes applies. Reads .env.local like every other script.

import { loadEnvLocal, warnIfPricesUnconfigured } from './env-local.mts';

type Args = {
  email: string | null;
  reason: string | null;
  comment: string | null;
  force: boolean;
  dryRun: boolean;
  yes: boolean;
  help: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { email: null, reason: null, comment: null, force: false, dryRun: false, yes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--reason') args.reason = (argv[++i] ?? '').trim() || null;
    else if (arg === '--comment') args.comment = (argv[++i] ?? '').trim() || null;
    else if (arg === '--force') args.force = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.email) {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/money-back-refund.mts \\
    --email <addr> [--reason <feedback>] [--comment "..."] [--force] [--dry-run | --yes]

  --reason   one of: too_expensive, missing_features, switched_service, unused,
             customer_service, too_complex, low_quality, other
  --force    honor it outside the 7-day window / past the one-refund limit
  --yes      apply (default is a dry run that changes nothing)`);
  process.exit(args.help ? 0 : 1);
}
if (args.dryRun && args.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}

loadEnvLocal();
warnIfPricesUnconfigured();

// Imported after the env is loaded: core/stripe.ts builds its price table at
// module load, and core/db.ts reads AUTH_DB_PATH on first use.
const { getDb } = await import('../core/db.ts');
const { getMoneyBackStatus, requestMoneyBackRefund } = await import('../core/moneyBackServer.ts');

const user = getDb()
  .prepare('SELECT id, email, tier, stripe_subscription_id FROM users WHERE email = ? AND deleted_at IS NULL')
  .get(args.email) as { id: string; email: string; tier: string; stripe_subscription_id: string | null } | undefined;
if (!user) {
  console.error(`No active account for ${args.email}.`);
  process.exit(1);
}

console.log(`Member:        ${user.email} (tier=${user.tier}, sub=${user.stripe_subscription_id ?? 'none'})`);
const status = await getMoneyBackStatus(user.id);
if (status.state === 'eligible') {
  console.log(`Guarantee:     ELIGIBLE — ${status.amountFormatted} on ${status.planLabel}, window closes ${status.deadlineIso}`);
} else if (status.state === 'unfinished') {
  console.log(`Guarantee:     an earlier request on ${status.subscriptionId} did not finish — --yes resumes it`);
} else {
  console.log(`Guarantee:     not eligible (${status.reason})${status.deadlineIso ? `, window closed ${status.deadlineIso}` : ''}`);
  if (!args.force) {
    console.log(args.yes ? '\nNothing done. Pass --force to honor it anyway (goodwill refund).' : '');
    process.exit(args.yes ? 1 : 0);
  }
  console.log('               --force: honoring it anyway.');
}

if (!args.yes) {
  console.log('\n[dry run] Nothing refunded or canceled. Re-run with --yes to apply.');
  process.exit(0);
}

const result = await requestMoneyBackRefund({
  userId: user.id,
  source: 'operator',
  feedback: args.reason,
  comment: args.comment,
  ip: 'operator-script',
  overrideLimits: args.force,
});

if (!result.ok) {
  console.error(`\nRefused (${result.reason}): ${result.message}`);
  process.exit(1);
}
console.log(`\nRefunded ${result.amountFormatted} [${result.refundIds.join(', ') || 'no new refund'}]`);
console.log(result.canceled ? 'Subscription canceled; access removed.' : 'Subscription NOT canceled — see below.');
for (const problem of result.problems) console.log(`  ! ${problem}`);
process.exit(result.canceled ? 0 : 2);
