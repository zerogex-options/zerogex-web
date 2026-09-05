import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { importSPKI, jwtVerify } from 'jose';
import {
  MAX_LOOKBACK_DAYS,
  SearchConsoleError,
  dayRange,
  describeApiError,
  isSearchConsoleConfigured,
  mapSearchAnalyticsRows,
  parseServiceAccount,
  querySearchAnalytics,
  resolveConfig,
  syncSearchConsole,
  type FetchLike,
} from '../core/searchConsole.ts';

// A syntactically valid PKCS#8 block is enough for everything except the actual
// RS256 signature, which these tests never exercise (they inject fetch).
const FAKE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIBOgIBAAJ\n-----END PRIVATE KEY-----\n';
const KEY_JSON = JSON.stringify({
  type: 'service_account',
  client_email: 'zerogex-gsc@example.iam.gserviceaccount.com',
  private_key: FAKE_KEY,
});

// ── Configuration ───────────────────────────────────────────────────────────

test('parseServiceAccount pulls out the two fields that matter', () => {
  const account = parseServiceAccount(KEY_JSON);
  assert.equal(account.clientEmail, 'zerogex-gsc@example.iam.gserviceaccount.com');
  assert.ok(account.privateKey.includes('BEGIN PRIVATE KEY'));
});

test('parseServiceAccount un-escapes a key that came through an env file', () => {
  const escaped = JSON.stringify({
    client_email: 'a@b.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\\nAAAA\\n-----END PRIVATE KEY-----\\n',
  });
  const account = parseServiceAccount(escaped);
  assert.ok(account.privateKey.includes('\n'));
  assert.ok(!account.privateKey.includes('\\n'));
});

test('parseServiceAccount rejects the wrong file rather than failing at sign time', () => {
  assert.throws(() => parseServiceAccount('not json'), SearchConsoleError);
  assert.throws(() => parseServiceAccount(JSON.stringify({ client_email: 'a@b' })), SearchConsoleError);
  // An OAuth *client* secret file is the classic mix-up: valid JSON, wrong shape.
  assert.throws(
    () => parseServiceAccount(JSON.stringify({ installed: { client_id: 'x' } })),
    SearchConsoleError,
  );
  assert.throws(
    () => parseServiceAccount(JSON.stringify({ client_email: 'a@b', private_key: 'nope' })),
    /PKCS#8/,
  );
});

test('resolveConfig names the missing piece instead of failing vaguely', () => {
  assert.throws(() => resolveConfig({}), /GSC_SITE_URL/);
  assert.throws(
    () => resolveConfig({ GSC_SITE_URL: 'sc-domain:example.com' }),
    /GSC_SERVICE_ACCOUNT_KEY_FILE/,
  );
});

test('resolveConfig accepts an inline key or a key file', () => {
  const inline = resolveConfig({
    GSC_SITE_URL: 'sc-domain:example.com',
    GSC_SERVICE_ACCOUNT_JSON: KEY_JSON,
  });
  assert.equal(inline.siteUrl, 'sc-domain:example.com');
  assert.equal(inline.dataState, 'all');

  const fromFile = resolveConfig(
    { GSC_SITE_URL: 'https://example.com/', GSC_SERVICE_ACCOUNT_KEY_FILE: '/keys/gsc.json' },
    (path) => {
      assert.equal(path, '/keys/gsc.json');
      return KEY_JSON;
    },
  );
  assert.equal(fromFile.siteUrl, 'https://example.com/');
});

test('resolveConfig honors GSC_DATA_STATE=final and ignores anything else', () => {
  const base = { GSC_SITE_URL: 'sc-domain:example.com', GSC_SERVICE_ACCOUNT_JSON: KEY_JSON };
  assert.equal(resolveConfig({ ...base, GSC_DATA_STATE: 'final' }).dataState, 'final');
  assert.equal(resolveConfig({ ...base, GSC_DATA_STATE: 'nonsense' }).dataState, 'all');
});

test('an unreadable key file reports as unconfigured, not as a crash', () => {
  try {
    resolveConfig(
      { GSC_SITE_URL: 'sc-domain:example.com', GSC_SERVICE_ACCOUNT_KEY_FILE: '/nope.json' },
      () => {
        throw new Error('ENOENT');
      },
    );
    assert.fail('expected a throw');
  } catch (err) {
    assert.ok(err instanceof SearchConsoleError);
    assert.equal(err.unconfigured, true);
  }
});

test('isSearchConsoleConfigured never throws', () => {
  assert.equal(isSearchConsoleConfigured({}), false);
  assert.equal(isSearchConsoleConfigured({ GSC_SITE_URL: 'sc-domain:e.com' }), false);
  assert.equal(
    isSearchConsoleConfigured({ GSC_SITE_URL: 'sc-domain:e.com', GSC_SERVICE_ACCOUNT_JSON: '{}' }),
    true,
  );
});

// ── Day ranges ──────────────────────────────────────────────────────────────

