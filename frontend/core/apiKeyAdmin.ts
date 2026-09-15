/**
 * The ZeroGEX backend's key-administration client, WITHOUT the `server-only`
 * guard — so maintenance scripts can reach it too.
 *
 * core/apiKeys.ts is the server-only entry point and re-exports everything
 * here; app code should keep importing that one. This split exists for the same
 * reason core/apiKeyNaming.ts does: `import 'server-only'` throws outside a
 * React Server Component environment, and `@/`-aliased specifiers do not
 * resolve under plain `node`, so a module carrying either is unreachable from
 * scripts/. Key revocation has to be callable from both sides — every tier
 * downgrade must deprovision keys, and some downgrades happen in a cron script
 * rather than in a request — and duplicating the admin-auth contract in a
 * script is how the two copies drift.
 *
 * Nothing client-side imports this module directly. Reaching it through
 * core/apiKeys.ts still trips the server-only guard, so the protection that
 * matters is unchanged.
 */

import { isApiKeyEligibleTier, type TierId } from './auth.ts';
import { emailLocalPart } from './apiKeyNaming.ts';

export { emailLocalPart };

/**
 * Server-only client for the ZeroGEX backend's key-administration endpoints
 * (`/api/admin/api-keys/*`). This is how the website's self-service "Generate
 * API Key" button actually mints, lists, and revokes the per-user keys that
 * live in the backend's `api_keys` table — the same rows `make api-keys-create`
 * writes, but driven over HTTP so the colocated FastAPI service stays the sole
 * owner of the credential store.
 *
 * These endpoints are held to a stricter bar than the read APIs: every call
 * carries BOTH the normal `Authorization: Bearer <ZEROGEX_API_TOKEN>` (which
 * satisfies the backend's global API-key auth) AND an `X-Admin-Token`
 * shared secret. The admin secret is deliberately separate from the
 * widely-distributed read token so credential minting can't ride on it.
 *
 * Env:
 *   ZEROGEX_API_BASE_URL  — backend base URL. Default http://127.0.0.1:8000.
 *   ZEROGEX_API_TOKEN     — bearer key (legacy ZEROGEX_API_KEY accepted).
 *   ZEROGEX_ADMIN_TOKEN   — admin shared secret; MUST match the backend's
 *                           KEY_ADMIN_TOKEN. When unset, key administration is
 *                           unavailable (the account UI degrades gracefully).
 */

const UPSTREAM_BASE = (
  process.env.ZEROGEX_API_BASE_URL || 'http://127.0.0.1:8000'
).replace(/\/+$/, '');

const ADMIN_PATH = '/api/admin/api-keys';

// The backend tier bundle minted for a Pro member's key: derived analytics +
// the signal engine (no raw market data). Scope enforcement is off today, so
// this is forward-looking, but it records the correct entitlement now.
const PRO_KEY_TIER = 'signals';

export class ApiKeyAdminError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiKeyAdminError';
    this.status = status;
  }
}

export type ProvisionedKey = {
  // The raw secret — present exactly once, on the provision response.
  apiKey: string;
  name: string;
  prefix: string;
  createdAt: string | null;
};

export type ApiKeyInfo = {
  name: string;
  prefix: string;
  createdAt: string | null;
  lastUsedAt: string | null;
};

