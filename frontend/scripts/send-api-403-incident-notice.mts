#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/send-api-403-incident-notice.mts \
//     [--dry-run | --yes] [--only <addr>]
//
// One-off incident notice for the 2026-08-31 API scope-enforcement 403s.
//
// WHAT HAPPENED. For ~48 minutes (09:22:08–10:10 ET) the API ran with
// API_SCOPE_ENFORCEMENT=1. Per-key scopes are real but had never been
// enforced, and the bundle self-service mints for Pro (`signals`) excludes
// MARKET_RAW — so every caller of /api/market/* and /api/option/* started
// getting 403s despite holding a valid, correctly-provisioned Pro key. The
// flag was reverted and those endpoints verified serving 200 again.
//
// WHY EACH MAIL IS DIFFERENT. A generic "sorry, something broke" is worth
// little to someone reconciling their own logs. Each recipient gets their own
// failure count and endpoint list, taken from the audit log, so they can match
// it against what they saw. Counts came from:
//
//   journalctl -u zerogex-oa-api --since "24 hours ago" \
//     | grep 'api_request' | grep 'status=403' \
//     | grep -oE 'path=[^ ]+ status=403 [^ ]+ caller_user_id=[^ ]+' \
//     | sort | uniq -c | sort -rn
//
// jimmyturk@gmail.com is deliberately NOT in the list: he reported the problem
// and was answered personally. Mailing him this as well would read as a bot.
//
// Sends ONE message per recipient. Never a shared To/CC — that would disclose
// every customer's address to every other customer.

import fs from 'node:fs';
import path from 'node:path';

const WINDOW = '9:22 and 10:10 AM ET on this morning';
const SUBJECT = 'Resolved: ZeroGEX API problems today';
const SUPPORT = 'support@zerogex.io';
// Latency recovered here after the last mitigation landed; stated so a
// recipient can match it against their own logs rather than take "fixed"
// on faith.
const RECOVERED_AT = 'about 12:40 PM ET';

// Resend's default rate limit is 2 requests/second. 600ms keeps a comfortable
// margin on a list this small; there is no reason to go faster.
const SEND_INTERVAL_MS = 600;

type Recipient = { email: string; failures: number; endpoints: string[] };

const RECIPIENTS: Recipient[] = [
  {
    email: 'rakesh.sanghvi@gmail.com',
    failures: 66898,
    endpoints: ['/api/v2/option/quote'],
  },
  {
    email: 'sbethu95@gmail.com',
    failures: 841,
    endpoints: [
      '/api/market/quote (v1 and v2)',
      '/api/market/historical (v1 and v2)',
      '/api/market/session-levels (v1 and v2)',
    ],
  },
  {
    email: 'johnnie@dunkum.us',
    failures: 323,
    endpoints: [
      '/api/option/contract',
      '/api/market/quote',
      '/api/market/historical',
      '/api/market/session-closes',
      '/api/market/open-interest',
    ],
  },
  { email: 'pghaneian@gmail.com', failures: 84, endpoints: ['/api/market/session-levels'] },
  { email: 'tradingpool@protonmail.ch', failures: 15, endpoints: ['/api/market/quote'] },
  { email: 'rick.young@spherecapitalgroup.com', failures: 8, endpoints: ['/api/market/quote'] },
  { email: 'mauro.arciniegas19@gmail.com', failures: 4, endpoints: ['/api/market/quote'] },
  { email: 'stevefu717@gmail.com', failures: 2, endpoints: ['/api/market/quote'] },
  { email: 'peteryacono@gmail.com', failures: 2, endpoints: ['/api/market/historical'] },
  { email: 'danielsmark971+zerogex@gmail.com', failures: 1, endpoints: ['/api/market/quote'] },
];

// --- args -----------------------------------------------------------------

type Args = { dryRun: boolean; yes: boolean; only?: string };

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, yes: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--only') {
      i += 1;
      args.only = argv[i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: send-api-403-incident-notice.mts [--dry-run | --yes] [--only <addr>]\n\n' +
          '      --dry-run   Print every rendered mail; send nothing.\n' +
          '  -y, --yes       Actually send.\n' +
          '      --only      Restrict to one recipient (test yourself first).\n',
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.dryRun && cliArgs.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}

// --- env ------------------------------------------------------------------

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

const envLocal = parseEnvFile(path.join(process.cwd(), '.env.local'));
function envOrLocal(key: string): string | undefined {
  return process.env[key] || envLocal[key] || undefined;
}

// --- rendering ------------------------------------------------------------

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// "1 request" / "66,898 requests" — the count is the substance of the mail, so
// it should read as a sentence rather than as a filled-in template slot.
function describeFailures(n: number) {
  return n === 1 ? '1 request' : `${n.toLocaleString('en-US')} requests`;
}

