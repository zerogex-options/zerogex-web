#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/quarterly-receipt-draft.mts \
//     --amount <usd> --quarter <"Q3 2026"> --date <YYYY-MM-DD> [--email <addr>]
//
// Semi-automated quarterly Folds of Honor receipt post — generates the
// review-ready drafts we want to publish once each quarter's donation clears,
// but never posts anything itself. The workflow:
//
//   1. Founder makes the actual bank transfer to Folds of Honor (out of band).
//   2. Founder runs this script with the amount + date + quarter label.
//   3. Script computes updated running totals, generates the tweet draft +
//      updated content/giving/totals.json + a friendly email summary, and
//      (optionally) emails all of it to the founder's inbox for review.
//   4. Founder reviews. When happy: post the tweet on X, replace
//      content/giving/totals.json with the printed version, commit, deploy.
//
// Explicit non-goals:
//   - No auto-posting to X. Every post goes through founder review first.
//   - No auto-commit of totals.json. The write goes to totals.next.json
//     (a review file) or stdout only, so the human has to eyeball the diff.
//   - No Stripe query. The donation amount is whatever the founder actually
//     sent to FOH — inputting it by hand is faster and less error-prone than
//     re-computing 3% of gross from Stripe invoices for a boundary window.
//
// Args:
//   --amount <usd>       (required) Donation amount in USD, e.g. 1247.50
//   --quarter <label>    (required) Quarter label, e.g. "Q3 2026"
//   --date <YYYY-MM-DD>  (required) Donation date in ISO date form
//   --email <address>    (optional) Send a summary email with the drafts
//   --write-totals       (optional) Write the updated totals to
//                                   content/giving/totals.next.json for review
//   --dry-run            (optional) Print only; skip email + write

import fs from 'node:fs';
import path from 'node:path';

import { Resend } from 'resend';

type Donation = {
  amountUsd: number;
  donatedAtIso: string;
  quarter: string;
  receiptUrl?: string;
};

type Totals = {
  totalDonatedUsd: number;
  donationsCount: number;
  lastDonation: Donation | null;
  nextDonationAtIso: string | null;
  pledgePct: number;
  partner: string;
  history: Donation[];
};

type Args = {
  amount: number | null;
  quarter: string | null;
  date: string | null;
  email: string | null;
  writeTotals: boolean;
  dryRun: boolean;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zerogex.io';
const TWITTER_HANDLE = '@ZeroGEXOptions';
const FOH_HANDLE = '@FoldsOfHonor';

function parseArgs(argv: string[]): Args {
  const args: Args = {
    amount: null,
    quarter: null,
    date: null,
    email: null,
    writeTotals: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--amount': args.amount = Number(argv[++i]); break;
      case '--quarter': args.quarter = argv[++i]; break;
      case '--date': args.date = argv[++i]; break;
      case '--email': args.email = argv[++i]; break;
      case '--write-totals': args.writeTotals = true; break;
      case '--dry-run': args.dryRun = true; break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
    }
  }
  return args;
}

function printUsage() {
  console.log(`Usage: node --experimental-strip-types --no-warnings \\
  scripts/quarterly-receipt-draft.mts \\
  --amount <usd> --quarter <"Q3 2026"> --date <YYYY-MM-DD> \\
  [--email <addr>] [--write-totals] [--dry-run]`);
}

function nextQuarterEndIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const nextQuarterFirstMonth = Math.floor(m / 3) * 3 + 3;
  const yearAdj = nextQuarterFirstMonth >= 12 ? y + 1 : y;
  const monthAdj = nextQuarterFirstMonth % 12;
  const lastDayOfQuarterEndMonth = new Date(Date.UTC(yearAdj, monthAdj + 3, 0));
  return lastDayOfQuarterEndMonth.toISOString().slice(0, 10);
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function formatUsdWhole(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

function buildUpdatedTotals(current: Totals, donation: Donation): Totals {
  return {
    ...current,
    totalDonatedUsd: Number((current.totalDonatedUsd + donation.amountUsd).toFixed(2)),
    donationsCount: current.donationsCount + 1,
    lastDonation: donation,
    nextDonationAtIso: nextQuarterEndIso(new Date(donation.donatedAtIso)),
    history: [donation, ...current.history],
  };
}

function buildTweet(donation: Donation, updated: Totals): string {
  return [
    `Quarterly receipt: ZeroGEX just sent ${formatUsdWhole(donation.amountUsd)} to ${FOH_HANDLE} — the ${donation.quarter} donation from your subscriptions.`,
    ``,
    `Total donated to date: ${formatUsdWhole(updated.totalDonatedUsd)}.`,
    ``,
    `Full ledger and FAQ: ${APP_URL}/giving`,
    ``,
    `Thank you.`,
  ].join('\n');
}

function buildEmailText(args: {
  donation: Donation;
  current: Totals;
  updated: Totals;
  tweet: string;
}): string {
  return [
    `Draft quarterly-receipt post — ready for your review.`,
    ``,
    `DONATION`,
    `  Amount:   ${formatUsd(args.donation.amountUsd)}`,
    `  Quarter:  ${args.donation.quarter}`,
    `  Date:     ${formatDate(args.donation.donatedAtIso)}`,
    ``,
    `RUNNING TOTALS`,
    `  Before:   ${formatUsd(args.current.totalDonatedUsd)} (${args.current.donationsCount} donations)`,
    `  After:    ${formatUsd(args.updated.totalDonatedUsd)} (${args.updated.donationsCount} donations)`,
    `  Next due: ${args.updated.nextDonationAtIso ?? '—'}`,
    ``,
    `TWEET DRAFT — copy/paste to X, attach the FOH badge image before posting:`,
    `───────────────────────────────────────────────────`,
    args.tweet,
    `───────────────────────────────────────────────────`,
    ``,
    `CONTENT/GIVING/TOTALS.JSON — replace with this to update the /giving page:`,
    `───────────────────────────────────────────────────`,
    JSON.stringify(args.updated, null, 2),
    `───────────────────────────────────────────────────`,
    ``,
    `Next steps when you're happy with the drafts:`,
    `  1. Post the tweet on X (with the Proud Supporter badge attached).`,
    `  2. Replace frontend/content/giving/totals.json with the JSON above.`,
    `  3. Commit + push to release. On the server: make rebuild.`,
    `  4. Optional: post a matching update to /articles.`,
    ``,
    `— quarterly-receipt-draft.mts`,
  ].join('\n');
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildEmailHtml(args: {
  donation: Donation;
  current: Totals;
  updated: Totals;
  tweet: string;
}): string {
  return `<!doctype html>
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 640px; margin: 0 auto; padding: 24px; line-height: 1.5;">
  <h2 style="margin: 0 0 8px; font-size: 20px;">Draft quarterly-receipt post — ready for your review</h2>
  <p style="color: #555;">Nothing has been posted or committed. Review the drafts below, then post the tweet on X and replace <code>content/giving/totals.json</code> with the JSON block.</p>

  <h3 style="margin: 24px 0 8px; font-size: 15px; color: #333;">This donation</h3>
  <table style="border-collapse: collapse; font-size: 14px;">
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Amount</td><td><strong>${escapeHtml(formatUsd(args.donation.amountUsd))}</strong></td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Quarter</td><td>${escapeHtml(args.donation.quarter)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Date</td><td>${escapeHtml(formatDate(args.donation.donatedAtIso))}</td></tr>
  </table>

  <h3 style="margin: 24px 0 8px; font-size: 15px; color: #333;">Running totals</h3>
  <table style="border-collapse: collapse; font-size: 14px;">
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Before</td><td>${escapeHtml(formatUsd(args.current.totalDonatedUsd))} · ${args.current.donationsCount} donations</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">After</td><td><strong>${escapeHtml(formatUsd(args.updated.totalDonatedUsd))} · ${args.updated.donationsCount} donations</strong></td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Next donation</td><td>${escapeHtml(args.updated.nextDonationAtIso ?? '—')}</td></tr>
  </table>

  <h3 style="margin: 24px 0 8px; font-size: 15px; color: #333;">Tweet draft</h3>
  <p style="color: #666; font-size: 13px; margin: 0 0 8px;">Copy and paste to X. Attach the Folds of Honor Proud Supporter badge image before posting.</p>
  <pre style="background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px 16px; white-space: pre-wrap; font-size: 13px; line-height: 1.55;">${escapeHtml(args.tweet)}</pre>

  <h3 style="margin: 24px 0 8px; font-size: 15px; color: #333;">Updated totals.json</h3>
  <p style="color: #666; font-size: 13px; margin: 0 0 8px;">Replace <code>frontend/content/giving/totals.json</code> with this block, commit, push, redeploy.</p>
  <pre style="background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px 16px; white-space: pre-wrap; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5;">${escapeHtml(JSON.stringify(args.updated, null, 2))}</pre>

  <p style="color: #888; font-size: 12px; margin-top: 24px;">Generated by scripts/quarterly-receipt-draft.mts</p>
</div>`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const missing: string[] = [];
  if (args.amount === null || Number.isNaN(args.amount) || args.amount <= 0) missing.push('--amount');
  if (!args.quarter) missing.push('--quarter');
  if (!args.date) missing.push('--date');
  if (missing.length) {
    console.error(`Missing required args: ${missing.join(', ')}`);
    printUsage();
    process.exit(1);
  }

  const dateIso = new Date(args.date!).toISOString();
  const totalsPath = path.join(process.cwd(), 'content/giving/totals.json');
  const current = JSON.parse(fs.readFileSync(totalsPath, 'utf8')) as Totals;

  const donation: Donation = {
    amountUsd: Number(args.amount!.toFixed(2)),
    donatedAtIso: dateIso,
    quarter: args.quarter!,
  };

  const updated = buildUpdatedTotals(current, donation);
  const tweet = buildTweet(donation, updated);
  const emailText = buildEmailText({ donation, current, updated, tweet });
  const emailHtml = buildEmailHtml({ donation, current, updated, tweet });

  console.log(emailText);

  if (args.dryRun) return;

  if (args.writeTotals) {
    const nextPath = path.join(process.cwd(), 'content/giving/totals.next.json');
    fs.writeFileSync(nextPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    console.log(`\n[wrote review file] ${nextPath}`);
  }

  if (args.email) {
    const apiKey = process.env.RESEND_API_KEY;
    const fromAddr = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !fromAddr) {
      console.error('\n[email skipped] RESEND_API_KEY or RESEND_FROM_EMAIL not set.');
      return;
    }
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromAddr,
      to: args.email,
      subject: `[ZeroGEX] ${donation.quarter} FOH donation — draft receipt ready for review`,
      text: emailText,
      html: emailHtml,
    });
    if (result.error) {
      console.error(`\n[email failed] ${result.error.message}`);
      process.exitCode = 1;
      return;
    }
    console.log(`\n[email sent] ${args.email}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
