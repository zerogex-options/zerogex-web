// What the wall-alert email worker does with each queued row — pure, so every
// rule is unit-tested without a database or a mail server
// (tests/wallAlerts.test.ts). scripts/wall-alerts-deliver.mts does the I/O.
//
// Each member's rows become ONE email (up to MAX_ALERTS_PER_EMAIL): SPX and SPY
// walls routinely fire within the same minute, and two emails seconds apart is
// the noise this feature exists to remove. Rows that must not be sent are
// resolved here too, each with the reason an operator will read in
// `make wall-alerts-health`.
//
// NO '@/' ALIAS: imported by a --experimental-strip-types script.

import { AUTH_TIERS, normalizeTier } from './auth.ts';
import type { QueuedWallAlert } from './wallAlertsServer.ts';

export const MAX_ALERTS_PER_EMAIL = 10;

const RANK = new Map<string, number>(AUTH_TIERS.map((t) => [t.id, t.rank]));

/**
 * Does this plan include wall alerts (Basic and up)?
 *
 * By rank directly — NOT core/auth.ts hasTierAccess, which answers true for
 * everyone when NEXT_PUBLIC_AUTH_ENABLED is not '1' (its dev-mode bypass). This
 * runs in a cron script whose environment is whatever .env.local happens to
 * hold; an entitlement check that silently passes on a missing flag would mail
 * lapsed members.
 */
export function tierIncludesWallAlerts(tier: string | null | undefined): boolean {
  return (RANK.get(normalizeTier(tier)) ?? 0) >= (RANK.get('basic') ?? Infinity);
}

export interface DeliveryUser {
  id: string;
  email: string;
  email_verified_at: string | null;
  tier: string | null;
  deleted_at: string | null;
}

export type WallAlertDisposition =
  | { action: 'send'; user: DeliveryUser; rows: QueuedWallAlert[] }
  | { action: 'cancel'; rows: QueuedWallAlert[]; reason: string; purgeUser?: string };

/**
 * Decide every queued row's fate.
 *
 * * **Unknown member** (no `users` row): cancelled, never purged. An unknown id
 *   is as likely a misconfigured AUTH_DB_PATH as a vanished account, and
 *   purging on it would wipe every member's alerts the day the path is wrong.
 * * **Deleted account**: cancelled, and the member's rules are purged — they
 *   asked to be forgotten.
 * * **Plan without wall alerts** (below Basic, e.g. lapsed): cancelled, rules
 *   kept, so alerts resume by themselves if they resubscribe.
 * * **Unverified email**: cancelled. Paid checkout requires verification, so
 *   this is rare, and mailing an unproven address is how a domain earns spam
 *   complaints.
 * * **Duplicates**: a member with overlapping rules (say SPX on two
 *   sensitivities) can have the same wall event queued twice in one pass;
 *   the second is cancelled rather than shown twice in one email.
 */
export function planWallAlertDeliveries(
  rows: readonly QueuedWallAlert[],
  usersById: ReadonlyMap<string, DeliveryUser>,
  maxPerEmail = MAX_ALERTS_PER_EMAIL,
): WallAlertDisposition[] {
  const byUser = new Map<string, QueuedWallAlert[]>();
  for (const row of rows) {
    const list = byUser.get(row.end_user);
    if (list) list.push(row);
    else byUser.set(row.end_user, [row]);
  }

  const out: WallAlertDisposition[] = [];
  for (const [userId, userRows] of byUser) {
    const sorted = [...userRows].sort(
      (a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id - b.id,
    );
    const user = usersById.get(userId);
    if (!user) {
      out.push({ action: 'cancel', rows: sorted, reason: 'unknown recipient' });
      continue;
    }
    if (user.deleted_at) {
      out.push({ action: 'cancel', rows: sorted, reason: 'account deleted', purgeUser: userId });
      continue;
    }
    if (!tierIncludesWallAlerts(user.tier)) {
      out.push({ action: 'cancel', rows: sorted, reason: 'plan does not include wall alerts' });
      continue;
    }
    if (!user.email_verified_at) {
      out.push({ action: 'cancel', rows: sorted, reason: 'email not verified' });
      continue;
    }

    const seen = new Set<string>();
    const unique: QueuedWallAlert[] = [];
    const dupes: QueuedWallAlert[] = [];
    for (const row of sorted) {
      const p = row.payload;
      const key = `${p.symbol}|${p.side}|${p.wall}|${p.kind}`;
      if (seen.has(key)) dupes.push(row);
      else {
        seen.add(key);
        unique.push(row);
      }
    }
    if (dupes.length) out.push({ action: 'cancel', rows: dupes, reason: 'duplicate in batch' });
    for (let i = 0; i < unique.length; i += maxPerEmail) {
      out.push({ action: 'send', user, rows: unique.slice(i, i + maxPerEmail) });
    }
  }
  return out;
}

// ── Worker state between passes ─────────────────────────────────────────────
//
// The worker runs every 20 seconds, so two failure modes that are harmless in a
// daily sweep become floods here. State persisted between passes (a small JSON
// file beside the auth DB) handles both:
//
// * **Failure reports.** The shared OnFailure= alerter is deliberately
//   unthrottled, so a worker that exited non-zero on every failing pass would
//   mail the operator up to 180 times an hour. Each kind of failure is
//   reported (non-zero exit) at most once per REPORT_EVERY_MS instead, and
//   every other failing pass exits 0 with the reason in the journal. An
//   unreachable outbox is reported only once it has stayed unreachable for
//   OUTBOX_GRACE_MS, so an API restart (seconds) never pages anyone.
// * **Duplicate sends.** A row whose email Resend accepted but whose mark-sent
//   did not land stays queued on the backend, and would be emailed again on
//   the next pass, and on every pass for as long as marking kept failing. The
//   worker records each accepted send first; a recorded row is only ever
//   re-marked, never re-sent.

/**
 * What kept a pass from doing its job. `outbox`: the backend did not answer.
 * `config`: a required setting is missing. `auth-db`: the member database
 * could not be read. `resend`: every email in the pass was refused for good
 * (a revoked key, a bad sender). `crash`: anything unexpected.
 */
export type WorkerFailure = 'outbox' | 'config' | 'auth-db' | 'resend' | 'crash';

const FAILURES: readonly WorkerFailure[] = ['outbox', 'config', 'auth-db', 'resend', 'crash'];

export interface WorkerState {
  /** When the outbox first failed to answer, while it keeps failing. */
  outageSince: string | null;
  /** Each failure kind's last report (non-zero exit), until that step works again. */
  reportedAt: Partial<Record<WorkerFailure, string>>;
  /** Row id → when Resend accepted its email, until mark-sent lands. */
  sentAwaitingMark: Record<string, string>;
}

export const OUTBOX_GRACE_MS = 5 * 60_000;
export const REPORT_EVERY_MS = 60 * 60_000;
// The backend expires a queued row 20 minutes after it was queued, so a sent
// row cannot come back as queued an hour later.
export const SENT_LEDGER_TTL_MS = 60 * 60_000;

export function emptyWorkerState(): WorkerState {
  return { outageSince: null, reportedAt: {}, sentAwaitingMark: {} };
}

function isoOrNull(v: unknown): string | null {
  return typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null;
}

/** Parse the state file's contents; anything unreadable is a fresh state. */
export function parseWorkerState(raw: string | null | undefined): WorkerState {
  if (!raw) return emptyWorkerState();
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return emptyWorkerState();
  }
  if (!obj || typeof obj !== 'object') return emptyWorkerState();
  const o = obj as Record<string, unknown>;
  const state = emptyWorkerState();
  state.outageSince = isoOrNull(o.outageSince);
  if (o.reportedAt && typeof o.reportedAt === 'object') {
    const reported = o.reportedAt as Record<string, unknown>;
    for (const kind of FAILURES) {
      const at = isoOrNull(reported[kind]);
      if (at) state.reportedAt[kind] = at;
    }
  }
  if (o.sentAwaitingMark && typeof o.sentAwaitingMark === 'object') {
    for (const [id, at] of Object.entries(o.sentAwaitingMark as Record<string, unknown>)) {
      const when = isoOrNull(at);
      if (/^\d+$/.test(id) && when) state.sentAwaitingMark[id] = when;
    }
  }
  return state;
}