test('dayRange is inclusive, oldest first, and crosses months', () => {
  assert.deepEqual(dayRange('2026-03-02', 4), ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  assert.deepEqual(dayRange('2026-01-01', 1), ['2026-01-01']);
});

test('dayRange spans a leap day and is capped at the retention horizon', () => {
  assert.deepEqual(dayRange('2028-03-01', 3), ['2028-02-28', '2028-02-29', '2028-03-01']);
  assert.equal(dayRange('2026-09-01', 10_000).length, MAX_LOOKBACK_DAYS);
  assert.deepEqual(dayRange('nonsense', 5), []);
});

// ── Response mapping ────────────────────────────────────────────────────────

const requested = dayRange('2026-09-04', 5); // 08-31 … 09-04

test('mapSearchAnalyticsRows reads clicks and impressions per day', () => {
  const mapped = mapSearchAnalyticsRows(
    [
      { keys: ['2026-09-01'], clicks: 12, impressions: 340 },
      { keys: ['2026-09-02'], clicks: 7, impressions: 210 },
    ],
    requested,
  );
  assert.equal(mapped.reportedThrough, '2026-09-02');
  const byDay = new Map(mapped.rows.map((r) => [r.day, r]));
  assert.deepEqual(byDay.get('2026-09-01'), {
    day: '2026-09-01',
    googleClicks: 12,
    googleImpressions: 340,
  });
});

test('a day Google omits INSIDE the reported span is a real zero', () => {
  const mapped = mapSearchAnalyticsRows(
    [
      { keys: ['2026-08-31'], clicks: 4, impressions: 90 },
      { keys: ['2026-09-02'], clicks: 6, impressions: 120 },
    ],
    requested,
  );
  const byDay = new Map(mapped.rows.map((r) => [r.day, r]));
  assert.deepEqual(byDay.get('2026-09-01'), {
    day: '2026-09-01',
    googleClicks: 0,
    googleImpressions: 0,
  });
  assert.equal(mapped.zeroFilled, 1);
});

test('days AFTER the reported span are left unwritten, not zeroed', () => {
  // Google is two days behind; 09-03 and 09-04 are "not counted yet", which is
  // not the same as "no search traffic" — writing 0 there would assert a fact
  // Google has not stated and would drag the correlation until the next run.
  const mapped = mapSearchAnalyticsRows([{ keys: ['2026-09-02'], clicks: 6, impressions: 120 }], requested);
  const days = mapped.rows.map((r) => r.day);
  assert.equal(days.includes('2026-09-03'), false);
  assert.equal(days.includes('2026-09-04'), false);
  assert.equal(mapped.reportedThrough, '2026-09-02');
});

test('an empty response establishes no span and writes nothing', () => {
  const mapped = mapSearchAnalyticsRows([], requested);
  assert.deepEqual(mapped.rows, []);
  assert.equal(mapped.reportedThrough, null);
  assert.equal(mapped.zeroFilled, 0);
});

test('mapSearchAnalyticsRows ignores malformed rows and coerces junk counts', () => {
  const mapped = mapSearchAnalyticsRows(
    [
      { keys: ['not-a-date'], clicks: 5, impressions: 5 },
      { keys: [], clicks: 5, impressions: 5 },
      { keys: ['2026-09-02'], clicks: 3.6, impressions: -4 },
    ],
    requested,
  );
  const byDay = new Map(mapped.rows.map((r) => [r.day, r]));
  assert.equal(byDay.has('not-a-date'), false);
  assert.equal(byDay.get('2026-09-02')?.googleClicks, 4); // rounded
  assert.equal(byDay.get('2026-09-02')?.googleImpressions, 0); // negatives floored
});

test('rows are returned oldest first', () => {
  const mapped = mapSearchAnalyticsRows(
    [
      { keys: ['2026-09-02'], clicks: 1, impressions: 1 },
      { keys: ['2026-08-31'], clicks: 1, impressions: 1 },
    ],
    requested,
  );
  assert.deepEqual(mapped.rows.map((r) => r.day), ['2026-08-31', '2026-09-01', '2026-09-02']);
});

// ── Error messages ──────────────────────────────────────────────────────────

test('describeApiError turns the common failures into a remedy', () => {
  assert.match(describeApiError(403, '{}', 'sc-domain:e.com'), /Users and permissions/);
  assert.match(describeApiError(404, '{}', 'sc-domain:e.com'), /sc-domain:example\.com/);
  assert.match(describeApiError(401, '{}', 'sc-domain:e.com'), /revoked|clock/);
  assert.match(describeApiError(429, '{}', 'sc-domain:e.com'), /rate-limited/);
  assert.match(describeApiError(500, 'boom', 'sc-domain:e.com'), /HTTP 500/);
});

// ── Request shape ───────────────────────────────────────────────────────────

const config = {
  siteUrl: 'sc-domain:example.com',
  serviceAccount: { clientEmail: 'a@b.iam.gserviceaccount.com', privateKey: FAKE_KEY },
  dataState: 'all' as const,
};

test('querySearchAnalytics asks for the date dimension over the given range', async () => {
  let seenUrl = '';
  let seenBody: Record<string, unknown> = {};
  const fetchImpl: FetchLike = async (url, init) => {
    seenUrl = url;
    seenBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ rows: [{ keys: ['2026-09-01'], clicks: 1, impressions: 2 }] }), {
      status: 200,
    });
  };
  const rows = await querySearchAnalytics(config, 'token', '2026-08-31', '2026-09-04', fetchImpl);
  // The property id has to survive as one path segment, colon and all.
  assert.match(seenUrl, /sites\/sc-domain%3Aexample\.com\/searchAnalytics\/query$/);
  assert.deepEqual(seenBody.dimensions, ['date']);
  assert.equal(seenBody.startDate, '2026-08-31');
  assert.equal(seenBody.endDate, '2026-09-04');
  assert.equal(seenBody.dataState, 'all');
  assert.equal(rows.length, 1);
});

