#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22), or via `make quarterly-receipt`:
//   node --experimental-strip-types --no-warnings scripts/quarterly-receipt.mts \
//     [--amount <usd>] [--quarter <"Q3 2026">] [--date <YYYY-MM-DD>] \
//     [--email <addr>] [--no-push] [--no-rebuild] [--yes] [--dry-run]
//
// End-to-end quarterly Folds of Honor receipt workflow — interactive by
// default. Prompts for anything not passed via flags, then walks the full
// publish loop in one command:
//
//   1. Read content/giving/totals.json
//   2. Compute updated totals with the new donation applied
//   3. Show a summary + tweet draft + git plan
//   4. Ask for confirmation
//   5. Write totals.json
//   6. git add + commit + push
//   7. make rebuild (optional; confirms before running)
//   8. Optionally email the tweet draft to you for review
//   9. Print the tweet copy for you to paste into X
//
// Safety rails:
//   - Refuses to run on a dirty working tree (unrelated changes would get
//     bundled into the donation commit).
//   - Refuses to run outside the `release` branch (the deploy branch).
//   - Never posts to X. The tweet is printed for you to copy — no OAuth
//     complexity, no risk of a bot posting something you'd want to edit
//     first.
//   - --dry-run stops before any file/git/rebuild action.
//
// Flags:
//   --amount <usd>       Donation amount (interactive prompt if omitted)
//   --quarter <label>    Quarter label like "Q3 2026" (auto-suggests
//                        previous calendar quarter if omitted)
//   --date <YYYY-MM-DD>  Donation date (defaults to today)
//   --email <addr>       Also email the tweet draft here for review
//   --no-push            Commit locally, don't push
//   --no-rebuild         Skip `make rebuild`
//   --yes                Skip the "Proceed?" confirmation (still shows the
//                        summary first)
//   --dry-run            Print the summary and stop — no file/git changes

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

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
  push: boolean;
  rebuild: boolean;
  yes: boolean;
  dryRun: boolean;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zerogex.io';
const FOH_HANDLE = '@FoldsOfHonor';
const DEPLOY_BRANCH = 'release';

// ── Args parsing ──────────────────────────────────────────────────────────────
function parseArgs(argv: string[]): Args {
  const args: Args = {
    amount: null,
    quarter: null,
    date: null,
    email: null,
    push: true,
    rebuild: true,
    yes: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--amount': args.amount = Number(argv[++i]); break;
      case '--quarter': args.quarter = argv[++i]; break;
      case '--date': args.date = argv[++i]; break;
      case '--email': args.email = argv[++i]; break;
      case '--no-push': args.push = false; break;
      case '--no-rebuild': args.rebuild = false; break;
      case '--yes': case '-y': args.yes = true; break;
      case '--dry-run': args.dryRun = true; break;
      case '--help': case '-h': printUsage(); process.exit(0);
    }
  }
  return args;
}

function printUsage() {
  console.log(`Usage: node --experimental-strip-types --no-warnings \\
  scripts/quarterly-receipt.mts \\
  [--amount <usd>] [--quarter <"Q3 2026">] [--date <YYYY-MM-DD>] \\
  [--email <addr>] [--no-push] [--no-rebuild] [--yes] [--dry-run]

Interactive by default — prompts for anything not passed via flags.`);
}

// ── Date + formatting helpers ─────────────────────────────────────────────────
function previousQuarterLabel(now: Date): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const quarter = Math.floor(m / 3);
  if (quarter === 0) return `Q4 ${y - 1}`;
  return `Q${quarter} ${y}`;
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidDateIso(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}

// ── Domain logic ──────────────────────────────────────────────────────────────
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

// ── Git helpers ───────────────────────────────────────────────────────────────
function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function currentBranch(): string {
  return git('rev-parse', '--abbrev-ref', 'HEAD');
}

function isDirty(): boolean {
  return git('status', '--porcelain').length > 0;
}

// ── Interactive prompts ───────────────────────────────────────────────────────
async function promptMissing(args: Args): Promise<{
  amount: number; quarter: string; date: string;
}> {
  if (args.amount !== null && !Number.isNaN(args.amount) && args.amount > 0 &&
      args.quarter && args.date && isValidDateIso(args.date)) {
    return { amount: args.amount, quarter: args.quarter, date: args.date };
  }

  if (!input.isTTY) {
    throw new Error('Non-interactive shell without required flags. Pass --amount, --quarter, and --date.');
  }

  const rl = readline.createInterface({ input, output });
  try {
    let amount = args.amount;
    while (amount === null || Number.isNaN(amount) || amount <= 0) {
      const raw = (await rl.question('Donation amount in USD (e.g. 1247.50): ')).trim();
      const parsed = Number(raw.replace(/[$,]/g, ''));
      if (!Number.isNaN(parsed) && parsed > 0) amount = parsed;
      else console.error('  └─ Enter a positive number.');
    }

    const suggestedQuarter = previousQuarterLabel(new Date());
    let quarter = args.quarter;
    while (!quarter) {
      const raw = (await rl.question(`Quarter label [${suggestedQuarter}]: `)).trim();
      quarter = raw || suggestedQuarter;
    }

    let dateStr = args.date;
    while (!dateStr || !isValidDateIso(dateStr)) {
      const raw = (await rl.question(`Donation date YYYY-MM-DD [${todayIso()}]: `)).trim();
      const candidate = raw || todayIso();
      if (isValidDateIso(candidate)) dateStr = candidate;
      else console.error('  └─ Format is YYYY-MM-DD (e.g. 2026-09-30).');
    }

    return { amount, quarter, date: dateStr };
  } finally {
    rl.close();
  }
}

