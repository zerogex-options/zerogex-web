import 'server-only';

import { isApiKeyEligibleTier, TierId } from '@/core/auth';
import { emailLocalPart, resolveKeyLabel } from '@/core/apiKeyNaming';
import { MAX_ACTIVE_API_KEYS } from '@/core/apiKeyLimits';

export { emailLocalPart, MAX_ACTIVE_API_KEYS };

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
  id: number;
  name: string;
  prefix: string;
  createdAt: string | null;
};

export type RevokedKey = {
  id: number;
  name: string;
  prefix: string;
};

export type ApiKeyInfo = {
  // The key service's row id. Needed to revoke this key and not another —
  // names are unique per user, but ids are what the revoke endpoint takes.
  id: number;
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
 * Mint a fresh key for the user, leaving their existing keys alone. Returns
 * the raw secret, which the caller must show exactly once and never persist.
 *
 * `revoke_existing: false` is sent explicitly even though the key service now
 * defaults to it. That flag defaulting the other way is exactly what made
 * putting a key on a second machine silently kill the first, so this call site
 * states which behaviour it wants rather than inheriting it — and it keeps
 * working if the website deploys ahead of the key service.
 *
 * `label` is the user's name for the machine ("laptop"); their email
 * local-part is used when they don't give one. The key service picks the
 * final stored `name` from it — appending `-1`, `-2`, … if that label was
 * used before — so callers must display the returned `name`, not the label
 * they sent.
 *
 * Throws `ApiKeyAdminError` with status 409 when the user is already at
 * `MAX_ACTIVE_API_KEYS`.
 */
export async function provisionApiKey(email: string, label?: string): Promise<ProvisionedKey> {
  const data = await adminFetch<{
    id: number;
    name: string;
    prefix: string;
    created_at: string | null;
    api_key: string;
  }>(`${ADMIN_PATH}/provision`, {
    method: 'POST',
    body: {
      user_id: email,
      base_name: resolveKeyLabel(email, label),
      tier: PRO_KEY_TIER,
      revoke_existing: false,
    },
  });
  return {
    apiKey: data.api_key,
    id: data.id,
    name: data.name,
    prefix: data.prefix,
    createdAt: data.created_at,
  };
}

/**
 * Return metadata for every key the user currently has active (never the
 * secret), oldest first — the order the key service returns them in, which is
 * creation order. An empty array means they hold none.
 */
export async function listActiveApiKeys(email: string): Promise<ApiKeyInfo[]> {
  const data = await adminFetch<{
    keys: Array<{
      id: number;
      name: string;
      prefix: string;
      created_at: string | null;
      last_used_at: string | null;
    }>;
  }>(`${ADMIN_PATH}?user_id=${encodeURIComponent(email)}&active_only=true`, {
    method: 'GET',
  });
  return (data.keys ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    createdAt: k.created_at,
    lastUsedAt: k.last_used_at,
  }));
}

/**
 * Revoke ONE of the user's keys, leaving the rest working. Resolves to the
 * revoked key's metadata, or null when there was nothing to revoke — the id
 * doesn't exist, isn't this user's, or was already revoked. Callers get the
 * name back so they can say which key went without a second round trip.
 *
 * Passing `email` is not redundant with the id: the key service scopes its
 * UPDATE by user, so an id belonging to someone else revokes nothing rather
 * than revoking their key.
 */
export async function revokeApiKey(email: string, keyId: number): Promise<RevokedKey | null> {
  const data = await adminFetch<{
    revoked: boolean;
    key: { id: number; name: string; prefix: string } | null;
  }>(`${ADMIN_PATH}/revoke`, {
    method: 'POST',
    body: { user_id: email, key_id: keyId },
  });
  if (!data.revoked || !data.key) return null;
  return { id: data.key.id, name: data.key.name, prefix: data.key.prefix };
}

/**
 * Revoke every active key for the user. Returns how many were revoked.
 *
 * The all-or-nothing path, still: losing Pro or deleting the account takes
 * every key the user holds, however many that is. To retire one machine, use
 * {@link revokeApiKey}.
 */
export async function revokeAllApiKeys(email: string): Promise<number> {
  const data = await adminFetch<{ revoked: number }>(`${ADMIN_PATH}/revoke-all`, {
    method: 'POST',
    body: { user_id: email },
  });
  return data.revoked ?? 0;
}

/**
 * Auto-deprovision a member's API keys when their tier drops out of API-key
 * eligibility (i.e. they leave Pro). No-op — returning null — when the
 * transition isn't a drop, or when key administration isn't configured on this
 * deploy. Throws on an upstream failure so the caller can log it; callers treat
 * this as best-effort and must not let a failure unwind the tier change itself.
 */
export async function revokeApiKeysIfTierDropped(
  email: string,
  previousTier: TierId,
  nextTier: TierId,
): Promise<{ revoked: number } | null> {
  if (!isApiKeyEligibleTier(previousTier) || isApiKeyEligibleTier(nextTier)) {
    return null;
  }
  if (!isApiKeyAdminConfigured()) return null;
  const revoked = await revokeAllApiKeys(email);
  return { revoked };
}
