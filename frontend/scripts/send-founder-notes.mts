#!/usr/bin/env node
// Run from the frontend/ directory (or via `make send-founder-notes FILE=<doc>`):
//   node --experimental-strip-types scripts/send-founder-notes.mts --file <doc.md> [--yes] [--preview-to <email>]
//
// Sends the hand-written founder notes in an outreach doc: one personal email
// per member about an unpaid invoice, from Michael, through Resend.
//
// WHY. The payment-failure follow-ups in docs/outreach/ are 1:1 notes, not
// mailer.ts templates. Each is written for one member and carries that
// member's own signed /pay link, and until now each one was copied out of the
// doc into a mail client by hand. That is slow; it is the step where one
// member's pay link gets pasted into another member's email; and it sends what
// the draft said when it was written, so a member who paid, canceled or lost
// access overnight still got a note saying otherwise. This reads the notes
// straight from the doc and re-checks every one against Stripe and the
// database at the moment it would go out. The format of a note, and why it is
// strict, is in core/founderNotes.ts.
//
// DRY RUN BY DEFAULT. With no flags it sends nothing. It prints what would
// happen to each note and why, then every email that would go out, in full,
// with its real pay link. A mistake anywhere in the doc stops it before Stripe
// or the database is touched.
//
// Each note, in this order (rules in core/founderNotes.ts):
//   - not on the SKIP list;
//   - never sent before. A `founder_note_sent` audit row latches the invoice:
//     one founder note per invoice, ever. It is written only once Resend has
//     accepted the email, so a failed send goes out on the next run;
//   - a live account has that email;
//   - the invoice belongs to THAT account's Stripe customer. Anything else is
//     an error, not a skip: the doc pairs the member with someone else's
//     invoice, and sending would hand them another member's pay link;
//   - the invoice is still open with money owed. Paid, voided or written off
//     since: nothing to say;
//   - the subscription is not canceled, and the member has not asked to cancel;
//   - a note marked `access: on` tells the member their account is still on,
//     so it is not sent once that is false;
//   - its send-after has passed. One that is not due yet waits for a later run
//     of the same command;
//   - a note marked `access: off` tells the member their access has ended, so
//     while they still hold a paid tier it waits too: the hourly grace cutoff
//     will end it, and a later run sends the note once it has.
//
// The email is plain text, from FOUNDER_NOTE_FROM, with Reply-To and Bcc set to
// Michael@zerogex.io. Plain text because it should read like the personal note
// it is. The Bcc puts a copy of every note in Michael's mailbox, where the
// member's reply threads with it.
//
// It never charges, retries, voids or changes anything in Stripe. It reads
// Stripe and the database, sends at most one email per note, and writes one
// audit row for each email Resend accepted.
//
// Flags / environment:
//   --file <path>        the doc with the ```note blocks (required)
//   --yes                actually send (default is a dry run that sends nothing)
//   --preview-to <addr>  send every note that would go out, now or once it is
//                        due or its access has ended, to <addr> instead: subject marked
//                        "[Preview for <member>]", no Bcc, nothing recorded.
//                        Its pay links are live for the members' real
//                        invoices; don't pay them
//   SKIP=<list>          emails or invoice ids to leave alone, comma-separated.
//                        Give it on EVERY run; the commands this prints carry
//                        it forward for you.
//   FOUNDER_NOTE_FROM    the sender (default "Michael from ZeroGEX <Michael@zerogex.io>")

import { loadEnvLocal } from './env-local.mts';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Resend } from 'resend';
import type Stripe from 'stripe';
import { parseSkipList, skipArg, skipEntryFor, suspectSkipEntries } from '../core/emailSkipList.ts';
import {
  FOUNDER_NOTE_AUDIT_TYPE,
  PAY_LINK_PLACEHOLDER,
  decideFounderNote,
  founderNoteAuditMessage,
  isEmailAddress,
  parseFounderNoteAudit,
  parseFounderNotes,
  renderFounderNote,
  type FounderNote,
  type FounderNoteDecision,
  type FounderNoteInvoice,
  type FounderNoteSubscription,
} from '../core/founderNotes.ts';
import { ResendSendError, deliverAll, resendSendError } from '../core/resendRetry.ts';