async function confirm(question: string, defaultYes: boolean): Promise<boolean> {
  if (!input.isTTY) return defaultYes;
  const rl = readline.createInterface({ input, output });
  try {
    const suffix = defaultYes ? '[Y/n]' : '[y/N]';
    const raw = (await rl.question(`${question} ${suffix} `)).trim().toLowerCase();
    if (raw === '') return defaultYes;
    return raw === 'y' || raw === 'yes';
  } finally {
    rl.close();
  }
}

// ── Optional email of the tweet draft ─────────────────────────────────────────
async function emailTweetDraft(to: string, updated: Totals, tweet: string, quarter: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddr = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromAddr) {
    console.error('  └─ [email skipped] RESEND_API_KEY or RESEND_FROM_EMAIL not set.');
    return;
  }
  const resend = new Resend(apiKey);
  const subject = `[ZeroGEX] ${quarter} FOH donation — tweet ready to post`;
  const text = [
    `The site has been updated: /giving now shows ${formatUsd(updated.totalDonatedUsd)} donated to date.`,
    ``,
    `Copy the tweet below and paste into X. Attach the Folds of Honor Proud Supporter badge before posting.`,
    ``,
    `───────────────────────────────────────────────────`,
    tweet,
    `───────────────────────────────────────────────────`,
  ].join('\n');
  const escape = (v: string) => v.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 640px; margin: 0 auto; padding: 24px; line-height: 1.5;">
    <h2 style="margin: 0 0 8px; font-size: 20px;">Tweet ready to post</h2>
    <p>The site has been updated: <strong>${APP_URL}/giving</strong> now shows <strong>${escape(formatUsd(updated.totalDonatedUsd))}</strong> donated to date.</p>
    <p>Copy the tweet below and paste into X. Attach the Folds of Honor Proud Supporter badge before posting.</p>
    <pre style="background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px 16px; white-space: pre-wrap; font-size: 13px; line-height: 1.55;">${escape(tweet)}</pre>
    <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent by scripts/quarterly-receipt.mts</p>
  </div>`;
  const result = await resend.emails.send({ from: fromAddr, to, subject, text, html });
  if (result.error) {
    console.error(`  └─ [email failed] ${result.error.message}`);
    return;
  }
  console.log(`  └─ [email sent] ${to}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Repo state guards — bail early before any prompts if the repo isn't in a
  // shape we can safely mutate.
  const repoRoot = git('rev-parse', '--show-toplevel');
  process.chdir(repoRoot);

  const totalsPath = path.join('frontend', 'content', 'giving', 'totals.json');
  if (!fs.existsSync(totalsPath)) {
    console.error(`Cannot find ${totalsPath}. Are you inside the zerogex-web repo?`);
    process.exit(1);
  }

  if (!args.dryRun) {
    const branch = currentBranch();
    if (branch !== DEPLOY_BRANCH) {
      console.error(`Refusing to run on branch "${branch}". This script commits to "${DEPLOY_BRANCH}" only.`);
      console.error(`Switch first:  git checkout ${DEPLOY_BRANCH} && git pull`);
      process.exit(1);
    }
    if (isDirty()) {
      console.error(`Refusing to run: working tree has uncommitted changes. Stash or commit them first.`);
      console.error(`(This script commits totals.json only — mixing in unrelated edits would muddy the receipt commit.)`);
      process.exit(1);
    }
  }

  // Collect inputs.
  const { amount, quarter, date } = await promptMissing(args);
  const dateIso = new Date(date).toISOString();
  const current = JSON.parse(fs.readFileSync(totalsPath, 'utf8')) as Totals;
  const donation: Donation = { amountUsd: Number(amount.toFixed(2)), donatedAtIso: dateIso, quarter };
  const updated = buildUpdatedTotals(current, donation);
  const tweet = buildTweet(donation, updated);

  // Summary.
  console.log('');
  console.log('Summary of what will happen:');
  console.log(`  1. Update ${totalsPath}`);
  console.log(`     - totalDonatedUsd: ${formatUsd(current.totalDonatedUsd)} → ${formatUsd(updated.totalDonatedUsd)}`);
  console.log(`     - donationsCount: ${current.donationsCount} → ${updated.donationsCount}`);
  console.log(`     - lastDonation:   ${current.lastDonation ? `${current.lastDonation.quarter} · ${formatUsd(current.lastDonation.amountUsd)}` : '(none)'} → ${donation.quarter} · ${formatUsd(donation.amountUsd)}`);
  console.log(`     - nextDonation:   ${current.nextDonationAtIso ?? '(none)'} → ${updated.nextDonationAtIso}`);
  console.log(`  2. git add ${totalsPath}`);
  console.log(`  3. git commit -m "chore(giving): record ${donation.quarter} donation to Folds of Honor"`);
  if (args.push) console.log(`  4. git push origin ${DEPLOY_BRANCH}`);
  else console.log(`  4. git push          (skipped — --no-push)`);
  if (args.rebuild) console.log(`  5. make rebuild      (optional; will confirm before running)`);
  else console.log(`  5. make rebuild      (skipped — --no-rebuild)`);
  console.log('');
  console.log('Tweet draft (posted manually on X after this completes):');
  console.log('──────────────────────────────────────────────────');
  console.log(tweet);
  console.log('──────────────────────────────────────────────────');
  console.log('');

  if (args.dryRun) {
    console.log('[--dry-run] No files, git, or rebuild actions taken.');
    return;
  }

  const proceed = args.yes || (await confirm('Proceed with all of the above?', false));
  if (!proceed) {
    console.log('Aborted. No changes made.');
    return;
  }

  // [1] Write totals.json.
  process.stdout.write('[1/5] Writing totals.json...    ');
  fs.writeFileSync(totalsPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  console.log('✓');

  // [2] git add + commit.
  process.stdout.write('[2/5] Staging + committing...   ');
  execFileSync('git', ['add', totalsPath]);
  execFileSync('git', [
    'commit',
    '-m', `chore(giving): record ${donation.quarter} donation to Folds of Honor`,
    '-m', `Amount: ${formatUsd(donation.amountUsd)}. Total donated to date: ${formatUsd(updated.totalDonatedUsd)}.\n\nAdded via scripts/quarterly-receipt.mts.`,
  ]);
  const sha = git('rev-parse', '--short', 'HEAD');
  console.log(`✓  (${sha})`);

  // [3] push.
  if (args.push) {
    process.stdout.write(`[3/5] Pushing to origin/${DEPLOY_BRANCH}... `);
    try {
      execFileSync('git', ['push', 'origin', DEPLOY_BRANCH], { stdio: ['ignore', 'ignore', 'pipe'] });
      console.log('✓');
    } catch (err) {
      console.log('✗');
      console.error(`Push failed: ${(err as Error).message}`);
      console.error('The commit is still in place locally. Run `git push` when ready.');
      process.exitCode = 1;
      return;
    }
  } else {
    console.log('[3/5] Pushing...                (skipped)');
  }

  // [4] rebuild.
  if (args.rebuild) {
    const rebuild = args.yes || (await confirm('Rebuild the site now (make rebuild)?', true));
    if (rebuild) {
      console.log('[4/5] Rebuilding site (streaming make output — takes ~30s):');
      console.log('──────────────────────────────────────────────────');
      try {
        execFileSync('make', ['rebuild'], { stdio: 'inherit' });
        console.log('──────────────────────────────────────────────────');
        console.log('[4/5] Rebuilding site...        ✓');
      } catch (err) {
        console.log('──────────────────────────────────────────────────');
        console.log('[4/5] Rebuilding site...        ✗');
        console.error(`Rebuild failed: ${(err as Error).message}`);
        console.error('Run `make rebuild` by hand to complete the deploy.');
        process.exitCode = 1;
        return;
      }
    } else {
      console.log('[4/5] Rebuilding...             (skipped — run `make rebuild` when ready)');
    }
  } else {
    console.log('[4/5] Rebuilding...             (skipped)');
  }

  // [5] optional tweet draft email.
  if (args.email) {
    process.stdout.write(`[5/5] Emailing tweet draft...   `);
    console.log('');
    await emailTweetDraft(args.email, updated, tweet, quarter);
  } else {
    console.log('[5/5] Email tweet draft...      (skipped — no --email)');
  }

  // Final: print the tweet copy again for easy paste.
  console.log('');
  console.log(`Done. ${APP_URL}/giving now shows ${formatUsd(updated.totalDonatedUsd)} donated to date.`);
  console.log('');
  console.log('Copy this tweet into X and attach the Folds of Honor Proud Supporter badge:');
  console.log('──────────────────────────────────────────────────');
  console.log(tweet);
  console.log('──────────────────────────────────────────────────');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