/** A pass failed. `report` = exit non-zero, so OnFailure= mails the operator. */
export function noteFailure(
  state: WorkerState,
  kind: WorkerFailure,
  now: Date,
  graceMs = OUTBOX_GRACE_MS,
  everyMs = REPORT_EVERY_MS,
): { state: WorkerState; report: boolean } {
  let next = state;
  if (kind === 'outbox') {
    const since = state.outageSince ?? now.toISOString();
    next = { ...next, outageSince: since };
    if (now.getTime() - Date.parse(since) < graceMs) return { state: next, report: false };
  }
  const last = state.reportedAt[kind];
  const report = !last || now.getTime() - Date.parse(last) >= everyMs;
  if (report) next = { ...next, reportedAt: { ...next.reportedAt, [kind]: now.toISOString() } };
  return { state: next, report };
}

/** The step behind `kind` worked again: its next failure is reported without waiting out the hour. */
export function clearFailure(state: WorkerState, kind: WorkerFailure): WorkerState {
  if (!state.reportedAt[kind] && !(kind === 'outbox' && state.outageSince)) return state;
  const reportedAt = { ...state.reportedAt };
  delete reportedAt[kind];
  return { ...state, reportedAt, outageSince: kind === 'outbox' ? null : state.outageSince };
}

/** How long the outbox had been failing before this answer, or null if it had not. */
export function outageLengthMs(state: WorkerState, now: Date): number | null {
  return state.outageSince ? Math.max(0, now.getTime() - Date.parse(state.outageSince)) : null;
}

export function recordSent(state: WorkerState, ids: readonly number[], at: Date): WorkerState {
  const sentAwaitingMark = { ...state.sentAwaitingMark };
  for (const id of ids) sentAwaitingMark[String(id)] = at.toISOString();
  return { ...state, sentAwaitingMark };
}

export function forgetSent(state: WorkerState, ids: readonly number[]): WorkerState {
  const sentAwaitingMark = { ...state.sentAwaitingMark };
  for (const id of ids) delete sentAwaitingMark[String(id)];
  return { ...state, sentAwaitingMark };
}

export function pruneSentLedger(state: WorkerState, now: Date, ttlMs = SENT_LEDGER_TTL_MS): WorkerState {
  const sentAwaitingMark: Record<string, string> = {};
  for (const [id, at] of Object.entries(state.sentAwaitingMark)) {
    if (now.getTime() - Date.parse(at) < ttlMs) sentAwaitingMark[id] = at;
  }
  return { ...state, sentAwaitingMark };
}

/** Rows already emailed (re-mark only) apart from rows still to plan. */
export function splitAlreadySent<R extends { id: number }>(
  rows: readonly R[],
  state: WorkerState,
): { alreadySent: R[]; fresh: R[] } {
  const alreadySent: R[] = [];
  const fresh: R[] = [];
  for (const row of rows) {
    if (state.sentAwaitingMark[String(row.id)]) alreadySent.push(row);
    else fresh.push(row);
  }
  return { alreadySent, fresh };
}