// Load the WHOLE of .env.local — see scripts/env-local.mts for why an
// allowlist of keys cannot be kept correct here. The static imports above read
// no environment as they load; the modules that do are imported further down,
// after this.
const loadedFromEnvFile = loadEnvLocal();

const USAGE = [
  'Usage: node --experimental-strip-types scripts/send-founder-notes.mts --file <doc.md> [--yes | --preview-to <email>]',
  '   or: make send-founder-notes FILE=<doc.md> [YES=1 | PREVIEW_TO=<email>] [SKIP=<emails or invoice ids>]',
].join('\n');

function usageError(message: string): never {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(1);
}

let fileArg: string | null = null;
let send = false;
let previewArg: string | null = null;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--yes') send = true;
  else if (arg === '--file') fileArg = argv[++i] ?? '';
  else if (arg === '--preview-to') previewArg = argv[++i] ?? '';
  else usageError(`Unknown argument "${arg}".`);
}
if (!fileArg) usageError('--file is required: the doc with the ```note blocks.');
if (previewArg !== null && !isEmailAddress(previewArg)) {
  usageError(`--preview-to needs one email address, got "${previewArg}".`);
}
// One goes only to you, the other to every member. Refuse rather than guess.
if (send && previewArg !== null) {
  usageError('Give --yes or --preview-to, not both: a preview goes only to you, --yes goes to the members.');
}
const filePath = path.resolve(fileArg);
const previewTo = previewArg;

let markdown: string;
try {
  markdown = fs.readFileSync(filePath, 'utf8');
} catch (err) {
  console.error(`Cannot read ${filePath}: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

// Every mistake at once, and before anything is looked up: a doc that cannot
// be read with certainty sends nothing at all.
const { notes, errors } = parseFounderNotes(markdown);
if (errors.length > 0) {
  console.error(`${filePath} has ${errors.length} problem(s) with its notes:\n`);
  for (const error of errors) console.error(`  ! ${error}`);
  console.error('\nNothing was looked up and nothing was sent. Fix the doc and run it again.');
  process.exit(1);
}
if (notes.length === 0) {
  console.log(`${filePath} has no \`\`\`note blocks. Nothing to do.`);
  process.exit(0);
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set (env or .env.local). Nothing to do.');
  process.exit(1);
}

// Pay links are built here, for the invoice each note was checked against, and
// the dry run prints them too, so every run that has one needs both of these.
const usesPayLink = notes.some((note) => note.body.includes(PAY_LINK_PLACEHOLDER));
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? '';
if (usesPayLink && !appUrl) {
  console.error('NEXT_PUBLIC_APP_URL is not set (env or .env.local); the pay links would point nowhere.');
  process.exit(1);
}
if (usesPayLink && !process.env.ZEROGEX_END_USER_TOKEN_SECRET) {
  console.error('ZEROGEX_END_USER_TOKEN_SECRET is not set (env or .env.local); the /pay links cannot be signed.');
  process.exit(1);
}
if (usesPayLink && send && !appUrl.startsWith('https://')) {
  console.error(`NEXT_PUBLIC_APP_URL is ${appUrl}, not an https:// address; the members' pay links would not work.`);
  process.exit(1);
}
if ((send || previewTo !== null) && !process.env.RESEND_API_KEY) {
  console.error('RESEND_API_KEY is not set (env or .env.local); nothing can be sent.');
  process.exit(1);
}

const { getDb } = await import('../core/db.ts');
const { buildPayUrl } = await import('../core/payLink.ts');
const { getStripe } = await import('../core/stripe.ts');
const { readInvoiceSubscriptionId } = await import('../core/stripeInvoice.ts');

