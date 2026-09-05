// Google Search Console → the `google_clicks` / `google_impressions` columns of
// the daily metrics rollup, so that half of the acquisition picture keeps itself
// up to date instead of waiting on someone to paste a CSV.
//
// Deliberately NOT marked `server-only` and using relative imports, for the same
// reason core/dailyMetrics.ts isn't: scripts/sync-search-console.mts loads this
// directly under bare Node, where that guard throws and the "@/" alias does not
// resolve.
//
// ── Auth ────────────────────────────────────────────────────────────────────
// A Google service account, added as a user on the Search Console property.
// There is no interactive consent and no refresh token to rotate: we sign a JWT
// with the service account's private key, trade it for a one-hour access token,
// and use that. `jose` (already a dependency, used by the session layer) does
// the RS256 signing.
//
// ── A day is not the same day ───────────────────────────────────────────────
// Search Console buckets its days in Pacific time; everything else in this table
// buckets in America/New_York (see core/dailyMetricsMath.etDayKey). Daily
// aggregates cannot be re-bucketed after the fact, so the two axes sit three
// hours apart. That is a constant misalignment rather than a bias — it blurs a
// same-day correlation slightly toward zero, so a reported same-day r is a floor,
// not a ceiling. Not worth "fixing" by shifting a whole series; worth knowing
// before reading too much into a marginal same-day result.

import { SignJWT, importPKCS8 } from 'jose';
import { etDayKey } from './dailyMetricsMath.ts';
import type { ExternalMetricRow } from './dailyMetricsCsv.ts';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SEARCH_CONSOLE_BASE = 'https://searchconsole.googleapis.com/webmasters/v3';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

/** Search Console keeps ~16 months; asking for more is silently truncated. */
export const MAX_LOOKBACK_DAYS = 490;
/** API maximum. One row per day, so even a full backfill is a single page. */
const ROW_LIMIT = 25_000;
/** Default trailing window for a scheduled run — see `syncSearchConsole`. */
export const DEFAULT_SYNC_DAYS = 14;

const DAY_MS = 86_400_000;

export class SearchConsoleError extends Error {
  /** HTTP status when the failure came from Google, else undefined. */
  status?: number;
  /** True when the cause is missing/blank configuration rather than a failure. */
  unconfigured: boolean;
  constructor(message: string, opts: { status?: number; unconfigured?: boolean } = {}) {
    super(message);
    this.name = 'SearchConsoleError';
    this.status = opts.status;
    this.unconfigured = opts.unconfigured ?? false;
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type ServiceAccount = { clientEmail: string; privateKey: string };

/**
 * Pull the two fields we need out of a service-account key JSON. Everything
 * else in that file (project_id, key_id, the various URIs) is irrelevant here.
 */
export function parseServiceAccount(raw: string): ServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SearchConsoleError('Service account key is not valid JSON.');
  }
  const obj = parsed as { client_email?: unknown; private_key?: unknown; type?: unknown };
  const clientEmail = typeof obj.client_email === 'string' ? obj.client_email.trim() : '';
  const privateKey = typeof obj.private_key === 'string' ? obj.private_key : '';
  if (!clientEmail || !privateKey) {
    throw new SearchConsoleError(
      'Service account key is missing client_email or private_key — download the JSON key again from the Google Cloud console.',
    );
  }
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new SearchConsoleError('Service account private_key is not a PKCS#8 PEM block.');
  }
  return {
    clientEmail,
    // A key pasted through a shell or an .env file usually arrives with its
    // newlines escaped; PEM parsing needs them back.
    privateKey: privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey,
  };
}

export type SearchConsoleConfig = {
  siteUrl: string;
  serviceAccount: ServiceAccount;
  dataState: 'all' | 'final';
};

/**
 * Resolve config from the environment, or explain precisely what is missing.
 * `readFile` is injected so this stays testable and so the module doesn't pull
 * in node:fs for the (common) inline-JSON case.
 */
/** Loose env shape on purpose: the app's ProcessEnv type demands NODE_ENV, and
 *  callers here legitimately pass a bare object of just the GSC_* keys. */
export type EnvLike = Record<string, string | undefined>;

