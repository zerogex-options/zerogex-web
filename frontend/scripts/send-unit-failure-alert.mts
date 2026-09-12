#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/send-unit-failure-alert.mts \
//     --unit <systemd-unit> [--to <email>] [--lines N] [--dry-run]
//
// Emails the operator when a scheduled unit fails. Invoked by systemd itself,
// not by a timer: units carry
//
//   OnFailure=zerogex-web-alert@%n.service
//
// and deploy/systemd/zerogex-web-alert@.service routes the failed unit's name
// here. %n is the full failed unit name, so the alert instance ends up as
// zerogex-web-alert@zerogex-web-founding-lifetime.service.service — ugly, and
// the standard idiom.
//
// Why this exists: every sweep in deploy/systemd/ exits non-zero on a real
// failure, and until now that exit went to journald and nowhere else. Nothing
// read journald unless someone already suspected a problem, which inverts the
// point — the sweeps exist so nobody has to remember to check. The
// founding-lifetime sweep is the sharpest case: it fires weekly, does nothing
// for months, and the one week it matters is the week a founder's renewal is
// about to bill at the wrong rate. A silent failure there is indistinguishable
// from the 40 quiet weeks before it.
//
// The email carries the unit's exit status and the tail of its journal, so the
// alert is actionable on its own rather than being a pointer to go and look.
//
// Deliberately NOT throttled. Unlike the signup alarm — which samples a
// continuous signal and would re-fire hourly on the same flat patch — a unit
// failure is a discrete event: a sweep runs, fails once, and does not run again
// until its next scheduled tick. Weekly and daily timers cannot produce a
// stream. Adding a cooldown here would only create a way to miss the second
// failure of a genuinely broken sweep.
//
// Exits non-zero if it cannot send, which lands in journald under the alert
// unit. That is the floor of this design: nothing alerts about the alerter.
// Keep it dependency-light and boring for exactly that reason.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { Resend } from 'resend';

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

const DEFAULT_LINES = 40;
// Keep the mail small enough to read on a phone at 04:15. The journal tail is
// context, not an archive — journalctl has the rest.
const MAX_LOG_CHARS = 8000;

type Args = { unit: string | null; to: string | null; lines: number; dryRun: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { unit: null, to: null, lines: DEFAULT_LINES, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--unit') args.unit = (argv[++i] ?? '').trim() || null;
    else if (arg === '--to') args.to = (argv[++i] ?? '').trim() || null;
    else if (arg === '--lines') {
      const value = Number(argv[++i] ?? '');
      if (!Number.isInteger(value) || value < 1 || value > 500) {
        console.error(`[unit-alert] --lines expects an integer in 1..500, got "${argv[i]}".`);
        process.exit(1);
      }
      args.lines = value;
    } else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: send-unit-failure-alert.mts --unit <systemd-unit> [--to <email>] [--lines N] [--dry-run]',
      );
      process.exit(0);
    }
  }
  return args;
}

const cliArgs = parseArgs(process.argv.slice(2));
if (!cliArgs.unit) {
  console.error('[unit-alert] --unit is required (systemd passes it as %n).');
  process.exit(1);
}
// The unit name reaches us from systemd's %n, but it lands in argv and then in
// shell-adjacent places, so keep it to the shape systemd actually produces
// rather than trusting provenance. execFileSync below never invokes a shell,
// so this is belt-and-braces.
if (!/^[A-Za-z0-9@._\-\\:]+$/.test(cliArgs.unit)) {
  console.error(`[unit-alert] refusing implausible unit name: ${cliArgs.unit}`);
  process.exit(1);
}
const unit = cliArgs.unit;

/** Best-effort shell-out; a missing or failing probe must not lose the alert. */
function probe(command: string, argv: string[]): string {
  try {
    return execFileSync(command, argv, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15_000,
    }).trim();
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string })?.stderr?.toString?.().trim();
    return `(could not read: ${stderr || (err as Error).message})`;
  }
}

const status = probe('systemctl', [
  'show',
  unit,
  '--property=Result',
  '--property=ExecMainStatus',
  '--property=ExecMainExitTimestamp',
  '--property=Description',
]);

let logTail = probe('journalctl', ['-u', unit, '-n', String(cliArgs.lines), '--no-pager']);
if (logTail.length > MAX_LOG_CHARS) {
  logTail = `… truncated …\n${logTail.slice(-MAX_LOG_CHARS)}`;
}

const host = probe('hostname', []);
const nowIso = new Date().toISOString();

const subject = `[ZeroGEX] ⚠ ${unit} FAILED`;
const text = `A scheduled ZeroGEX unit exited non-zero.

Unit:  ${unit}
Host:  ${host}
When:  ${nowIso}

--- systemctl status properties ---
${status}

--- last ${cliArgs.lines} journal lines ---
${logTail}

--- what to do ---
  journalctl -u ${unit} -n 200 --no-pager     # fuller log
  systemctl status ${unit}                    # current state
  systemctl start ${unit}                     # re-run it by hand

Most of these sweeps are idempotent and safe to re-run; check the unit's own
notes in deploy/systemd/ before re-firing one that writes to Stripe.
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const html = `<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.5">
<p style="font-family:system-ui,sans-serif;font-size:15px"><strong>${escapeHtml(unit)}</strong> exited non-zero on ${escapeHtml(host)} at ${escapeHtml(nowIso)}.</p>
<pre style="background:#f6f8fa;padding:12px;border-radius:6px;overflow-x:auto">${escapeHtml(status)}</pre>
<p style="font-family:system-ui,sans-serif;font-size:13px;color:#555">Last ${cliArgs.lines} journal lines:</p>
<pre style="background:#f6f8fa;padding:12px;border-radius:6px;overflow-x:auto">${escapeHtml(logTail)}</pre>
<pre style="background:#f6f8fa;padding:12px;border-radius:6px;overflow-x:auto">journalctl -u ${escapeHtml(unit)} -n 200 --no-pager
systemctl status ${escapeHtml(unit)}
systemctl start ${escapeHtml(unit)}</pre>
</div>`;

if (cliArgs.dryRun) {
  console.log(`=== would send (dry-run) ===`);
  console.log(`SUBJECT: ${subject}`);
  console.log(text);
  process.exit(0);
}

const to =
  cliArgs.to ??
  process.env.UNIT_ALERT_EMAIL ??
  process.env.SIGNUP_ALARM_EMAIL ??
  process.env.FOH_REMINDER_EMAIL;
if (!to) {
  console.error(
    '[unit-alert] no recipient. Set UNIT_ALERT_EMAIL (or SIGNUP_ALARM_EMAIL / FOH_REMINDER_EMAIL), or pass --to.',
  );
  process.exit(1);
}
const apiKey = process.env.RESEND_API_KEY;
const fromAddr = process.env.RESEND_FROM_EMAIL;
if (!apiKey || !fromAddr) {
  console.error('[unit-alert] missing RESEND_API_KEY and/or RESEND_FROM_EMAIL — cannot send.');
  process.exit(1);
}

const resend = new Resend(apiKey);
const result = await resend.emails.send({ from: fromAddr, to, subject, text, html });
if (result.error) {
  console.error(`[unit-alert] Resend error: ${result.error.message}`);
  process.exit(1);
}
console.log(`[unit-alert] failure alert for ${unit} sent to ${to}.`);
