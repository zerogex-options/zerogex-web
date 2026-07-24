import 'server-only';

/**
 * Server-only client for the ZeroGEX backend's X-post review endpoints
 * (`/api/admin/x-post/*`). These back the `/admin/x-post` review page: fetch
 * the last auto-generated post (per timing + symbol), list the configured
 * tickers, and regenerate on demand.
 *
 * Like the key-administration endpoints, these are held to a stricter bar than
 * the read APIs: every call carries BOTH the normal
 * `Authorization: Bearer <ZEROGEX_API_TOKEN>` (the backend's global API-key
 * auth) AND an `X-Admin-Token` shared secret, deliberately separate from the
 * widely-distributed read token.
 *
 * Env:
 *   ZEROGEX_API_BASE_URL  — backend base URL. Default http://127.0.0.1:8000.
 *   ZEROGEX_API_TOKEN     — bearer key (legacy ZEROGEX_API_KEY accepted).
 *   ZEROGEX_ADMIN_TOKEN   — admin shared secret; MUST match the backend's
 *                           KEY_ADMIN_TOKEN. When unset, the review page
 *                           degrades gracefully.
 */

const UPSTREAM_BASE = (
  process.env.ZEROGEX_API_BASE_URL || 'http://127.0.0.1:8000'
).replace(/\/+$/, '');

const BASE_PATH = '/api/admin/x-post';

export class XPostAdminError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'XPostAdminError';
    this.status = status;
  }
}

export type XPostHeadline = {
  title: string;
  summary?: string;
  source?: string;
  link?: string | null;
  published?: string | null;
};

export type XPostRecord = {
  mode: string;
  timing_label: string;
  symbol: string;
  date: string;
  generated_at: string | null;
  post_text: string;
  reply_text: string;
  fallback_text: string;
  headlines: XPostHeadline[];
  levels: Record<string, number | string | null> | null;
  media: { png: string | null; clip: string | null };
};

export type XPostEnvelope = {
  symbol: string;
  mode: string;
  timing_label: string;
  record: XPostRecord | null;
};

export type XPostSymbols = { symbols: string[]; default: string };

/** True when both the bearer token and the admin secret are configured. */
export function isXPostAdminConfigured(): boolean {
  const bearer = process.env.ZEROGEX_API_TOKEN || process.env.ZEROGEX_API_KEY;
  return !!bearer && !!process.env.ZEROGEX_ADMIN_TOKEN;
}

async function adminFetch<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<T> {
  const bearer = process.env.ZEROGEX_API_TOKEN || process.env.ZEROGEX_API_KEY;
  const adminToken = process.env.ZEROGEX_ADMIN_TOKEN;
  if (!bearer) {
    throw new XPostAdminError('ZEROGEX_API_TOKEN is not configured on the server', 500);
  }
  if (!adminToken) {
    throw new XPostAdminError('ZEROGEX_ADMIN_TOKEN is not configured on the server', 500);
  }

  let res: Response;
  try {
    res = await fetch(`${UPSTREAM_BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        'X-Admin-Token': adminToken,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new XPostAdminError(`Could not reach the X-post service: ${message}`, 502);
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 200).replace(/\s+/g, ' ').trim();
    } catch {
      /* body unreadable — status alone still helps */
    }
    throw new XPostAdminError(
      `X-post service returned ${res.status}${detail ? ` — ${detail}` : ''}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

/** The configured ticker list + default for the regenerate dropdown. */
export function getXPostSymbols(): Promise<XPostSymbols> {
  return adminFetch<XPostSymbols>(`${BASE_PATH}/symbols`, { method: 'GET' });
}

/** The last auto-generated post for (symbol, timing). `record` may be null. */
export function getLatestXPost(
  symbol?: string,
  mode?: string,
): Promise<XPostEnvelope> {
  const params = new URLSearchParams();
  if (symbol) params.set('symbol', symbol);
  if (mode) params.set('mode', mode);
  const qs = params.toString();
  return adminFetch<XPostEnvelope>(`${BASE_PATH}/latest${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
}

/** Regenerate the post+reply for (symbol, mode) and return the fresh record. */
export function regenerateXPost(
  symbol?: string,
  mode?: string,
): Promise<XPostEnvelope> {
  return adminFetch<XPostEnvelope>(`${BASE_PATH}/regenerate`, {
    method: 'POST',
    body: { symbol, mode },
  });
}
