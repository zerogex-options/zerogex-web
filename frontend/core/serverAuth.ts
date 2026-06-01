import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME, TierId, normalizeTier } from '@/core/auth';
import { getDb } from '@/core/db';

export type AuthUser = {
  id: string;
  email: string;
  passwordHash?: string;
  tier: TierId;
  createdAt: string;
  updatedAt: string;
};

type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  csrfSecret: string;
  createdAt: string;
  expiresAt: string;
  lastRotatedAt: string;
};

type SessionWithUser = {
  user: {
    id: string;
    email: string;
    tier: TierId;
    hasActiveSubscription: boolean;
    disclaimerAcknowledgedAt: string | null;
    disclaimerVersionAcknowledged: string | null;
  };
  session: SessionRecord;
};

function readPositiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Tier a brand-new self-signup account is created with.
 *
 * Server-side and operator-controlled via SELF_SIGNUP_DEFAULT_TIER. This is
 * NOT the old vulnerability (that let the *client* pick its own tier, incl.
 * `pro`): the value here is chosen by the deployment, not the request.
 *
 * Allowed values are `public` (default) and `basic` only. `basic` is the
 * intended setting for the pre-Stripe free-beta phase — every signup gets
 * Basic without a payment. Once Stripe is live, unset it (or set `public`)
 * and the Stripe webhook becomes the sole path to a paid tier. `pro`/`admin`
 * are deliberately NOT grantable through self-signup even by config; clamp
 * anything else to `public`.
 */
export function selfSignupTier(): TierId {
  const configured = normalizeTier(process.env.SELF_SIGNUP_DEFAULT_TIER);
  return configured === 'basic' ? 'basic' : 'public';
}

const SESSION_TTL_SECONDS = readPositiveInt('AUTH_SESSION_TTL_SECONDS', 60 * 60 * 24 * 14);
const SESSION_ROTATE_AFTER_SECONDS = readPositiveInt('AUTH_SESSION_ROTATE_AFTER_SECONDS', 60 * 60 * 24);
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_TTL_SECONDS = readPositiveInt('AUTH_PASSWORD_RESET_TTL_SECONDS', 30 * 60);
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;
const PASSWORD_RESET_MAX_REQUESTS = 5;
const PASSWORD_MIN_LENGTH = 12;
const BOOTSTRAP_ADMIN_FLAG = 'ZGEX_BOOTSTRAP_ADMIN_DONE';

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const passwordResetAttempts = new Map<string, { count: number; resetAt: number }>();

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${randomBytes(12).toString('hex')}`;
}

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password: string, encodedHash?: string) {
  if (!encodedHash) return false;
  const [algorithm, salt, hash] = encodedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}

function getClientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

function rowToUser(row: Record<string, unknown>): AuthUser {
  return {
    id: row.id as string,
    email: row.email as string,
    passwordHash: (row.password_hash as string | null) ?? undefined,
    tier: normalizeTier(row.tier as string),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function ensureBootstrapAdmin() {
  if (process.env[BOOTSTRAP_ADMIN_FLAG] === '1') return;

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) {
    process.env[BOOTSTRAP_ADMIN_FLAG] = '1';
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
  if (!existing) {
    const now = nowIso();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, tier, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', ?, ?)`
    ).run(createId('user'), email, hashPassword(password), now, now);
  }

  process.env[BOOTSTRAP_ADMIN_FLAG] = '1';
}

function getUserByEmail(email: string) {
  ensureBootstrapAdmin();
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : null;
}