const MICHAEL = 'Michael@zerogex.io';
const from = process.env.FOUNDER_NOTE_FROM?.trim() || `Michael from ZeroGEX <${MICHAEL}>`;
const skip = parseSkipList(process.env.SKIP);
const db = getDb();
const stripe = getStripe();
const nowMs = Date.now();

const money = (cents: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${currency.toUpperCase()} ${(cents / 100).toFixed(2)}`;
  }
};
const et = (ms: number) =>
  `${new Date(ms).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET`;
const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

// Every invoice that has had its note, and when (the first row, should there
// ever be two).
const sentAt = new Map<string, string>();
for (const row of db
  .prepare(`SELECT message, created_at FROM audit_events WHERE type = ? ORDER BY created_at`)
  .all(FOUNDER_NOTE_AUDIT_TYPE) as Array<{ message: string; created_at: string }>) {
  const invoiceId = parseFounderNoteAudit(row.message);
  if (invoiceId && !sentAt.has(invoiceId)) sentAt.set(invoiceId, row.created_at);
}

type Account = {
  id: string;
  email: string;
  tier: string | null;
  stripe_customer_id: string | null;
  deleted_at: string | null;
};
const accountByEmail = db.prepare(
  'SELECT id, email, tier, stripe_customer_id, deleted_at FROM users WHERE lower(email) = ?',
);

type StripeFacts = {
  /** What the decision needs, or why Stripe could not be asked. */
  invoice: FounderNoteInvoice | string;
  subscription: FounderNoteSubscription | null;
  /** Amount due, formatted for the report, when the invoice was read. */
  amount: string | null;
  /** Stripe's own words for a missing invoice, e.g. that a test-mode key was used. */
  missing: string | null;
};

const isStripeMissing = (err: unknown) => {
  const e = err as { code?: unknown; statusCode?: unknown } | null;
  return e?.code === 'resource_missing' || e?.statusCode === 404;
};

async function lookUp(invoiceId: string): Promise<StripeFacts> {
  let invoice: Stripe.Invoice;
  try {
    invoice = await stripe.invoices.retrieve(invoiceId);
  } catch (err) {
    if (isStripeMissing(err)) {
      return {
        invoice: { found: false, status: null, customerId: null, amountDue: null },
        subscription: null,
        amount: null,
        missing: messageOf(err),
      };
    }
    return { invoice: messageOf(err), subscription: null, amount: null, missing: null };
  }
  const amountDue = typeof invoice.amount_due === 'number' ? invoice.amount_due : null;
  const amount = amountDue === null ? null : money(amountDue, invoice.currency ?? 'usd');
  let subscription: FounderNoteSubscription | null = null;
  const subscriptionId = readInvoiceSubscriptionId(invoice);
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      subscription = { status: sub.status, cancelAtPeriodEnd: sub.cancel_at_period_end };
    } catch (err) {
      return { invoice: `subscription ${subscriptionId}: ${messageOf(err)}`, subscription: null, amount, missing: null };
    }
  }
  return {
    invoice: {
      found: true,
      status: invoice.status ?? null,
      customerId: typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? null),
      amountDue,
    },
    subscription,
    amount,
    missing: null,
  };
}

type Row = {
  note: FounderNote;
  account: Account | null;
  amount: string | null;
  decision: FounderNoteDecision;
  missing: string | null;
};

console.log(`Checking ${notes.length} founder note(s) in ${filePath}…`);
if (skip.entries.length > 0) console.log(`Skipping at your request: ${skip.entries.join(', ')}`);
console.log('');

const rows: Row[] = [];
const skipMatched = new Set<string>();
for (const note of notes) {
  const account = (accountByEmail.get(note.to) as Account | undefined) ?? null;
  const skipEntry = skipEntryFor(skip, { email: note.to, invoiceId: note.invoiceId });
  if (skipEntry) skipMatched.add(skipEntry);
  const facts = await lookUp(note.invoiceId);
  const decision = decideFounderNote({
    nowMs,
    note,
    skipEntry,
    latchedAt: sentAt.get(note.invoiceId) ?? null,
    user: {
      found: account !== null,
      deleted: Boolean(account?.deleted_at),
      tier: account?.tier ?? null,
      stripeCustomerId: account?.stripe_customer_id ?? null,
    },
    invoice: facts.invoice,
    subscription: facts.subscription,
  });
  rows.push({ note, account, amount: facts.amount, decision, missing: facts.missing });
}

// The email for every note that passed every check, whether it goes now or on
// a later run. It goes to the address on the account (the note's `to` matched
// it ignoring case), with the pay link for the invoice the note was checked
// against and no other.
type Outgoing = {
  note: FounderNote;
  userId: string;
  to: string;
  subject: string;
  text: string;
  /** Null when it goes now; otherwise what it is waiting for. */
  wait: { untilMs: number | null; reason: string } | null;
};
const outgoing: Outgoing[] = [];
for (const row of rows) {
  const { decision, note, account } = row;
  if (decision.action !== 'send' && decision.action !== 'wait') continue;
  if (!account) throw new Error(`No account for ${note.to}, yet its note passed every check.`);
  const payLink = note.body.includes(PAY_LINK_PLACEHOLDER) ? buildPayUrl(appUrl, note.invoiceId) : null;
  outgoing.push({
    note,
    userId: account.id,
    to: account.email,
    subject: note.subject,
    text: renderFounderNote(note.body, { payLink }),
    wait: decision.action === 'wait' ? { untilMs: decision.untilMs, reason: decision.reason } : null,
  });
}
const due = outgoing.filter((o) => o.wait === null);
const waiting = outgoing.filter((o) => o.wait !== null);
// Two kinds of waiting: for a send-after time, and (with no time) for an
// `access: off` member's access to end.
const timedWaits = waiting.flatMap((o) => (o.wait && o.wait.untilMs !== null ? [o.wait.untilMs] : []));
const nextDueMs = timedWaits.length > 0 ? Math.min(...timedWaits) : null;
const heldForAccess = waiting.length - timedWaits.length;
const waitingFor = (o: Outgoing) =>
  o.wait === null ? 'due now' : o.wait.untilMs === null ? o.wait.reason : `due ${et(o.wait.untilMs)}`;

const LABEL: Record<FounderNoteDecision['action'], string> = { send: 'SEND', wait: 'WAIT', skip: 'SKIP', error: 'ERROR' };
console.log('── The notes ──');
for (const row of rows) {
  const { decision } = row;
  const detail =
    decision.action === 'send'
      ? 'due now'
      : decision.action === 'wait'
        ? decision.untilMs === null
          ? decision.reason
          : `due ${et(decision.untilMs)}`
        : decision.action === 'error' && row.missing
          ? `${decision.reason} (${row.missing})`
          : decision.reason;
  console.log(
    `  ${LABEL[decision.action].padEnd(5)}  ${row.note.to.padEnd(34)} ${row.note.invoiceId.padEnd(28)} ` +
      `${(row.amount ?? '').padStart(9)}  ${detail}`,
  );
}
const count = (action: FounderNoteDecision['action']) => rows.filter((r) => r.decision.action === action).length;
const errorCount = count('error');
console.log(
  `\n  ${count('send')} to send now, ${count('wait')} waiting, ${count('skip')} skipped, ${errorCount} error(s)`,
);

// A SKIP entry that matches no note or account is almost always a typo, and a
// typo means the person it was meant for is about to be emailed.
const suspect = suspectSkipEntries(skip, skipMatched, (email) => accountByEmail.get(email) !== undefined);
if (suspect.length > 0) {
  console.log(`\n⚠ SKIP entries that match no note or account here: ${suspect.join(', ')} — check the spelling before sending.`);
}

for (const [index, o] of outgoing.entries()) {
  console.log(`\n── Email ${index + 1} of ${outgoing.length}: ${o.to}, ${waitingFor(o)} ──`);
  console.log(`From:     ${from}`);
  console.log(`Reply-To: ${MICHAEL}`);
  console.log(`Bcc:      ${MICHAEL}`);
  console.log(`To:       ${o.to}`);
  console.log(`Subject:  ${o.subject}`);
  console.log('');
  console.log(o.text);
}
if (outgoing.length > 0) console.log(`\n── End of ${outgoing.length === 1 ? 'the email' : 'the emails'} ──`);

// Repeat every setting this run used, so the real send can't quietly drop the
// SKIP list or the sender the dry run was checked with. A sender set in
// .env.local applies to every run anyway.
const shellWord = (value: string) => (/^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`);
const fromGiven = process.env.FOUNDER_NOTE_FROM !== undefined && !loadedFromEnvFile.includes('FOUNDER_NOTE_FROM');
const carried = `${skipArg(skip)}${fromGiven ? ` FOUNDER_NOTE_FROM=${shellWord(process.env.FOUNDER_NOTE_FROM ?? '')}` : ''}`;
const command = (mode: string) => `make send-founder-notes FILE=${shellWord(filePath)} ${mode}${carried}`;

// What is still waiting, and when each kind goes out.
function notDueYet(): string {
  const parts: string[] = [];
  if (nextDueMs !== null) parts.push(`${timedWaits.length} not due yet (the first at ${et(nextDueMs)})`);
  if (heldForAccess > 0) parts.push(`${heldForAccess} held until the member's access has ended`);
  return parts.join('; ');
}
function whenWaitingGo(): string[] {
  const lines: string[] = [];
  if (nextDueMs !== null) lines.push('A note that is not due yet goes out on the first YES=1 run after its send-after time.');
  if (heldForAccess > 0) {
    lines.push(
      "A note held for access goes out on a later YES=1 run, once that member's access has ended " +
        '(the hourly grace cutoff ends it).',
    );
  }
  return lines;
}

function finish(failed: boolean): never {
  if (errorCount > 0) {
    console.log(
      `\n${errorCount} note(s) marked ERROR above will not be sent until the doc or Stripe is fixed, ` +
        'or the note is added to SKIP.',
    );
  }
  process.exit(errorCount > 0 || failed ? 1 : 0);
}

if (!send && previewTo === null) {
  console.log(
    `\nDRY RUN — nothing was sent. ${due.length} note(s) would go out now${waiting.length > 0 ? `; ${notDueYet()}` : ''}.`,
  );
  if (outgoing.length > 0) {
    console.log(`Preview them with:  ${command('PREVIEW_TO=<you>')}`);
    console.log(`Send them with:     ${command('YES=1')}`);
    for (const line of whenWaitingGo()) console.log(line);
  }
  finish(false);
}

const resend = new Resend(process.env.RESEND_API_KEY);

async function deliver(email: { to: string; subject: string; text: string; bcc: string | null }): Promise<void> {
  const result = await resend.emails.send({
    from,
    to: email.to,
    replyTo: MICHAEL,
    ...(email.bcc ? { bcc: email.bcc } : {}),
    subject: email.subject,
    // Text only, no html: a personal note should look like one.
    text: email.text,
  });
  if (result.error) throw resendSendError(result.error, result.headers);
}

// Paced well under Resend's 10 requests/second, which every sender on the
// account shares. A 429 is Resend refusing the request, and deliverAll retries
// it on the spot. Nothing else is retried within the run: a request that got
// no answer, or a 5xx, may have been sent anyway, and a member getting the same
// personal note twice is worse than one waiting for the next run. The Bcc
// copies say which went out.
const DELIVERY = {
  throttleMs: 250,
  retryDelaysMs: [] as number[],
  log: (line: string) => console.log(line),
};

/** Failed with no clear answer from Resend: it may have gone out anyway. */
const unclear = (err: unknown) =>
  err instanceof ResendSendError && (err.statusCode === null || err.statusCode >= 500);

if (previewTo !== null) {
  if (outgoing.length === 0) {
    console.log('\nNothing to preview: no note would go out, now or later.');
    finish(false);
  }
  console.log(`\nSending ${outgoing.length} preview(s) to ${previewTo}…`);
  const previews = await deliverAll(
    outgoing,
    (o) => deliver({ to: previewTo, subject: `[Preview for ${o.to}] ${o.subject}`, text: o.text, bcc: null }),
    { ...DELIVERY, label: (o) => `preview of ${o.to}` },
  );
  console.log(
    `\nSent ${previews.sent.length} preview(s) to ${previewTo}` +
      `${previews.failed.length > 0 ? `; ${previews.failed.length} failed` : ''}. ` +
      'No member was emailed and nothing was recorded.',
  );
  if (usesPayLink) {
    console.log("The pay links in the previews are LIVE: each one opens that member's real invoice. Don't pay them.");
  }
  console.log(`Send them for real with:  ${command('YES=1')}`);
  finish(previews.failed.length > 0);
}

if (due.length === 0) {
  console.log(`\nNothing is due now${waiting.length > 0 ? `: ${notDueYet()}` : ''}.`);
  for (const line of whenWaitingGo()) console.log(line);
  finish(false);
}

const insertLatch = db.prepare(
  `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
   VALUES (?, ?, ?, NULL, ?, 'script', ?, ?)`,
);
const unrecorded: Outgoing[] = [];

console.log(`\nSending ${due.length} note(s)…`);
const { sent, failed } = await deliverAll(
  due,
  async (o) => {
    await deliver({ to: o.to, subject: o.subject, text: o.text, bcc: MICHAEL });
    // Delivered. Nothing from here may throw: deliverAll would take it for a
    // failed send, and the member would get the note again.
    try {
      insertLatch.run(
        `audit_${crypto.randomBytes(12).toString('hex')}`,
        FOUNDER_NOTE_AUDIT_TYPE,
        o.userId,
        o.to,
        founderNoteAuditMessage(o.note.invoiceId, o.subject),
        new Date().toISOString(),
      );
      console.log(`  SENT ${o.to}  ${o.note.invoiceId}`);
    } catch (err) {
      unrecorded.push(o);
      console.error(`  SENT ${o.to}, but NOT RECORDED: ${messageOf(err)}`);
    }
  },
  { ...DELIVERY, label: (o) => o.to },
);

console.log(`\nSent ${sent.length}, failed ${failed.length}.`);
if (failed.length > 0) {
  console.log('A failed note was not recorded, so the next YES=1 run sends it.');
  const maybeSent = failed.filter((f) => unclear(f.error)).map((f) => f.item);
  if (maybeSent.length > 0) {
    console.log(
      `Resend never gave a clear answer for ${maybeSent.map((o) => o.to).join(', ')}, so those may have gone ` +
        "out anyway. Look for their Bcc copies first; for any that arrived, add its invoice to SKIP so it isn't sent twice.",
    );
  }
}
if (unrecorded.length > 0) {
  console.error(
    `\n${unrecorded.length} note(s) went out but could NOT be recorded, so a later run would send them again:`,
  );
  for (const o of unrecorded) console.error(`  ${o.to}  ${o.note.invoiceId}`);
  const skipAll = [...skip.entries, ...unrecorded.map((o) => o.note.invoiceId)];
  console.error(`Give every later run SKIP=${skipAll.join(',')} until they are.`);
}
if (waiting.length > 0) {
  console.log(`\nStill waiting: ${notDueYet()}.`);
  for (const line of whenWaitingGo()) console.log(line);
}
finish(failed.length > 0 || unrecorded.length > 0);