function renderText(r: Recipient) {
  return `Hi,

If your ZeroGEX API integration had trouble today, there were two separate problems — and both were ours, not anything wrong on your side.

First, between ${WINDOW}, a permissions change we deployed on Sunday evening was returning HTTP 403 on endpoints your plan should have access to. On your account it affected ${describeFailures(r.failures)}, on:

${r.endpoints.map((e) => `  - ${e}`).join('\n')}

Second, and unrelated: from late morning into the early afternoon the API was slow, with some requests taking tens of seconds or timing out entirely. We had outgrown our database capacity, and Monday-open volume was queueing requests behind each other.

Both are resolved. The permissions change was rolled back at 10:10 AM, and response times returned to normal at ${RECOVERED_AT} — the API is now faster than it was before any of this started. We are upgrading the database hardware this evening after the close so there is proper headroom going forward.

Nothing on your side needs to change. Your API key is fine, and if you regenerated it while troubleshooting, that was not necessary — the new one works exactly the same, so there is no need to switch back. Re-running whatever failed should now succeed.

On the permissions mistake specifically: we enabled that check without first confirming which endpoints live integrations actually depend on. We have since pulled that usage data, so if we revisit it we will know precisely what would be affected and will give proper notice well in advance rather than changing it underneath you.

Sorry for the disruption, and for any time you lost chasing problems that were not yours. If anything is still failing, reply here or write to ${SUPPORT} and I will look at it directly.

Michael
ZeroGEX
`;
}

function renderHtml(r: Recipient) {
  const items = r.endpoints
    .map((e) => `<li style="margin-bottom: 4px;"><code>${escapeHtml(e)}</code></li>`)
    .join('');
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #111;">
      <p>Hi,</p>
      <p>If your ZeroGEX API integration had trouble today, there were two separate problems — and both were ours, not anything wrong on your side.</p>
      <p>First, between <strong>${escapeHtml(WINDOW)}</strong>, a permissions change we deployed on Sunday evening was returning HTTP 403 on endpoints your plan should have access to. On your account it affected <strong>${escapeHtml(describeFailures(r.failures))}</strong>, on:</p>
      <ul style="padding-left: 20px;">${items}</ul>
      <p>Second, and unrelated: from late morning into the early afternoon the API was slow, with some requests taking tens of seconds or timing out entirely. We had outgrown our database capacity, and Monday-open volume was queueing requests behind each other.</p>
      <p>Both are resolved. The permissions change was rolled back at 10:10 AM, and response times returned to normal at ${escapeHtml(RECOVERED_AT)} — the API is now faster than it was before any of this started. We are upgrading the database hardware this evening after the close so there is proper headroom going forward.</p>
      <p>Nothing on your side needs to change. Your API key is fine, and if you regenerated it while troubleshooting, that was not necessary — the new one works exactly the same, so there is no need to switch back. Re-running whatever failed should now succeed.</p>
      <p>On the permissions mistake specifically: we enabled that check without first confirming which endpoints live integrations actually depend on. We have since pulled that usage data, so if we revisit it we will know precisely what would be affected and will give proper notice well in advance rather than changing it underneath you.</p>
      <p>Sorry for the disruption, and for any time you lost chasing problems that were not yours. If anything is still failing, reply here or write to <a href="mailto:${SUPPORT}">${SUPPORT}</a> and I will look at it directly.</p>
      <p>Michael<br>ZeroGEX</p>
    </div>
  `.trim();
}

// --- main -----------------------------------------------------------------

async function main() {
  const recipients = cliArgs.only
    ? RECIPIENTS.filter((r) => r.email.toLowerCase() === cliArgs.only!.toLowerCase())
    : RECIPIENTS;

  if (cliArgs.only && recipients.length === 0) {
    console.error(`Error: --only ${cliArgs.only} matches nobody in the list.`);
    process.exit(1);
  }

  const from = envOrLocal('RESEND_FROM_EMAIL')?.trim();
  if (!from) {
    console.error('Missing required env var: RESEND_FROM_EMAIL');
    console.error('Tip: set it in frontend/.env.local or export it in your shell.');
    process.exit(1);
  }

  const total = recipients.reduce((sum, r) => sum + r.failures, 0);
  console.log(
    `${recipients.length} recipient(s), ${total.toLocaleString('en-US')} failed requests total`,
  );
  console.log(`from:    ${from}`);
  console.log(`subject: ${SUBJECT}\n`);

  if (!cliArgs.yes) {
    for (const r of recipients) {
      console.log('='.repeat(72));
      console.log(`to: ${r.email}`);
      console.log('='.repeat(72));
      console.log(renderText(r));
    }
    console.log('='.repeat(72));
    if (cliArgs.dryRun) console.log('[dry-run] Nothing sent.');
    else console.log('Refusing to send without --yes. Re-run with --yes, or --dry-run to preview.');
    return;
  }

  const apiKey = envOrLocal('RESEND_API_KEY');
  if (!apiKey) {
    console.error('Missing required env var: RESEND_API_KEY');
    process.exit(1);
  }

  // Imported here rather than at module scope so --dry-run runs anywhere,
  // including a checkout with no node_modules installed.
  const { Resend } = await import('resend');
  const client = new Resend(apiKey);

  let sent = 0;
  const failed: { email: string; error: string }[] = [];

  for (const r of recipients) {
    try {
      const result = await client.emails.send({
        from,
        to: r.email,
        subject: SUBJECT,
        text: renderText(r),
        html: renderHtml(r),
      });
      if (result.error) throw new Error(result.error.message);
      sent += 1;
      console.log(`  sent    ${r.email}  (${result.data?.id ?? 'no id'})`);
    } catch (err) {
      // Keep going: one bad address must not strand the rest of the list.
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ email: r.email, error: message });
      console.error(`  FAILED  ${r.email}: ${message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
  }

  console.log(`\nsent ${sent}/${recipients.length}`);
  if (failed.length) {
    console.error('\nUNSENT — these people still need a reply:');
    for (const f of failed) console.error(`  ${f.email}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