export function resolveConfig(
  env: EnvLike = process.env,
  readFile?: (path: string) => string,
): SearchConsoleConfig {
  const siteUrl = (env.GSC_SITE_URL ?? '').trim();
  if (!siteUrl) {
    throw new SearchConsoleError(
      'GSC_SITE_URL is not set. Use the property exactly as Search Console names it — "sc-domain:example.com" for a Domain property, or the full "https://example.com/" for a URL-prefix property.',
      { unconfigured: true },
    );
  }

  const inline = (env.GSC_SERVICE_ACCOUNT_JSON ?? '').trim();
  const keyFile = (env.GSC_SERVICE_ACCOUNT_KEY_FILE ?? '').trim();
  let raw = inline;
  if (!raw && keyFile) {
    if (!readFile) throw new SearchConsoleError('No file reader available for GSC_SERVICE_ACCOUNT_KEY_FILE.');
    try {
      raw = readFile(keyFile);
    } catch {
      throw new SearchConsoleError(`Could not read GSC_SERVICE_ACCOUNT_KEY_FILE at ${keyFile}.`, {
        unconfigured: true,
      });
    }
  }
  if (!raw) {
    throw new SearchConsoleError(
      'No Search Console credentials. Set GSC_SERVICE_ACCOUNT_KEY_FILE to the path of a service-account JSON key (or GSC_SERVICE_ACCOUNT_JSON to its contents).',
      { unconfigured: true },
    );
  }

  const dataState = env.GSC_DATA_STATE === 'final' ? 'final' : 'all';
  return { siteUrl, serviceAccount: parseServiceAccount(raw), dataState };
}

/** True when enough is configured to attempt a sync. Never throws. */
export function isSearchConsoleConfigured(env: EnvLike = process.env): boolean {
  return Boolean(
    (env.GSC_SITE_URL ?? '').trim() &&
      ((env.GSC_SERVICE_ACCOUNT_JSON ?? '').trim() || (env.GSC_SERVICE_ACCOUNT_KEY_FILE ?? '').trim()),
  );
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

/**
 * The inclusive list of 'YYYY-MM-DD' keys ending at `endDay`, oldest first.
 * Pure string/UTC arithmetic — these are calendar labels for the API, not
 * instants, so no timezone enters here.
 */
export function dayRange(endDay: string, days: number): string[] {
  const end = Date.parse(`${endDay}T00:00:00Z`);
  if (Number.isNaN(end)) return [];
  const count = Math.max(1, Math.min(MAX_LOOKBACK_DAYS, Math.floor(days)));
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(new Date(end - i * DAY_MS).toISOString().slice(0, 10));
  }
  return out;
}

/** Today on the ET axis the rest of the rollup uses. */
export function todayKey(now: Date = new Date()): string {
  return etDayKey(now);
}

// ---------------------------------------------------------------------------
// Response mapping
// ---------------------------------------------------------------------------

export type SearchAnalyticsRow = {
  keys?: unknown;
  clicks?: unknown;
  impressions?: unknown;
};

export type MappedRows = {
  rows: ExternalMetricRow[];
  /** Newest day Google actually reported. Null when it returned nothing. */
  reportedThrough: string | null;
  /** Days inside the reported span that Google omitted, written as real zeros. */
  zeroFilled: number;
  /** True when the response filled the API page — the caller should narrow. */
  truncated: boolean;
};

function toCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

/**
 * Turn a searchAnalytics response into rows for the rollup.
 *
 * The subtlety is what to do about days Google leaves out. It omits a day for
 * two very different reasons: the site genuinely had zero impressions (a real
 * zero) or the day is too recent to have been processed (not measured yet).
 * Writing 0 for the second kind would assert "no search traffic" on a day that
 * simply has not been counted, and would poison every correlation that reads
 * the column until the next run overwrote it.
 *
 * So the reported span is bounded by the newest day Google DID return: missing
 * days at or before it are real zeros and get written; anything after it is left
 * untouched, to be picked up once Google catches up. An empty response
 * establishes no span at all and therefore writes nothing.
 */
export function mapSearchAnalyticsRows(
  apiRows: ReadonlyArray<SearchAnalyticsRow>,
  requestedDays: ReadonlyArray<string>,
): MappedRows {
  const byDay = new Map<string, ExternalMetricRow>();
  let reportedThrough: string | null = null;

  for (const row of apiRows) {
    const key = Array.isArray(row.keys) ? row.keys[0] : undefined;
    const day = typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
    if (!day) continue;
    byDay.set(day, {
      day,
      googleClicks: toCount(row.clicks),
      googleImpressions: toCount(row.impressions),
    });
    if (reportedThrough === null || day > reportedThrough) reportedThrough = day;
  }

  let zeroFilled = 0;
  if (reportedThrough !== null) {
    for (const day of requestedDays) {
      if (day > reportedThrough) continue;
      if (byDay.has(day)) continue;
      byDay.set(day, { day, googleClicks: 0, googleImpressions: 0 });
      zeroFilled += 1;
    }
  }

  const rows = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return { rows, reportedThrough, zeroFilled, truncated: apiRows.length >= ROW_LIMIT };
}