/** True when both the bearer token and the admin secret are configured. */
export function isApiKeyAdminConfigured(): boolean {
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
    throw new ApiKeyAdminError('ZEROGEX_API_TOKEN is not configured on the server', 500);
  }
  if (!adminToken) {
    throw new ApiKeyAdminError('ZEROGEX_ADMIN_TOKEN is not configured on the server', 500);
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
    throw new ApiKeyAdminError(`Could not reach the key service: ${message}`, 502);
  }

  if (!res.ok) {
    // Surface the backend's detail (e.g. 403 "admin token required") without
    // leaking either secret. Truncate defensively.
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 200).replace(/\s+/g, ' ').trim();
    } catch {
      /* body unreadable — status alone still helps */
    }
    throw new ApiKeyAdminError(
      `Key service returned ${res.status}${detail ? ` — ${detail}` : ''}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

/**
 * Mint a fresh key for the user, revoking any existing active key first
 * (regenerate semantics — at most one active key per user). Returns the raw
 * secret, which the caller must show exactly once and never persist.
 */
export async function provisionApiKey(email: string): Promise<ProvisionedKey> {
  const data = await adminFetch<{
    name: string;
    prefix: string;
    created_at: string | null;
    api_key: string;
  }>(`${ADMIN_PATH}/provision`, {
    method: 'POST',
    body: {
      user_id: email,
      base_name: emailLocalPart(email),
      tier: PRO_KEY_TIER,
      revoke_existing: true,
    },
  });
  return {
    apiKey: data.api_key,
    name: data.name,
    prefix: data.prefix,
    createdAt: data.created_at,
  };
}

/**
 * Return the user's current active key metadata (never the secret), or null
 * if they have none. If more than one is somehow active, the most recently
 * created wins.
 */
export async function getActiveApiKey(email: string): Promise<ApiKeyInfo | null> {
  const data = await adminFetch<{
    keys: Array<{
      name: string;
      prefix: string;
      created_at: string | null;
      last_used_at: string | null;
    }>;
  }>(`${ADMIN_PATH}?user_id=${encodeURIComponent(email)}&active_only=true`, {
    method: 'GET',
  });
  const keys = data.keys ?? [];
  if (keys.length === 0) return null;
  const latest = keys[keys.length - 1];
  return {
    name: latest.name,
    prefix: latest.prefix,
    createdAt: latest.created_at,
    lastUsedAt: latest.last_used_at,
  };
}

/** Revoke every active key for the user. Returns how many were revoked. */
export async function revokeAllApiKeys(email: string): Promise<number> {
  const data = await adminFetch<{ revoked: number }>(`${ADMIN_PATH}/revoke-all`, {
    method: 'POST',
    body: { user_id: email },
  });
  return data.revoked ?? 0;
}

/**
 * What a tier-drop revocation actually did. Three outcomes, kept DISTINCT
 * because two of them used to be the same `null` and that cost us live keys:
 *
 *   not-a-drop    the transition doesn't leave API-key eligibility. Routine,
 *                 the overwhelming majority of calls, nothing to say.
 *   unconfigured  it IS a drop, but key administration isn't configured on this
 *                 deploy, so nothing was revoked and the member's key stays
 *                 live. Nothing else in the system will notice this.
 *   revoked       the drop was honored; `revoked` is how many keys went.
 *
 * Collapsing the first two into `null` meant a caller writing
 * `if (result && result.revoked > 0)` logged nothing in either case, so a
 * deploy missing ZEROGEX_ADMIN_TOKEN churned members out of Pro and left their
 * keys authenticating, silently and indistinguishably from a clean run. Two
 * such keys survived from June 2026 and were only found by auditing the key
 * service against the user table months later. A union makes the caller choose,
 * and makes the dangerous branch impossible to leave unhandled by accident.
 */
export type TierDropRevocation =
  | { status: 'not-a-drop' }
  | { status: 'unconfigured' }
  | { status: 'revoked'; revoked: number };

/**
 * Auto-deprovision a member's API keys when their tier drops out of API-key
 * eligibility (i.e. they leave Pro). Throws on an upstream failure so the
 * caller can log it; callers treat this as best-effort and must not let a
 * failure unwind the tier change itself. Callers SHOULD record the
 * 'unconfigured' outcome — it is the one that leaves a credential live.
 */
export async function revokeApiKeysIfTierDropped(
  email: string,
  previousTier: TierId,
  nextTier: TierId,
): Promise<TierDropRevocation> {
  if (!isApiKeyEligibleTier(previousTier) || isApiKeyEligibleTier(nextTier)) {
    return { status: 'not-a-drop' };
  }
  if (!isApiKeyAdminConfigured()) return { status: 'unconfigured' };
  const revoked = await revokeAllApiKeys(email);
  return { status: 'revoked', revoked };
}
