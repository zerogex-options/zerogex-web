#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/send-foh-donation-reminder.mts \
//     [--to <email>] [--quarter <"Q3 2026">] [--dry-run]
//
// Fires the "time to make the FOH donation" email to the admin. Designed to
// be run four times a year via the systemd timer
// deploy/systemd/zerogex-web-foh-donation-reminder.timer, which fires on the
// 5th of Jan/Apr/Jul/Oct at 09:00 America/New_York — five days after each
// calendar quarter ends so Stripe revenue for the closing quarter has
// settled. The email is fully self-contained: the admin should be able to
// act on it without opening any docs or grep-ing the repo.
//
// The email contains:
//   1. Which quarter just closed (auto-detected from today, unless overridden)
//   2. The closing quarter's gross subscription revenue and the donation it
//      owes, computed from Stripe's ordinary invoice API (core/fohRevenue.ts).
//      Stripe Sigma would need a paid add-on. If Stripe can't be reached the
//      email still goes out, with the `make foh-revenue` command to run instead.
//   3. The tracked FOH donation URL
//   4. The exact `make quarterly-receipt` command to run afterward
//   5. A reminder about the tweet + badge attach step
//
// Env:
//   RESEND_API_KEY, RESEND_FROM_EMAIL  (required — sends the email)
//   STRIPE_SECRET_KEY                  (computes the donation; read-only)
//   FOH_REMINDER_EMAIL                 (default recipient; --to overrides)
//   NEXT_PUBLIC_APP_URL                (used for /giving link in the email)
//
// Flags:
//   --to <email>       Override recipient (defaults to FOH_REMINDER_EMAIL)
//   --quarter <label>  Override the auto-detected closing quarter
//   --dry-run          Print the email to stdout, don't send

import fs from 'node:fs';
import path from 'node:path';

import { Resend } from 'resend';
import Stripe from 'stripe';

import {
  closingQuarterFor,
  formatCents,
  formatQuarterRevenue,
  parseQuarterLabel,
  type Quarter,
  type QuarterRevenue,
} from '../core/fohRevenue.ts';
import { computeQuarterRevenue } from '../core/fohRevenueServer.ts';

// ── Env loading (matches other frontend/scripts/*.mts) ────────────────────────
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

const envFromFile = parseEnvFile(path.join(process.cwd(), '.env.local'));
for (const [k, v] of Object.entries(envFromFile)) {
  if (process.env[k] === undefined) process.env[k] = v;
}

// ── Args ──────────────────────────────────────────────────────────────────────
type Args = { to: string | null; quarter: string | null; dryRun: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { to: null, quarter: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--to': args.to = argv[++i]; break;
      case '--quarter': args.quarter = argv[++i]; break;
      case '--dry-run': args.dryRun = true; break;
      case '--help':
      case '-h':
        console.log(`Usage: node --experimental-strip-types --no-warnings \\
  scripts/send-foh-donation-reminder.mts \\
  [--to <email>] [--quarter <"Q3 2026">] [--dry-run]`);
        process.exit(0);
    }
  }
  return args;
}

// ── Email body ────────────────────────────────────────────────────────────────
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zerogex.io';
const FOH_DONATION_URL = 'https://foldsofhonorpartners.donorsupport.co/page/ZeroGEX';

function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// Step 1's content: the computed figure, or why it could not be computed.
type Step1 = { revenue: QuarterRevenue } | { error: string };

function manualCommand(q: Quarter): string {
  return `make foh-revenue QUARTER="${q.label}"`;
}

function step1Text(q: Quarter, step1: Step1): string[] {
  if ('revenue' in step1) {
    return [
      `Computed from Stripe's paid invoices for the quarter:`,
      ``,
      ...formatQuarterRevenue(step1.revenue),
      ``,
      `Re-check any time on the EC2 box with: ${manualCommand(q)}`,
    ];
  }
  return [
    `The donation could not be computed automatically (${step1.error}).`,
    `On the EC2 box, from ~/zerogex-web, run:`,
    ``,
    `  ${manualCommand(q)}`,
    ``,
    `It prints the quarter's revenue and the donation amount. Write it down.`,
  ];
}

function suggestedAmount(step1: Step1): string {
  return 'revenue' in step1 ? (step1.revenue.donationCents / 100).toFixed(2) : '<the donation from Step 1>';
}

