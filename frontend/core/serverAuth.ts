import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME, TierId, normalizeTier } from '@/core/auth';
import { getDb } from '@/core/db';

export type AuthUser = {
  id: string;
  email: string;
  passwordHash?: string;
  provider: 'local' | 'google' | 'apple';
  providerId?: string;
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
  user: { id: string; email: string; tier: TierId };
  session: SessionRecord;
};

function readPositiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SESSION_TTL_SECONDS = readPositiveInt('AUTH_SESSION_TTL_SECONDS', 60 * 60 * 24 * 14);
const SESSION_ROTATE_AFTER_SECONDS = readPositiveInt('AUTH_SESSION_ROTATE_AFTER_SECONDS', 60 * 60 * 24);
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const BOOTSTRAP_ADMIN_FLAG = 'ZGEX_BOOTSTRAP_ADMIN_DONE';

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

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
    provider: row.provider as 'local' | 'google' | 'apple',
    providerId: (row.provider_id as string | null) ?? undefined,
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
      `INSERT INTO users (id, email, password_hash, provider, provider_id, tier, created_at, updated_at)
       VALUES (?, ?, ?, 'local', NULL, 'admin', ?, ?)`
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
              u.id as user_id2, u.email, u.tier
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

  return {
    token,
    csrfToken: csrfSecret,
    expiresAt,
    user: { id: user.id, email: user.email, tier: user.tier },
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
    maxAge: 60 * 60,
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

export async function registerUser(request: NextRequest, email: string, password: string, tier: TierId = 'starter') {
  const normalizedEmail = email.trim().toLowerCase();
  if (getUserByEmail(normalizedEmail)) throw new Error('Email already registered');

  const db = getDb();
  const user: AuthUser = {
    id: createId('user'),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    provider: 'local',
    tier: normalizeTier(tier),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  db.prepare(
    `INSERT INTO users (id, email, password_hash, provider, provider_id, tier, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`
  ).run(user.id, user.email, user.passwordHash, user.provider, user.tier, user.createdAt, user.updatedAt);

  appendAuditEvent({
    type: 'register',
    userId: user.id,
    email: user.email,
    ip: getClientIp(request),
    message: 'User registered',
  });

  return { id: user.id, email: user.email, tier: user.tier };
}

export async function createSessionForUserCredentials(request: NextRequest, email: string, password: string) {
  const ip = getClientIp(request);
  const limit = enforceLoginRateLimit(ip);
  if (!limit.allowed) throw new Error(`Too many login attempts. Retry in ${limit.retryAfterSeconds}s.`);

  const user = getUserByEmail(email.trim().toLowerCase());
  if (!user || user.provider !== 'local' || !verifyPassword(password, user.passwordHash)) {
    appendAuditEvent({ type: 'login_failure', email: email.trim().toLowerCase(), ip, message: 'Failed login attempt' });
    throw new Error('Invalid credentials');
  }

  clearLoginRateLimit(ip);
  const session = createSessionForUser(user);
  appendAuditEvent({ type: 'login_success', userId: user.id, email: user.email, ip, message: 'Login successful' });
  return session;
}

export async function createOrLoginOAuthUser(request: NextRequest, input: { provider: 'google' | 'apple'; providerId: string; email: string; }) {
  const db = getDb();
  const normalizedEmail = input.email.trim().toLowerCase();

  let row = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(input.provider, input.providerId) as Record<string, unknown> | undefined;
  let user = row ? rowToUser(row) : null;

  if (!user) {
    row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as Record<string, unknown> | undefined;
    if (row) {
      user = rowToUser(row);
      db.prepare('UPDATE users SET provider = ?, provider_id = ?, updated_at = ? WHERE id = ?').run(input.provider, input.providerId, nowIso(), user.id);
      user.provider = input.provider;
      user.providerId = input.providerId;
      user.updatedAt = nowIso();
    } else {
      user = {
        id: createId('user'),
        email: normalizedEmail,
        provider: input.provider,
        providerId: input.providerId,
        tier: 'starter',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.prepare(
        `INSERT INTO users (id, email, password_hash, provider, provider_id, tier, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`
      ).run(user.id, user.email, user.provider, user.providerId, user.tier, user.createdAt, user.updatedAt);
    }
  }

  const session = createSessionForUser(user);
  appendAuditEvent({ type: 'oauth_login', userId: user.id, email: user.email, ip: getClientIp(request), message: `${input.provider} login successful` });
  return session;
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
