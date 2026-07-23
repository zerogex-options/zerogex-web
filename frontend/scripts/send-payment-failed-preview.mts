#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-payment-failed-preview.mts \
//     --to <email> [--final] [--no-card] [--no-amount] \
//     [--amount <label>] [--brand <Brand>] [--last4 <NNNN>] [--next <ISO>]
//
// Renders the payment-failed dunning email (core/mailer.ts
// sendPaymentFailedEmail) with representative sample data and sends ONE copy to
// --to, so the live copy can be eyeballed before/after a deploy. That email is
// otherwise webhook-only — fired from invoice.payment_failed (attempt 1) with no
// batch/cron path — so this script exists purely for previewing and touches
// neither the DB nor Stripe; every value is sample data (all overridable).
//
// Variants worth checking:
//   (default)    amount + named card + a scheduled next-retry date
//   --final      Stripe's retries exhausted (no next-retry date; cancel imminent)
//   --no-card    the neutral "declined by your card issuer" fallback
//
// Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL from env or
// .env.local (same resolution as the other mailer scripts).

import fs from 'node:fs';
import path from 'node:path';
import { sendPaymentFailedEmail } from '../core/mailer.ts';

type Args = {
  to: string | null;
  amount: string | null;
  brand: string | null;
  last4: string | null;
  nextIso: string | null;
  final: boolean;
  noCard: boolean;
  noAmount: boolean;
  help: boolean;
};

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
    // Match Next.js's dotenv loader: strip a matched pair of surrounding quotes
    // so RESEND_FROM_EMAIL="ZeroGEX <hello@zerogex.com>" stays a valid header.
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

function parseArgs(argv: string[]): Args {
  const args: Args = {
    to: null,
    amount: null,
    brand: null,
    last4: null,
    nextIso: null,
    final: false,
    noCard: false,
    noAmount: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--to' || arg === '--preview-to') args.to = argv[++i] ?? null;
    else if (arg === '--amount') args.amount = argv[++i] ?? null;
    else if (arg === '--brand') args.brand = argv[++i] ?? null;
    else if (arg === '--last4') args.last4 = argv[++i] ?? null;
    else if (arg === '--next') args.nextIso = argv[++i] ?? null;
    else if (arg === '--final') args.final = true;
    else if (arg === '--no-card') args.noCard = true;
    else if (arg === '--no-amount') args.noAmount = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-payment-failed-preview.mts \\
    --to <email> [--final] [--no-card] [--no-amount] \\
    [--amount <label>] [--brand <Brand>] [--last4 <NNNN>] [--next <ISO>]

Renders the payment-failed dunning email and sends ONE sample copy to --to.
No DB or Stripe access; every value is sample data (overridable).

Options:
      --to <email>        Recipient for the sample (required). --preview-to also works.
      --final             Preview the exhausted-retries variant (no next-retry date).
      --no-card           Preview the neutral "declined by your card issuer" fallback.
      --no-amount         Drop the dollar amount from the copy.
      --amount <label>    Override the charge label (default "$59.00").
      --brand <Brand>     Override the display card brand (default "Mastercard").
      --last4 <NNNN>      Override the last four (default "6284").
      --next <ISO>        Override the next-retry timestamp (default ~3 days out).
  -h, --help              Show this help.

Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL from env or .env.local.`);
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
}
if (!cliArgs.to) {
  console.error('Error: --to <email> is required.');
  usage();
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));

const RESEND_API_KEY = process.env.RESEND_API_KEY || envLocal.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || envLocal.RESEND_FROM_EMAIL;
const NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || '';

if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
  console.error('Error: RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send emails.');
  process.exit(1);
}

// mailer.ts reads these lazily inside getClient()/getFromAddress()/getAppUrl(),
// so stuffing them into process.env after the static import is correct.
process.env.RESEND_API_KEY = RESEND_API_KEY;
process.env.RESEND_FROM_EMAIL = RESEND_FROM_EMAIL;
if (NEXT_PUBLIC_APP_URL) process.env.NEXT_PUBLIC_APP_URL = NEXT_PUBLIC_APP_URL;

const amountFormatted = cliArgs.noAmount ? null : cliArgs.amount ?? '$59.00';
const cardBrand = cliArgs.noCard ? null : cliArgs.brand ?? 'Mastercard';
const cardLast4 = cliArgs.noCard ? null : cliArgs.last4 ?? '6284';
// A real send passes invoice.next_payment_attempt; ~3 days out is representative
// of a mid-dunning retry. --final drops it to preview the "retries exhausted" copy.
const nextAttemptIso = cliArgs.final
  ? null
  : cliArgs.nextIso ?? new Date(Date.now() + 3 * 86400_000).toISOString();

const variant = cliArgs.final ? 'final-attempt' : 'retry-scheduled';
console.log(`Sending payment-failed preview (${variant}) to ${cliArgs.to}...`);

await sendPaymentFailedEmail(cliArgs.to, {
  amountFormatted,
  cardBrand,
  cardLast4,
  nextAttemptIso,
});

console.log('Preview sent.');