function buildText(q: Quarter, step1: Step1): string {
  return [
    `${q.label} just closed. Time to make the Folds of Honor donation.`,
    ``,
    `Roughly 15 minutes end-to-end. Four steps:`,
    ``,
    `STEP 1 — The donation amount`,
    `───────────────────────────────────────────────────`,
    ...step1Text(q, step1),
    ``,
    `STEP 2 — Send the donation`,
    `───────────────────────────────────────────────────`,
    `Wire or use a card at the ZeroGEX-tracked partner page:`,
    ``,
    `  ${FOH_DONATION_URL}`,
    ``,
    `Save the receipt PDF that FOH emails you afterward.`,
    ``,
    `STEP 3 — Publish on the site (one command)`,
    `───────────────────────────────────────────────────`,
    `On the EC2 box, from ~/zerogex-web:`,
    ``,
    `  git checkout release && git pull`,
    `  make quarterly-receipt`,
    ``,
    `The interactive prompt will ask for the amount, quarter, and date. It`,
    `updates content/giving/totals.json, commits, pushes, rebuilds, and`,
    `prints the exact tweet you'll post in Step 4.`,
    ``,
    `Suggested inputs:`,
    `  Amount:  ${suggestedAmount(step1)}`,
    `  Quarter: ${q.label}`,
    `  Date:    today (default — just press Enter)`,
    ``,
    `STEP 4 — Post the tweet`,
    `───────────────────────────────────────────────────`,
    `The script from Step 3 prints the tweet text at the end. Copy it,`,
    `open X (@ZeroGEXOptions), attach the Folds of Honor Proud Supporter`,
    `badge image, and post.`,
    ``,
    `Badge PNG download: ${APP_URL}/folds-of-honor-proud-supporter.png`,
    ``,
    `───────────────────────────────────────────────────`,
    ``,
    `Full mechanics: ${APP_URL}/giving`,
    `Detailed walkthrough (if anything trips): docs/quarterly-receipt-workflow.md`,
    ``,
    `— send-foh-donation-reminder.mts (systemd timer: 5th of Jan/Apr/Jul/Oct, 09:00 ET)`,
  ].join('\n');
}

function buildHtml(q: Quarter, step1: Step1): string {
  const step1Html = 'revenue' in step1
    ? `<p style="margin: 0 0 8px;">Donation to send: <strong style="font-size: 18px;">${escapeHtml(formatCents(step1.revenue.donationCents))}</strong></p>
  <p style="margin: 0 0 8px; color: #555; font-size: 14px;">Computed from Stripe's paid invoices for the quarter:</p>
  <pre style="background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px 14px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.55; overflow: auto;">${escapeHtml(formatQuarterRevenue(step1.revenue).join('\n'))}</pre>
  <p style="margin: 8px 0 0; color: #555; font-size: 14px;">Re-check any time on the EC2 box with <code>${escapeHtml(manualCommand(q))}</code>.</p>`
    : `<p style="margin: 0 0 8px;">The donation could not be computed automatically (${escapeHtml(step1.error)}). On the EC2 box, from <code>~/zerogex-web</code>, run:</p>
  <pre style="background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px 14px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.55;">${escapeHtml(manualCommand(q))}</pre>
  <p style="margin: 8px 0 0; color: #555; font-size: 14px;">It prints the quarter's revenue and the donation amount. Write it down.</p>`;
  return `<!doctype html>
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 680px; margin: 0 auto; padding: 24px; line-height: 1.55;">
  <h1 style="margin: 0 0 8px; font-size: 24px;">${escapeHtml(q.label)} just closed — time to make the FOH donation</h1>
  <p style="color: #555; margin: 0 0 20px;">Roughly 15 minutes end-to-end. Four steps below. Nothing to remember and no docs to consult — everything you need is in this email.</p>

  <h2 style="font-size: 16px; margin: 28px 0 8px; color: #333;">Step 1 — The donation amount</h2>
  ${step1Html}

  <h2 style="font-size: 16px; margin: 28px 0 8px; color: #333;">Step 2 — Send the donation</h2>
  <p style="margin: 0;">Wire or use a card at the ZeroGEX-tracked partner page:</p>
  <p style="margin: 8px 0;"><a href="${escapeHtml(FOH_DONATION_URL)}" style="display: inline-block; padding: 10px 16px; background: #f5b400; color: #000; font-weight: 700; text-decoration: none; border-radius: 8px;">Open the ZeroGEX FOH partner page</a></p>
  <p style="margin: 8px 0 0; color: #555; font-size: 14px;">Save the receipt PDF that FOH emails you afterward.</p>

  <h2 style="font-size: 16px; margin: 28px 0 8px; color: #333;">Step 3 — Publish on the site (one command)</h2>
  <p style="margin: 0 0 8px;">On the EC2 box, from <code>~/zerogex-web</code>:</p>
  <pre style="background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px 14px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.55;">git checkout release &amp;&amp; git pull
make quarterly-receipt</pre>
  <p style="margin: 8px 0 0; color: #555; font-size: 14px;">
    Interactive. It'll ask for the amount, quarter, and date, then update
    content/giving/totals.json, commit, push, rebuild, and print the exact tweet
    for Step 4.
  </p>
  <p style="margin: 12px 0 0; color: #555; font-size: 14px;">
    Suggested inputs when prompted:
  </p>
  <ul style="margin: 4px 0 0 20px; padding: 0; color: #555; font-size: 14px; line-height: 1.6;">
    <li><strong>Amount:</strong> ${escapeHtml(suggestedAmount(step1))}</li>
    <li><strong>Quarter:</strong> <code>${escapeHtml(q.label)}</code></li>
    <li><strong>Date:</strong> today (default — press Enter)</li>
  </ul>

  <h2 style="font-size: 16px; margin: 28px 0 8px; color: #333;">Step 4 — Post the tweet</h2>
  <p style="margin: 0 0 8px;">
    Step 3 prints the tweet text at the end. Copy it, open X
    (<a href="https://x.com/ZeroGEXOptions" style="color: #1DA1F2;">@ZeroGEXOptions</a>),
    <strong>attach the Folds of Honor Proud Supporter badge</strong>, and post.
  </p>
  <p style="margin: 8px 0 0; color: #555; font-size: 14px;">
    Badge download:
    <a href="${escapeHtml(APP_URL + '/folds-of-honor-proud-supporter.png')}" style="color: #f5b400;">${escapeHtml(APP_URL + '/folds-of-honor-proud-supporter.png')}</a>
  </p>

  <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 32px 0 20px;">
  <p style="color: #888; font-size: 12px; margin: 0;">
    Full mechanics: <a href="${escapeHtml(APP_URL + '/giving')}" style="color: #888;">${escapeHtml(APP_URL)}/giving</a>.
    Detailed walkthrough if anything trips: <code>docs/quarterly-receipt-workflow.md</code>.
  </p>
  <p style="color: #888; font-size: 12px; margin: 8px 0 0;">
    Sent by scripts/send-foh-donation-reminder.mts (systemd timer: 5th of Jan/Apr/Jul/Oct, 14:00 UTC).
  </p>
</div>`;
}

