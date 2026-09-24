#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/money-back-sweep.mts [--dry-run | --yes]
//
// Finds money-back refund requests that stopped part-way — still 'pending' 30
// minutes after their last activity — and emails the operator about each, once
// per stall (core/moneyBackServer.ts sweepStalledMoneyBackRequests). The case
// it exists for is a process killed mid-request: the member may have their
// money back while their subscription is still live, and nobody was told.
// Driven hourly by the zerogex-web-money-back-sweep timer
// (deploy/steps/099.money-back-sweep).
//
//   --dry-run  (default) list what would be reported
//   --yes      send the alerts and latch them

import { loadEnvLocal } from './env-local.mts';

const argv = process.argv.slice(2);
for (const arg of argv) {
  if (!['--dry-run', '--yes', '-y', '--help', '-h'].includes(arg)) {
    console.error(`Error: unknown argument "${arg}".`);
    process.exit(1);
  }
}
if (argv.includes('--help') || argv.includes('-h')) {
  console.log('Usage: node --experimental-strip-types --no-warnings scripts/money-back-sweep.mts [--dry-run | --yes]');
  process.exit(0);
}
const send = argv.includes('--yes') || argv.includes('-y');
if (send && argv.includes('--dry-run')) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}

loadEnvLocal();
const { sweepStalledMoneyBackRequests } = await import('../core/moneyBackServer.ts');

const result = await sweepStalledMoneyBackRequests({ send });
console.log(`Stalled money-back requests: ${result.stalled.length}`);
for (const row of result.stalled) {
  console.log(`  • ${row.email}  sub ${row.subscriptionId}  refunded so far ${row.amountFormatted}  last activity ${row.updatedAt}`);
}
if (!send) {
  if (result.stalled.length) console.log('\n[dry run] No alerts sent. Re-run with --yes to send them.');
  process.exit(0);
}
if (result.noRecipient) {
  console.error('No REFUND_ALERT_EMAIL (or CANCELLATION_ALERT_EMAIL / SIGNUP_ALARM_EMAIL / FOH_REMINDER_EMAIL) is set: nobody to alert.');
  process.exit(result.stalled.length ? 1 : 0);
}
console.log(`Alerted: ${result.alerted}`);
// A failed alert fails the unit, so the systemd OnFailure alert fires instead.
process.exit(result.alerted < result.stalled.length ? 1 : 0);