/** Turn an API failure into something an operator can act on. */
export function describeApiError(status: number, body: string, siteUrl: string): string {
  const detail = body.slice(0, 400).replace(/\s+/g, ' ').trim();
  if (status === 401) {
    return `Google rejected the credentials (401). The service-account key may have been revoked or the system clock may be skewed. ${detail}`;
  }
  if (status === 403) {
    return `Google returned 403 for ${siteUrl}. The usual cause is that the service account has not been added as a user on the property: Search Console → Settings → Users and permissions → Add user → the service account's client_email, Full or Restricted. ${detail}`;
  }
  if (status === 404) {
    return `Google does not recognize the property "${siteUrl}" (404). It must match Search Console exactly — a Domain property is "sc-domain:example.com", a URL-prefix property is "https://example.com/" including the trailing slash. ${detail}`;
  }
  if (status === 429) {
    return `Google rate-limited the request (429). Retry later; the sync is idempotent. ${detail}`;
  }
  return `Search Console request failed (HTTP ${status}). ${detail}`;
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Sign a JWT for the service account and trade it for an access token. */
export async function fetchAccessToken(
  account: ServiceAccount,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  let assertion: string;
  try {
    const key = await importPKCS8(account.privateKey, 'RS256');
    assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(account.clientEmail)
      .setAudience(TOKEN_ENDPOINT)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(key);
  } catch (err) {
    throw new SearchConsoleError(
      `Could not sign the service-account assertion: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new SearchConsoleError(
      `Google refused the service-account assertion (HTTP ${response.status}). ${text.slice(0, 300)}`,
      { status: response.status },
    );
  }
  let token: unknown;
  try {
    token = (JSON.parse(text) as { access_token?: unknown }).access_token;
  } catch {
    throw new SearchConsoleError('Token endpoint returned a non-JSON body.');
  }
  if (typeof token !== 'string' || !token) {
    throw new SearchConsoleError('Token endpoint returned no access_token.');
  }
  return token;
}

/** One searchAnalytics.query for the given inclusive day range. */
export async function querySearchAnalytics(
  config: SearchConsoleConfig,
  accessToken: string,
  startDate: string,
  endDate: string,
  fetchImpl: FetchLike = fetch,
): Promise<SearchAnalyticsRow[]> {
  const url = `${SEARCH_CONSOLE_BASE}/sites/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['date'],
      rowLimit: ROW_LIMIT,
      dataState: config.dataState,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new SearchConsoleError(describeApiError(response.status, text, config.siteUrl), {
      status: response.status,
    });
  }
  try {
    const parsed = JSON.parse(text) as { rows?: SearchAnalyticsRow[] };
    return Array.isArray(parsed.rows) ? parsed.rows : [];
  } catch {
    throw new SearchConsoleError('Search Console returned a non-JSON body.');
  }
}

export type SyncResult = {
  siteUrl: string;
  dataState: 'all' | 'final';
  startDate: string;
  endDate: string;
  /** Days handed to the rollup writer. */
  rows: ExternalMetricRow[];
  reportedThrough: string | null;
  zeroFilled: number;
  truncated: boolean;
};

/**
 * Fetch one window of daily Search Console metrics, ready to hand to
 * importExternalMetrics. Does no writing itself — the caller owns the DB, which
 * keeps this module free of any dependency on the rollup's storage.
 *
 * `days` defaults to a trailing two weeks. A scheduled run wants a window rather
 * than just yesterday for two reasons: Search Console backfills its own numbers
 * for a couple of days after the fact (so today's "final" figure for Monday is
 * not Monday's first figure), and a missed run then heals itself on the next
 * tick instead of leaving a permanent hole.
 */
export async function syncSearchConsole(
  opts: {
    days?: number;
    endDay?: string;
    config?: SearchConsoleConfig;
    env?: EnvLike;
    readFile?: (path: string) => string;
    fetchImpl?: FetchLike;
  } = {},
): Promise<SyncResult> {
  const config = opts.config ?? resolveConfig(opts.env, opts.readFile);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const endDay = opts.endDay ?? todayKey();
  const days = dayRange(endDay, opts.days ?? DEFAULT_SYNC_DAYS);
  if (days.length === 0) throw new SearchConsoleError(`Invalid end day: ${endDay}`);

  const accessToken = await fetchAccessToken(config.serviceAccount, fetchImpl);
  const apiRows = await querySearchAnalytics(config, accessToken, days[0], days[days.length - 1], fetchImpl);
  const mapped = mapSearchAnalyticsRows(apiRows, days);

  return {
    siteUrl: config.siteUrl,
    dataState: config.dataState,
    startDate: days[0],
    endDate: days[days.length - 1],
    rows: mapped.rows,
    reportedThrough: mapped.reportedThrough,
    zeroFilled: mapped.zeroFilled,
    truncated: mapped.truncated,
  };
}