// ── Step 1: compute the donation ─────────────────────────────────────────────
// Never fatal: the reminder is worth sending even when Stripe is unreachable,
// so a failure becomes the manual-command fallback in the email. Capped well
// inside the service's TimeoutStartSec so the email still goes out.
const STRIPE_BUDGET_MS = 60_000;

async function computeStep1(q: Quarter): Promise<Step1> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: 'STRIPE_SECRET_KEY is not set' };
  try {
    const totals = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'content', 'giving', 'totals.json'), 'utf8'),
    ) as { pledgePct: number };
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Stripe did not answer within ${STRIPE_BUDGET_MS / 1000}s`)), STRIPE_BUDGET_MS);
    });
    try {
      const revenue = await Promise.race([
        computeQuarterRevenue(new Stripe(key, { timeout: 30_000 }), q, totals.pledgePct),
        timeout,
      ]);
      return { revenue };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Could not compute the donation from Stripe: ${message}`);
    return { error: message };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));

  const to = args.to ?? process.env.FOH_REMINDER_EMAIL;
  if (!to) {
    console.error('No recipient. Pass --to <email> or set FOH_REMINDER_EMAIL in the environment.');
    process.exit(1);
  }

  const quarter = args.quarter ? parseQuarterLabel(args.quarter) : closingQuarterFor(new Date());
  const step1 = await computeStep1(quarter);
  const subject = 'revenue' in step1
    ? `[ZeroGEX] ${quarter.label} closed — FOH donation due: ${formatCents(step1.revenue.donationCents)}`
    : `[ZeroGEX] ${quarter.label} closed — time to make the FOH donation`;
  const text = buildText(quarter, step1);
  const html = buildHtml(quarter, step1);

  if (args.dryRun) {
    console.log(`=== TO: ${to}`);
    console.log(`=== SUBJECT: ${subject}`);
    console.log(`=== BODY (text):`);
    console.log(text);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddr = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromAddr) {
    console.error('Missing required env: RESEND_API_KEY and RESEND_FROM_EMAIL.');
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({ from: fromAddr, to, subject, text, html });
  if (result.error) {
    console.error(`Resend error: ${result.error.message}`);
    process.exit(1);
  }
  console.log(`Reminder sent to ${to} (${quarter.label}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