function getSessionByToken(token: string): SessionWithUser | null {
  ensureBootstrapAdmin();
  const db = getDb();
  const tokenHash = sha256(token);

  const row = db
    .prepare(
      `SELECT s.id as session_id, s.user_id, s.token_hash, s.csrf_secret, s.created_at as session_created_at,
              s.expires_at, s.last_rotated_at,
              u.id as user_id2, u.email, u.tier, u.stripe_subscription_id,
              u.disclaimer_acknowledged_at, u.disclaimer_version_acknowledged
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    user: {
      id: row.user_id2 as string,
      email: row.email as string,
      tier: normalizeTier(row.tier as string),
      // Source of truth for "has a paid sub right now" is the Stripe sub id —
      // not the tier alone. A grandfathered user (tier=basic|pro without a
      // Stripe sub) returns false here so the client knows to route to
      // checkout, not the portal (which would 400 on missing stripe_customer_id).
      hasActiveSubscription: !!row.stripe_subscription_id,
      disclaimerAcknowledgedAt: (row.disclaimer_acknowledged_at as string | null) ?? null,
      disclaimerVersionAcknowledged: (row.disclaimer_version_acknowledged as string | null) ?? null,
    },
    session: {
      id: row.session_id as string,
      userId: row.user_id as string,
      tokenHash: row.token_hash as string,
      csrfSecret: row.csrf_secret as string,
      createdAt: row.session_created_at as string,
      expiresAt: row.expires_at as string,
      lastRotatedAt: row.last_rotated_at as string,
    },
  };
}

function createSessionForUser(user: AuthUser) {
  const db = getDb();
  const token = randomBytes(32).toString('hex');
  const csrfSecret = randomBytes(24).toString('hex');
  const now = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, csrf_secret, created_at, expires_at, last_rotated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(createId('session'), user.id, sha256(token), csrfSecret, now, expiresAt, now);

  const ackRow = db
    .prepare(
      `SELECT disclaimer_acknowledged_at, disclaimer_version_acknowledged, stripe_subscription_id
       FROM users WHERE id = ?`
    )
    .get(user.id) as
    | {
        disclaimer_acknowledged_at: string | null;
        disclaimer_version_acknowledged: string | null;
        stripe_subscription_id: string | null;
      }
    | undefined;

  return {
    token,
    csrfToken: csrfSecret,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      tier: user.tier,
      hasActiveSubscription: !!ackRow?.stripe_subscription_id,
      disclaimerAcknowledgedAt: ackRow?.disclaimer_acknowledged_at ?? null,
      disclaimerVersionAcknowledged: ackRow?.disclaimer_version_acknowledged ?? null,
    },
  };
}

function appendAuditEvent(input: {
  type: string;
  userId?: string;
  actorUserId?: string;
  email?: string;
  ip?: string;
  message: string;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(createId('audit'), input.type, input.userId ?? null, input.actorUserId ?? null, input.email ?? null, input.ip ?? null, input.message, nowIso());
}

export function enforceLoginRateLimit(ip: string) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  loginAttempts.set(ip, entry);
  return { allowed: true, retryAfterSeconds: 0 };
}

function clearLoginRateLimit(ip: string) {
  loginAttempts.delete(ip);
}

function issueSessionCookie(response: NextResponse, token: string, maxAgeSeconds = SESSION_TTL_SECONDS) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

export function issueCsrfCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // The CSRF token IS the per-session csrfSecret, so its natural
    // lifetime is the session's. A fixed 1h maxAge expired the cookie
    // while the 14-day session lived on, after which validateCsrf()
    // failed and every state-changing call (checkout, billing portal,
    // role change, logout) 403'd until /api/auth/session was polled to
    // re-issue it.
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function validateCsrf(request: NextRequest) {
  const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const csrfHeader = request.headers.get('x-csrf-token');
  if (!csrfCookie || !csrfHeader) return false;

  const left = Buffer.from(csrfCookie);
  const right = Buffer.from(csrfHeader);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function registerUser(request: NextRequest, email: string, password: string, tier: TierId = 'public') {
  const normalizedEmail = email.trim().toLowerCase();
  if (getUserByEmail(normalizedEmail)) throw new Error('Email already registered');

  const db = getDb();
  const user: AuthUser = {
    id: createId('user'),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    tier: normalizeTier(tier),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  db.prepare(
    `INSERT INTO users (id, email, password_hash, tier, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(user.id, user.email, user.passwordHash, user.tier, user.createdAt, user.updatedAt);

  appendAuditEvent({
    type: 'register',
    userId: user.id,
    email: user.email,
    ip: getClientIp(request),
    message: 'User registered',
  });

  return { id: user.id, email: user.email, tier: user.tier };
}

// Register + immediately issue a session so the user is logged in without a
// second round-trip through /login. Bypasses createSessionForUserCredentials'
// login rate limit and password re-verification — we just hashed the
// password ourselves in registerUser, so re-verifying is pointless.
export async function registerAndStartSession(
  request: NextRequest,
  email: string,
  password: string,
  tier: TierId = 'public',
) {
  await registerUser(request, email, password, tier);
  const fullUser = getUserByEmail(email.trim().toLowerCase());
  if (!fullUser) throw new Error('Registration succeeded but user lookup failed');
  return createSessionForUser(fullUser);
}

export async function createSessionForUserCredentials(request: NextRequest, email: string, password: string) {
  const ip = getClientIp(request);
  const limit = enforceLoginRateLimit(ip);
  if (!limit.allowed) throw new Error(`Too many login attempts. Retry in ${limit.retryAfterSeconds}s.`);

  const user = getUserByEmail(email.trim().toLowerCase());
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    appendAuditEvent({ type: 'login_failure', email: email.trim().toLowerCase(), ip, message: 'Failed login attempt' });
    throw new Error('Invalid credentials');
  }

  clearLoginRateLimit(ip);
  const session = createSessionForUser(user);
  appendAuditEvent({ type: 'login_success', userId: user.id, email: user.email, ip, message: 'Login successful' });
  return session;
}

function enforcePasswordResetRateLimit(ip: string) {
  const now = Date.now();
  const entry = passwordResetAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    passwordResetAttempts.set(ip, { count: 1, resetAt: now + PASSWORD_RESET_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= PASSWORD_RESET_MAX_REQUESTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  passwordResetAttempts.set(ip, entry);
  return { allowed: true, retryAfterSeconds: 0 };
}

export type PasswordResetRequest =
  | { status: 'issued'; token: string; userId: string; email: string; expiresAt: string }
  | { status: 'no_local_password' }
  | { status: 'no_user' };

export async function requestPasswordReset(request: NextRequest, email: string): Promise<PasswordResetRequest> {
  const ip = getClientIp(request);
  const limit = enforcePasswordResetRateLimit(ip);
  if (!limit.allowed) {
    throw new Error(`Too many password reset requests. Retry in ${limit.retryAfterSeconds}s.`);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = getUserByEmail(normalizedEmail);

  if (!user) {
    appendAuditEvent({
      type: 'password_reset_request',
      email: normalizedEmail,
      ip,
      message: 'Password reset requested for unknown email',
    });
    return { status: 'no_user' };
  }

  if (!user.passwordHash) {
    appendAuditEvent({
      type: 'password_reset_request',
      userId: user.id,
      email: user.email,
      ip,
      message: 'Password reset requested for OAuth-only account; no email sent',
    });
    return { status: 'no_local_password' };
  }

  const db = getDb();
  const token = randomBytes(32).toString('hex');
  const tokenHash = sha256(token);
  const now = nowIso();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000).toISOString();

  db.prepare(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at, used_at)
     VALUES (?, ?, ?, ?, ?, NULL)`
  ).run(createId('preset'), user.id, tokenHash, now, expiresAt);

  appendAuditEvent({
    type: 'password_reset_request',
    userId: user.id,
    email: user.email,
    ip,
    message: 'Password reset link issued',
  });

  return { status: 'issued', token, userId: user.id, email: user.email, expiresAt };
}

export async function setInitialLocalPassword(request: NextRequest, userId: string, newPassword: string) {
  if (!newPassword || newPassword.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  const db = getDb();
  const row = db
    .prepare('SELECT id, email, password_hash FROM users WHERE id = ?')
    .get(userId) as { id: string; email: string; password_hash: string | null } | undefined;

  if (!row) throw new Error('User not found');
  if (row.password_hash) {
    throw new Error('A password is already set on this account. Use the password reset flow to change it.');
  }

  const newHash = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, nowIso(), row.id);

  appendAuditEvent({
    type: 'password_set',
    userId: row.id,
    email: row.email,
    ip: getClientIp(request),
    message: 'Local password set for OAuth-only account',
  });

  return { email: row.email };
}

export async function resetPasswordWithToken(request: NextRequest, token: string, newPassword: string) {
  if (!token || typeof token !== 'string') {
    throw new Error('Reset token is required');
  }
  if (!newPassword || newPassword.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  const ip = getClientIp(request);
  const db = getDb();
  const tokenHash = sha256(token);

  const row = db
    .prepare(
      `SELECT t.id as token_id, t.user_id, t.expires_at, t.used_at,
              u.id as uid, u.email, u.password_hash
       FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ?`
    )
    .get(tokenHash) as
    | { token_id: string; user_id: string; expires_at: string; used_at: string | null; uid: string; email: string; password_hash: string | null }
    | undefined;

  if (!row) {
    appendAuditEvent({ type: 'password_reset_failure', ip, message: 'Reset attempted with unknown token' });
    throw new Error('This reset link is invalid or has expired.');
  }
  if (row.used_at) {
    appendAuditEvent({
      type: 'password_reset_failure',
      userId: row.user_id,
      email: row.email,
      ip,
      message: 'Reset attempted with already-used token',
    });
    throw new Error('This reset link has already been used.');
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    appendAuditEvent({
      type: 'password_reset_failure',
      userId: row.user_id,
      email: row.email,
      ip,
      message: 'Reset attempted with expired token',
    });
    throw new Error('This reset link is invalid or has expired.');
  }
  if (!row.password_hash) {
    appendAuditEvent({
      type: 'password_reset_failure',
      userId: row.user_id,
      email: row.email,
      ip,
      message: 'Reset attempted on OAuth-only account',
    });
    throw new Error('This account does not use a password.');
  }

  const newHash = hashPassword(newPassword);
  const now = nowIso();

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, row.user_id);
    db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').run(now, row.token_id);
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ? AND id != ?').run(row.user_id, row.token_id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  appendAuditEvent({
    type: 'password_reset_success',
    userId: row.user_id,
    email: row.email,
    ip,
    message: 'Password reset completed; existing sessions revoked',
  });

  return { email: row.email };
}

export async function createOrLoginOAuthUser(request: NextRequest, input: { provider: 'google' | 'apple'; providerId: string; email: string; }) {
  const db = getDb();
  const normalizedEmail = input.email.trim().toLowerCase();

  const identityRow = db
    .prepare(
      `SELECT u.* FROM users u
       JOIN user_identities i ON i.user_id = u.id
       WHERE i.provider = ? AND i.provider_id = ?`
    )
    .get(input.provider, input.providerId) as Record<string, unknown> | undefined;
  let user = identityRow ? rowToUser(identityRow) : null;

  if (!user) {
    db.exec('BEGIN');
    try {
      // Drop any orphaned identity row whose owning user no longer exists. This
      // can happen if a previous delete ran with foreign_keys disabled and the
      // ON DELETE CASCADE never fired, which would otherwise collide with the
      // UNIQUE(provider, provider_id) constraint when we insert below.
      db.prepare(
        `DELETE FROM user_identities
         WHERE provider = ? AND provider_id = ?
           AND user_id NOT IN (SELECT id FROM users)`
      ).run(input.provider, input.providerId);

      const emailRow = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as Record<string, unknown> | undefined;
      if (emailRow) {
        user = rowToUser(emailRow);
      } else {
        // Tier on fresh OAuth signup must mirror the local-password
        // registration default: selfSignupTier() (public unless an operator
        // has explicitly set SELF_SIGNUP_DEFAULT_TIER=basic for the
        // pre-Stripe beta phase). Hardcoding 'basic' here was a paywall
        // bypass — Google sign-ins were granted Basic for free while
        // local-password signups correctly defaulted to public.
        user = {
          id: createId('user'),
          email: normalizedEmail,
          tier: selfSignupTier(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        db.prepare(
          `INSERT INTO users (id, email, password_hash, tier, created_at, updated_at)
           VALUES (?, ?, NULL, ?, ?, ?)`
        ).run(user.id, user.email, user.tier, user.createdAt, user.updatedAt);
      }

      const now = nowIso();
      db.prepare(
        `INSERT INTO user_identities (id, user_id, provider, provider_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, provider) DO UPDATE SET provider_id = excluded.provider_id, updated_at = excluded.updated_at`
      ).run(createId('ident'), user.id, input.provider, input.providerId, now, now);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  const session = createSessionForUser(user);
  appendAuditEvent({ type: 'oauth_login', userId: user.id, email: user.email, ip: getClientIp(request), message: `${input.provider} login successful` });
  return session;
}

export type OAuthProviderName = 'google' | 'apple';

export type UserIdentity = {
  provider: OAuthProviderName;
  providerId: string;
  createdAt: string;
};

export function listUserIdentities(userId: string): UserIdentity[] {
  const rows = getDb()
    .prepare(`SELECT provider, provider_id, created_at FROM user_identities WHERE user_id = ? ORDER BY created_at`)
    .all(userId) as Array<{ provider: string; provider_id: string; created_at: string }>;
  return rows.map((r) => ({
    provider: r.provider as OAuthProviderName,
    providerId: r.provider_id,
    createdAt: r.created_at,
  }));
}

export function userHasPassword(userId: string): boolean {
  const row = getDb()
    .prepare(`SELECT password_hash FROM users WHERE id = ?`)
    .get(userId) as { password_hash: string | null } | undefined;
  return !!row?.password_hash;
}

export function linkUserIdentity(userId: string, provider: OAuthProviderName, providerId: string) {
  const db = getDb();
  const existing = db
    .prepare(`SELECT user_id FROM user_identities WHERE provider = ? AND provider_id = ?`)
    .get(provider, providerId) as { user_id: string } | undefined;
  if (existing && existing.user_id !== userId) {
    throw new Error('This account is already linked to a different user.');
  }
  const now = nowIso();
  db.prepare(
    `INSERT INTO user_identities (id, user_id, provider, provider_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, provider) DO UPDATE SET provider_id = excluded.provider_id, updated_at = excluded.updated_at`
  ).run(createId('ident'), userId, provider, providerId, now, now);
}

export function unlinkUserIdentity(userId: string, provider: OAuthProviderName) {
  const db = getDb();
  const hasPassword = userHasPassword(userId);
  const others = db
    .prepare(`SELECT COUNT(*) AS count FROM user_identities WHERE user_id = ? AND provider != ?`)
    .get(userId, provider) as { count: number };
  if (!hasPassword && others.count === 0) {
    throw new Error('Cannot remove your only sign-in method. Set a password or link another provider first.');
  }
  const result = db
    .prepare(`DELETE FROM user_identities WHERE user_id = ? AND provider = ?`)
    .run(userId, provider) as { changes: number | bigint };
  if (Number(result.changes) === 0) {
    throw new Error(`No ${provider} account is linked.`);
  }
}

export async function getSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const data = getSessionByToken(token);
  if (!data) return null;

  if (new Date(data.session.expiresAt).getTime() <= Date.now()) {
    getDb().prepare('DELETE FROM sessions WHERE id = ?').run(data.session.id);
    return null;
  }

  let rotatedToken: string | null = null;
  if (Date.now() - new Date(data.session.lastRotatedAt).getTime() >= SESSION_ROTATE_AFTER_SECONDS * 1000) {
    rotatedToken = randomBytes(32).toString('hex');
    const newExpires = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    getDb().prepare('UPDATE sessions SET token_hash = ?, last_rotated_at = ?, expires_at = ? WHERE id = ?').run(
      sha256(rotatedToken), nowIso(), newExpires, data.session.id
    );
    data.session.expiresAt = newExpires;
  }

  return {
    user: data.user,
    expiresAt: data.session.expiresAt,
    csrfToken: data.session.csrfSecret,
    rotatedToken,
  };
}

export async function clearSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return;

  const data = getSessionByToken(token);
  if (!data) return;

  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(data.session.id);
  appendAuditEvent({ type: 'logout', userId: data.user.id, ip: getClientIp(request), message: 'User logged out' });
}

export async function requireSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const data = getSessionByToken(token);
  if (!data || new Date(data.session.expiresAt).getTime() <= Date.now()) return null;
  return { user: data.user, session: data.session };
}

export async function updateUserTier(actorUserId: string, targetEmail: string, tier: TierId, ip = 'unknown') {
  const normalizedEmail = targetEmail.trim().toLowerCase();
  const user = getUserByEmail(normalizedEmail);
  if (!user) throw new Error('Target user not found');

  const previousTier = user.tier;
  const nextTier = normalizeTier(tier);
  getDb().prepare('UPDATE users SET tier = ?, updated_at = ? WHERE id = ?').run(nextTier, nowIso(), user.id);

  appendAuditEvent({
    type: 'role_change',
    userId: user.id,
    actorUserId,
    email: user.email,
    ip,
    message: `Role changed from ${previousTier} to ${nextTier}`,
  });

  return { email: user.email, tier: nextTier };
}

export function attachSessionCookie(response: NextResponse, token: string) {
  issueSessionCookie(response, token);
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set({ name: SESSION_COOKIE_NAME, value: '', path: '/', maxAge: 0 });
  response.cookies.set({ name: CSRF_COOKIE_NAME, value: '', path: '/', maxAge: 0 });
}

export async function acknowledgeDisclaimerForRequest(request: NextRequest, version: string) {
  const data = await getSessionFromRequest(request);
  if (!data) return null;

  const db = getDb();
  const now = nowIso();
  db.prepare(
    'UPDATE users SET disclaimer_acknowledged_at = ?, disclaimer_version_acknowledged = ?, updated_at = ? WHERE id = ?'
  ).run(now, version, now, data.user.id);

  appendAuditEvent({
    type: 'disclaimer_ack',
    userId: data.user.id,
    email: data.user.email,
    ip: getClientIp(request),
    message: `User acknowledged platform disclaimer (${version})`,
  });

  return {
    acknowledgedAt: now,
    version,
    rotatedToken: data.rotatedToken,
    csrfToken: data.csrfToken,
  };
}