test('querySearchAnalytics surfaces an actionable message on 403', async () => {
  const fetchImpl: FetchLike = async () => new Response('{"error":"forbidden"}', { status: 403 });
  await assert.rejects(
    () => querySearchAnalytics(config, 'token', '2026-08-31', '2026-09-04', fetchImpl),
    /Users and permissions/,
  );
});

test('querySearchAnalytics treats a missing rows array as no data', async () => {
  const fetchImpl: FetchLike = async () => new Response('{}', { status: 200 });
  assert.deepEqual(await querySearchAnalytics(config, 'token', '2026-08-31', '2026-09-04', fetchImpl), []);
});

test('an unusable private key fails at signing, before any request goes out', async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    return new Response('{}', { status: 200 });
  };
  await assert.rejects(
    () => syncSearchConsole({ config, days: 5, endDay: '2026-09-04', fetchImpl }),
    /sign the service-account assertion/,
  );
  assert.deepEqual(calls, []);
});

// ── The real signing path ───────────────────────────────────────────────────
// A generated RSA key exercises importPKCS8 + SignJWT for real, so the
// assertion below is checking the JWT this code actually mints — issuer,
// audience, scope and signature — rather than a stub of it.

const { privateKey: realPem, publicKey: realPublicPem } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const realConfig = {
  siteUrl: 'sc-domain:example.com',
  serviceAccount: { clientEmail: 'zerogex-gsc@example.iam.gserviceaccount.com', privateKey: realPem },
  dataState: 'all' as const,
};

test('syncSearchConsole signs a verifiable assertion, then queries with the token', async () => {
  const calls: string[] = [];
  let assertionJwt = '';
  let authHeader = '';
  let queryBody: Record<string, unknown> = {};

  const fetchImpl: FetchLike = async (url, init) => {
    calls.push(url);
    if (url.includes('oauth2.googleapis.com')) {
      assertionJwt = new URLSearchParams(String(init?.body)).get('assertion') ?? '';
      const grant = new URLSearchParams(String(init?.body)).get('grant_type');
      assert.equal(grant, 'urn:ietf:params:oauth:grant-type:jwt-bearer');
      return new Response(JSON.stringify({ access_token: 'ya29.test-token' }), { status: 200 });
    }
    authHeader = String((init?.headers as Record<string, string>)?.Authorization ?? '');
    queryBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        rows: [
          { keys: ['2026-09-01'], clicks: 9, impressions: 300 },
          { keys: ['2026-09-03'], clicks: 4, impressions: 150 },
        ],
      }),
      { status: 200 },
    );
  };

  const result = await syncSearchConsole({
    config: realConfig,
    days: 5,
    endDay: '2026-09-04',
    fetchImpl,
  });

  assert.equal(calls.length, 2, 'one token exchange, one query');
  assert.equal(authHeader, 'Bearer ya29.test-token');
  assert.equal(queryBody.startDate, '2026-08-31');
  assert.equal(queryBody.endDate, '2026-09-04');

  // The assertion really is a signed JWT with the claims Google requires.
  const publicKey = await importSPKI(realPublicPem, 'RS256');
  const { payload } = await jwtVerify(assertionJwt, publicKey, {
    audience: 'https://oauth2.googleapis.com/token',
    issuer: 'zerogex-gsc@example.iam.gserviceaccount.com',
  });
  assert.equal(payload.scope, 'https://www.googleapis.com/auth/webmasters.readonly');
  assert.ok(typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000));

  // 09-02 is inside the reported span (Google reported through 09-03), so it is
  // a real zero; 09-04 is beyond it and stays unwritten.
  const byDay = new Map(result.rows.map((r) => [r.day, r]));
  assert.equal(byDay.get('2026-09-02')?.googleClicks, 0);
  assert.equal(byDay.has('2026-09-04'), false);
  assert.equal(result.reportedThrough, '2026-09-03');
  assert.equal(result.zeroFilled, 2); // 08-31 and 09-02
});

test('a token endpoint refusal is reported with its status, and no query follows', async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    return new Response('{"error":"invalid_grant"}', { status: 400 });
  };
  await assert.rejects(
    () => syncSearchConsole({ config: realConfig, days: 2, endDay: '2026-09-04', fetchImpl }),
    (err: unknown) => err instanceof SearchConsoleError && err.status === 400,
  );
  assert.equal(calls.length, 1);
});
