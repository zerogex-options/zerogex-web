// Server-side helpers for wall alerts: the signed one-click unsubscribe link,
// and the admin-gated calls to the backend's wall-alert outbox.
//
// NO `server-only` AND NO '@/' ALIAS: the delivery worker
// (scripts/wall-alerts-deliver.mts) imports this under
// --experimental-strip-types, outside Next — the same constraint
// core/apiKeyAdmin.ts documents. Nothing client-side imports it.
//
// The outbox endpoints (/api/alerts/walls/internal/*) carry other members'
// alerts, so the backend requires X-Admin-Token on top of the bearer key —
// the bearer key alone is held by every external integrator. Same credential
// pair core/apiKeyAdmin.ts sends.
//
// Env:
//   ZEROGEX_API_BASE_URL  — backend base URL. Default http://127.0.0.1:8000.
//   ZEROGEX_API_TOKEN     — bearer key (legacy ZEROGEX_API_KEY accepted).
//   ZEROGEX_ADMIN_TOKEN   — must match the backend's KEY_ADMIN_TOKEN.
//   ZEROGEX_END_USER_TOKEN_SECRET — signs the unsubscribe links.

import { createHmac, timingSafeEqual } from 'crypto';

import type { WallAlertPayload } from './wallAlerts.ts';

// ── One-click unsubscribe ───────────────────────────────────────────────────

// Namespaced apart from core/unsubToken.ts (`unsub:v1:`), so a wall-alert link
// can never be replayed against the marketing opt-out or the reverse: they are
// different promises to the member.
function unsubSecret(): string {
  const s = process.env.ZEROGEX_END_USER_TOKEN_SECRET;
  if (!s) throw new Error('ZEROGEX_END_USER_TOKEN_SECRET is not set');
  return s;
}

export function wallAlertsUnsubToken(userId: string): string {
  return createHmac('sha256', unsubSecret()).update(`wall-alerts-unsub:v1:${userId}`).digest('base64url');
}

export function verifyWallAlertsUnsubToken(userId: string | null, token: string | null): boolean {
  if (!userId || !token) return false;
  const expected = Buffer.from(wallAlertsUnsubToken(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function buildWallAlertsUnsubUrl(appUrl: string, userId: string): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}/alerts/unsubscribe?u=${encodeURIComponent(userId)}&t=${wallAlertsUnsubToken(userId)}`;
}

// ── Outbox client ───────────────────────────────────────────────────────────

export interface QueuedWallAlert {
  id: number;
  end_user: string;
  channel: 'email' | 'sms';
  attempts: number;
  created_at: string | null;
  rule_id: number | null;
  event_id: number;
  symbol: string;
  side: 'call' | 'put';
  kind: 'hit' | 'break' | 'hold';
  wall: number | null;
  price: number | null;
  payload: WallAlertPayload;
}

export type MarkStatus = 'sent' | 'failed' | 'retry' | 'cancelled';

export class WallAlertsAdminError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'WallAlertsAdminError';
    this.status = status;
  }
}

export interface WallAlertsAdminEnv {
  baseUrl: string;
  apiToken: string;
  adminToken: string;
}

/** Read the outbox credentials; null when either secret is missing. */
export function wallAlertsAdminEnv(env: Record<string, string | undefined> = process.env): WallAlertsAdminEnv | null {
  const apiToken = env.ZEROGEX_API_TOKEN || env.ZEROGEX_API_KEY || '';
  const adminToken = env.ZEROGEX_ADMIN_TOKEN || '';
  if (!apiToken || !adminToken) return null;
  return {
    baseUrl: (env.ZEROGEX_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, ''),
    apiToken,
    adminToken,
  };
}

async function call<T>(env: WallAlertsAdminEnv, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${env.baseUrl}/api/alerts/walls/internal${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.apiToken}`,
        'X-Admin-Token': env.adminToken,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch (err) {
    throw new WallAlertsAdminError(`wall-alerts backend unreachable: ${(err as Error).message}`);
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {
      /* body unreadable — the status alone still helps */
    }
    throw new WallAlertsAdminError(`wall-alerts ${path} HTTP ${res.status}${detail ? `: ${detail}` : ''}`, res.status);
  }
  return (await res.json()) as T;
}

export function fetchQueuedWallAlerts(
  env: WallAlertsAdminEnv,
  channel: 'email' | 'sms',
  limit = 200,
): Promise<{ entries: QueuedWallAlert[]; expired: number; cancelled: number }> {
  return call(env, 'GET', `/queued?channel=${channel}&limit=${limit}`);
}

export function markWallAlerts(
  env: WallAlertsAdminEnv,
  ids: number[],
  status: MarkStatus,
  error?: string,
): Promise<{ updated: number }> {
  return call(env, 'POST', '/mark', { ids, status, ...(error ? { error: error.slice(0, 400) } : {}) });
}

export function disableWallAlertChannel(
  env: WallAlertsAdminEnv,
  endUser: string,
  channel: 'email' | 'sms',
): Promise<{ rules_updated: number; cancelled_queued: number }> {
  return call(env, 'POST', '/disable-channel', { end_user: endUser, channel });
}

export function purgeWallAlertsForUser(
  env: WallAlertsAdminEnv,
  endUser: string,
): Promise<{ rules_deleted: number; deliveries_deleted: number }> {
  return call(env, 'POST', '/purge-user', { end_user: endUser });
}
