#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-payment-recovered.mts --to you@example.com
//
// Sends ONE copy of the payment-recovered confirmation email (core/mailer.ts
// sendPaymentRecoveredEmail) to a single address. No DB reads or writes and no
// latch is touched — this is purely for previewing the email in a real inbox or
// for a manual re-send to a customer whose automatic recovery email bounced.
//
// The automatic send is driven by the Stripe webhook on the past_due -> active
// recovery (app/api/webhooks/stripe/route.ts); this script is the manual
// counterpart, mirroring scripts/send-welcome-email.* for the welcome path.
//
// Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL from env or from
// frontend/.env.local. NEXT_PUBLIC_APP_URL sets the host used for the dashboard
// CTA and the Folds-of-Honor footer links (defaults to http://localhost:3000).

import fs from 'node:fs';
import path from 'node:path';

import { sendPaymentRecoveredEmail } from '../core/mailer.ts';

type Args = { to: string | null; help: boolean };

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

function parseArgs(argv: string[]): Args {
  const args: Args = { to: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--to') args.to = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (!arg.startsWith('-') && !args.to) args.to = arg; // allow a bare positional email
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-payment-recovered.mts --to <email>

Sends one copy of the payment-recovered confirmation email to <email>. No DB
reads or writes. Intended for previewing the email in a real inbox or for a
manual re-send.

Options:
      --to <email>   Recipient address (a bare positional email also works).
  -h, --help         Show this help.

Reads RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL from env or
frontend/.env.local.`);
}

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  usage();
  process.exit(0);
}

if (!cliArgs.to || !cliArgs.to.includes('@')) {
  console.error('Error: a recipient is required, e.g. --to you@example.com');
  console.error('Run with --help for usage.');
  process.exit(1);
}

const envLocal = parseEnvFile(path.join(process.cwd(), '.env.local'));

const RESEND_API_KEY = process.env.RESEND_API_KEY || envLocal.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || envLocal.RESEND_FROM_EMAIL;
const NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || '';

if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
  console.error('Error: RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send email.');
  console.error('Set them in your shell env or in frontend/.env.local.');
  process.exit(1);
}

if (RESEND_API_KEY) process.env.RESEND_API_KEY = RESEND_API_KEY;
if (RESEND_FROM_EMAIL) process.env.RESEND_FROM_EMAIL = RESEND_FROM_EMAIL;
if (NEXT_PUBLIC_APP_URL) process.env.NEXT_PUBLIC_APP_URL = NEXT_PUBLIC_APP_URL;

console.log(`Sending payment-recovered email to ${cliArgs.to} ...`);
try {
  await sendPaymentRecoveredEmail(cliArgs.to);
  console.log('Sent.');
  process.exit(0);
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Send failed: ${message}`);
  process.exit(1);
}
