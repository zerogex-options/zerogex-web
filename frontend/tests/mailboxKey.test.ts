import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

// Gmail spellings of one inbox, against a real database.
//
// A Basic member registered with a password as first.last@gmail.com, later
// chose "Sign in with Google", and Google reported firstlast@gmail.com. Sign-in
// compared addresses exactly, so it made a new free account and linked Google
// to it, and every Google sign-in after that landed behind the paywall. This
// covers the fix end to end: the inbox key and its migration
// (core/mailboxKey.ts, core/db.ts), which account an OAuth sign-in lands in
// (core/oauthAccount.ts), the lookups password sign-in, password reset and
// registration use, and the read-only `make gmail-duplicates` report.
//
// core/serverAuth.ts imports Next and the @/ alias, which this runner cannot
// load, so the account creation passed to resolveOAuthAccount below mirrors the
// INSERT createOrLoginOAuthUser makes.

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-mailbox-'));
const dbPath = path.join(dir, 'auth.db');
process.env.AUTH_DB_PATH = dbPath;

// The database as production has it before this change: no users.mailbox_key,
// and a member who registered with a dotted Gmail address long before.
const AT = '2026-10-19T14:00:00.000Z';
const seed = new DatabaseSync(dbPath);
seed.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    tier TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
seed
  .prepare('INSERT INTO users (id, email, password_hash, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run('user_legacy', 'legacy.member@gmail.com', 'scrypt$salt$hash', 'basic', AT, AT);
seed.close();

// Dynamic imports: core/db.ts reads AUTH_DB_PATH at module load, so the
// assignment above has to land first. A static import would be hoisted past it.
const { getDb } = await import('../core/db.ts');
const { accountOnMailbox, deriveMailboxKeys, findAccountForSignIn, mailboxKey } = await import('../core/mailboxKey.ts');
const { DELETED_ACCOUNT_MESSAGE, UNVERIFIED_EMAIL_MESSAGE, isReturningOAuthSignIn, resolveOAuthAccount } = await import(
  '../core/oauthAccount.ts'
);

const db = getDb();
const PASSWORD_HASH = 'scrypt$salt$hash';
let seq = 0;

// An account as registerUser writes it, mailbox_key included.
function member(
  email: string,
  opts: { tier?: string; password?: boolean; deletedAt?: string; verified?: boolean } = {},
): string {
  const id = `user_${++seq}`;
  db.prepare(
    `INSERT INTO users (id, email, password_hash, tier, created_at, updated_at, deleted_at, mailbox_key,
                        email_verified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    email,
    opts.password === false ? null : PASSWORD_HASH,
    opts.tier ?? 'public',
    AT,
    AT,
    opts.deletedAt ?? null,
    mailboxKey(email),
    opts.verified ? AT : null,
  );
  return id;
}

// The new-account half of createOrLoginOAuthUser: a free, verified account
// under the address the provider reported.
function createFromOAuth(normalizedEmail: string): string {
  const id = `user_${++seq}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, tier, created_at, updated_at, email_verified_at, mailbox_key)
     VALUES (?, ?, NULL, 'public', ?, ?, ?, ?)`,
  ).run(id, normalizedEmail, now, now, now, mailboxKey(normalizedEmail));
  return id;
}

const userCount = () => (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
const identityOwner = (provider: string, providerId: string) =>
  (
    db.prepare('SELECT user_id FROM user_identities WHERE provider = ? AND provider_id = ?').get(provider, providerId) as
      | { user_id: string }
      | undefined
  )?.user_id;
const storedKey = (id: string) =>
  (db.prepare('SELECT mailbox_key FROM users WHERE id = ?').get(id) as { mailbox_key: string | null }).mailbox_key;
const signInFor = (email: string) => {
  const match = findAccountForSignIn(db, email);
  return match ? { id: String(match.row.id), via: match.via } : null;
};

test('adopting an account nobody verified drops the earlier registrant\'s password, sessions and sign-ins', () => {
  // Someone registers a member's address first. Registration logs in before
  // verification, so they hold a password and a session, and they link their
  // own Apple ID to the account.
  const squatted = member('victim.person@example.com');
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, csrf_secret, created_at, expires_at, last_rotated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run('sess_squatter', squatted, 'hash-squatter', 'csrf', AT, '2099-01-01T00:00:00.000Z', AT);
  db.prepare(
    `INSERT INTO user_identities (id, user_id, provider, provider_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run('ident_squatter', squatted, 'apple', 'apple-sub-squatter', AT, AT);

  // The real owner signs in with Google, which proves they read the inbox.
  const input = { provider: 'google' as const, providerId: 'google-sub-victim', email: 'victim.person@example.com' };
  const result = resolveOAuthAccount(db, input, createFromOAuth);
  assert.equal(result.via, 'email');
  assert.equal(result.row.id, squatted, 'the account is adopted, not duplicated');

  const row = db
    .prepare('SELECT password_hash, email_verified_at FROM users WHERE id = ?')
    .get(squatted) as { password_hash: string | null; email_verified_at: string | null };
  assert.equal(row.password_hash, null, "the earlier registrant's password no longer signs in");
  assert.ok(row.email_verified_at, 'the address is verified now');
  assert.ok(result.row.email_verified_at, 'the returned row is the updated one');
  const sessions = db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(squatted) as { n: number };
  assert.equal(sessions.n, 0, "the earlier registrant's session is gone");
  assert.equal(identityOwner('apple', 'apple-sub-squatter'), undefined, 'their linked Apple ID is gone');
  assert.equal(identityOwner('google', 'google-sub-victim'), squatted, 'the real owner is linked');
});

test('an Apple address Apple did not verify cannot adopt or create an account, but a linked Apple ID still signs in', () => {
  const existing = member('work.person@example.com', { verified: true });
  const unverified = { provider: 'apple' as const, providerId: 'apple-sub-work', email: 'work.person@example.com', emailVerified: false };
  assert.throws(() => resolveOAuthAccount(db, unverified, createFromOAuth), new RegExp(UNVERIFIED_EMAIL_MESSAGE.slice(0, 30)));
  assert.equal(identityOwner('apple', 'apple-sub-work'), undefined, 'nothing was linked');
  const before = userCount();
  assert.throws(() =>
    resolveOAuthAccount(
      db,
      { provider: 'apple', providerId: 'apple-sub-new', email: 'brand.new@example.com', emailVerified: false },
      createFromOAuth,
    ),
  );
  assert.equal(userCount(), before, 'no account was created');

  // Linked earlier (by its Apple subject, from inside the account): still signs in.
  db.prepare(
    `INSERT INTO user_identities (id, user_id, provider, provider_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run('ident_work_apple', existing, 'apple', 'apple-sub-work', AT, AT);
  const linked = resolveOAuthAccount(db, unverified, createFromOAuth);
  assert.equal(linked.via, 'identity');
  assert.equal(linked.row.id, existing);
});

test('adopting a verified account keeps its password and other sign-ins', () => {
  const owner = member('kept.member@example.com', { verified: true });
  db.prepare(
    `INSERT INTO user_identities (id, user_id, provider, provider_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run('ident_kept_apple', owner, 'apple', 'apple-sub-kept', AT, AT);
  const result = resolveOAuthAccount(
    db,
    { provider: 'google', providerId: 'google-sub-kept', email: 'kept.member@example.com' },
    createFromOAuth,
  );
  assert.equal(result.via, 'email');
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(owner) as { password_hash: string | null };
  assert.equal(row.password_hash, PASSWORD_HASH);
  assert.equal(identityOwner('apple', 'apple-sub-kept'), owner);
  assert.equal(identityOwner('google', 'google-sub-kept'), owner);
});

test('mailboxKey folds dots, +tags and googlemail.com for Gmail, and nothing else anywhere', () => {
  assert.equal(mailboxKey('a.b@gmail.com'), 'ab@gmail.com');
  assert.equal(mailboxKey('ab@gmail.com'), 'ab@gmail.com');
  assert.equal(mailboxKey('  A.B+ZeroGEX@GMail.com '), 'ab@gmail.com');
  assert.equal(mailboxKey('a.b@googlemail.com'), 'ab@gmail.com');
  assert.equal(mailboxKey('a..b.+x.y@gmail.com'), 'ab@gmail.com');

  // Every other domain is lower-cased and left at that. Google Workspace and
  // other providers can treat a dot as part of the name, and some deliver a
  // "+" literally, so neither is folded.
  assert.equal(mailboxKey('First.Last@Example.com'), 'first.last@example.com');
  assert.equal(mailboxKey('first.last+tag@zerogex.io'), 'first.last+tag@zerogex.io');
  assert.notEqual(mailboxKey('first.last@example.com'), mailboxKey('firstlast@example.com'));
  assert.equal(mailboxKey('j.doe@gmail.co'), 'j.doe@gmail.co');
  // Apple's private relay is not Gmail.
  assert.equal(mailboxKey('a.b@privaterelay.appleid.com'), 'a.b@privaterelay.appleid.com');

  // Strings that name no inbox are left alone, so they never share a key.
  assert.equal(mailboxKey('+promo@gmail.com'), '+promo@gmail.com');
  assert.equal(mailboxKey('...@gmail.com'), '...@gmail.com');
  assert.equal(mailboxKey('a.b@c@gmail.com'), 'a.b@c@gmail.com');
  assert.equal(mailboxKey('@gmail.com'), '@gmail.com');
  assert.equal(mailboxKey('not-an-email'), 'not-an-email');
});

test('the boot that adds users.mailbox_key fills it in for existing members, behind an index that is not unique', () => {
  assert.equal(storedKey('user_legacy'), 'legacymember@gmail.com');

  const index = (db.prepare('PRAGMA index_list(users)').all() as Array<{ name: string; unique: number }>).find(
    (i) => i.name === 'idx_users_mailbox_key',
  );
  assert.ok(index, 'idx_users_mailbox_key exists');
  // Accounts that already share an inbox exist; a UNIQUE index could not be built.
  assert.equal(index.unique, 0);

  // The lookup sign-in runs reads the index rather than scanning every member.
  const plan = db
    .prepare(
      `EXPLAIN QUERY PLAN SELECT * FROM users
        WHERE mailbox_key = ? AND deleted_at IS NULL
        ORDER BY created_at, id
        LIMIT 10`,
    )
    .all('ab@gmail.com') as Array<{ detail: string }>;
  assert.ok(
    plan.some((step) => step.detail.includes('idx_users_mailbox_key')),
    plan.map((step) => step.detail).join(' | '),
  );
});

test('Google sign-in as ab@gmail.com lands in the a.b@gmail.com password account and links Google to it', () => {
  const paid = member('a.b@gmail.com', { tier: 'basic', verified: true });
  const accountsBefore = userCount();
  const input = { provider: 'google' as const, providerId: 'google-sub-ab', email: 'ab@gmail.com' };

  // A returning login, so the callback leaves the per-IP signup limit alone.
  assert.equal(isReturningOAuthSignIn(db, input.provider, input.providerId, input.email), true);

  const first = resolveOAuthAccount(db, input, createFromOAuth);
  assert.equal(first.via, 'mailbox');
  assert.equal(first.row.id, paid);
  assert.equal(first.row.tier, 'basic');
  assert.equal(userCount(), accountsBefore, 'no new account');
  assert.equal(identityOwner('google', 'google-sub-ab'), paid, 'Google is linked to the paid account');

  // The account itself is as it was: same address, same password, same plan.
  const row = db.prepare('SELECT email, password_hash, tier FROM users WHERE id = ?').get(paid);
  assert.deepEqual({ ...row }, { email: 'a.b@gmail.com', password_hash: PASSWORD_HASH, tier: 'basic' });

  // Every Google sign-in after that goes through the link.
  const again = resolveOAuthAccount(db, input, createFromOAuth);
  assert.equal(again.via, 'identity');
  assert.equal(again.row.id, paid);
  assert.equal(userCount(), accountsBefore);
});

test('a member who signed up before the column existed is found by another spelling too', () => {
  const result = resolveOAuthAccount(
    db,
    { provider: 'google', providerId: 'google-sub-legacy', email: 'LegacyMember@gmail.com' },
    createFromOAuth,
  );
  assert.equal(result.via, 'mailbox');
  assert.equal(result.row.id, 'user_legacy');
  assert.equal(identityOwner('google', 'google-sub-legacy'), 'user_legacy');
});

test('Apple follows the same rule for a Gmail address; a private-relay address only matches exactly', () => {
  const gmailMember = member('mn@gmail.com');
  const viaApple = resolveOAuthAccount(
    db,
    { provider: 'apple', providerId: 'apple-sub-mn', email: 'M.N@googlemail.com' },
    createFromOAuth,
  );
  assert.equal(viaApple.via, 'mailbox');
  assert.equal(viaApple.row.id, gmailMember);
  assert.equal(identityOwner('apple', 'apple-sub-mn'), gmailMember);

  const relayMember = member('x.y@privaterelay.appleid.com');
  const relay = resolveOAuthAccount(
    db,
    { provider: 'apple', providerId: 'apple-sub-relay', email: 'xy@privaterelay.appleid.com' },
    createFromOAuth,
  );
  assert.equal(relay.via, 'created');
  assert.notEqual(relay.row.id, relayMember);
});

test('two live accounts on the inbox: neither is guessed, a new account is made as before, and both are reported', () => {
  const dotted = member('c.d@gmail.com', { tier: 'basic' });
  const tagged = member('cd+trial@gmail.com');
  const input = { provider: 'google' as const, providerId: 'google-sub-cd', email: 'cd@gmail.com' };

  // A new account is coming, so the signup limit applies as it always has.
  assert.equal(isReturningOAuthSignIn(db, input.provider, input.providerId, input.email), false);
  // Password sign-in and reset won't pick one either.
  assert.equal(findAccountForSignIn(db, 'cd@gmail.com'), null);

  const accountsBefore = userCount();
  const result = resolveOAuthAccount(db, input, createFromOAuth);
  assert.equal(result.via, 'created');
  if (result.via !== 'created') return;
  assert.equal(userCount(), accountsBefore + 1);
  assert.equal(result.row.email, 'cd@gmail.com');
  assert.equal(result.row.tier, 'public');
  assert.deepEqual([...result.sameInboxAccountIds].sort(), [dotted, tagged].sort());
  assert.equal(identityOwner('google', 'google-sub-cd'), result.row.id);

  // Neither existing account was linked or changed.
  const linked = db
    .prepare('SELECT COUNT(*) AS n FROM user_identities WHERE user_id IN (?, ?)')
    .get(dotted, tagged) as { n: number };
  assert.equal(linked.n, 0);
  assert.equal((db.prepare('SELECT tier FROM users WHERE id = ?').get(dotted) as { tier: string }).tier, 'basic');
});

test('the account with exactly the reported address still comes before another spelling', () => {
  const exact = member('ef@gmail.com');
  member('e.f@gmail.com', { tier: 'basic' });
  const result = resolveOAuthAccount(
    db,
    { provider: 'google', providerId: 'google-sub-ef', email: 'ef@gmail.com' },
    createFromOAuth,
  );
  assert.equal(result.via, 'email');
  assert.equal(result.row.id, exact);
});

test('a deleted account is never adopted by another spelling, and its exact address is still refused', () => {
  member('g.h@gmail.com', { tier: 'basic', deletedAt: AT });
  const result = resolveOAuthAccount(
    db,
    { provider: 'google', providerId: 'google-sub-gh', email: 'gh@gmail.com' },
    createFromOAuth,
  );
  assert.equal(result.via, 'created');
  if (result.via === 'created') assert.deepEqual(result.sameInboxAccountIds, []);

  member('ij@gmail.com', { deletedAt: AT });
  const accountsBefore = userCount();
  assert.throws(
    () =>
      resolveOAuthAccount(db, { provider: 'google', providerId: 'google-sub-ij', email: 'ij@gmail.com' }, createFromOAuth),
    { message: DELETED_ACCOUNT_MESSAGE },
  );
  assert.equal(userCount(), accountsBefore);
  assert.equal(identityOwner('google', 'google-sub-ij'), undefined);
});

test('a member stranded before the fix: once the free duplicate is deleted, Google sign-in finds the paid account', () => {
  // The 2026-10-21 shape: the paid account under one spelling, and the free one
  // Google sign-in made under the other, holding the Google link.
  const paid = member('y.p@gmail.com', { tier: 'basic' });
  const free = member('yp@gmail.com', { password: false });
  db.prepare(
    `INSERT INTO user_identities (id, user_id, provider, provider_id, created_at, updated_at)
     VALUES ('ident_free', ?, 'google', 'google-sub-yp', ?, ?)`,
  ).run(free, AT, AT);
  const input = { provider: 'google' as const, providerId: 'google-sub-yp', email: 'yp@gmail.com' };

  // The fix alone does not move this member: the existing link wins, by design.
  assert.equal(resolveOAuthAccount(db, input, createFromOAuth).row.id, free);

  // What `make delete-user` does to the free account: the row and everything
  // hanging off it go, Google link included.
  db.exec('BEGIN');
  for (const table of ['sessions', 'user_identities', 'password_reset_tokens']) {
    db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(free);
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(free);
  db.exec('COMMIT');

  // His next Google sign-in, still reporting the dotless spelling, lands in the
  // paid account and links Google to it. No second free account, and no need
  // for him to connect Google from Account first.
  const accountsBefore = userCount();
  const after = resolveOAuthAccount(db, input, createFromOAuth);
  assert.equal(after.via, 'mailbox');
  assert.equal(after.row.id, paid);
  assert.equal(identityOwner('google', 'google-sub-yp'), paid);
  assert.equal(userCount(), accountsBefore);
});

test('any other domain is matched exactly, as before', () => {
  const workspace = member('k.l@zerogex.io', { tier: 'basic' });
  const result = resolveOAuthAccount(
    db,
    { provider: 'google', providerId: 'google-sub-kl', email: 'kl@zerogex.io' },
    createFromOAuth,
  );
  assert.equal(result.via, 'created');
  assert.notEqual(result.row.id, workspace);
  if (result.via === 'created') assert.deepEqual(result.sameInboxAccountIds, []);
});

test('a failure after the new account is inserted leaves no account and no link behind', () => {
  const accountsBefore = userCount();
  assert.throws(
    () =>
      resolveOAuthAccount(db, { provider: 'google', providerId: 'google-sub-boom', email: 'boom@gmail.com' }, (email) => {
        createFromOAuth(email);
        throw new Error('referral bookkeeping blew up');
      }),
    /referral bookkeeping blew up/,
  );
  assert.equal(userCount(), accountsBefore);
  assert.equal(identityOwner('google', 'google-sub-boom'), undefined);
  assert.equal(db.prepare('SELECT 1 FROM users WHERE email = ?').get('boom@gmail.com'), undefined);
});

test('password sign-in and reset find the one live account on another spelling, and no other', () => {
  const nq = member('n.q@gmail.com', { tier: 'basic' });
  assert.deepEqual(signInFor('n.q@gmail.com'), { id: nq, via: 'email' });
  assert.deepEqual(signInFor('nq@gmail.com'), { id: nq, via: 'mailbox' });
  assert.deepEqual(signInFor(' N.Q+news@GoogleMail.com '), { id: nq, via: 'mailbox' });

  // Two live spellings: no choice is made.
  member('r.s@gmail.com');
  member('rs+1@gmail.com');
  assert.equal(signInFor('rs@gmail.com'), null);
  // Only a deleted account on the inbox: as unknown as before.
  member('t.u@gmail.com', { deletedAt: AT });
  assert.equal(signInFor('tu@gmail.com'), null);
  // Another domain: exact only.
  member('v.w@example.com');
  assert.equal(signInFor('vw@example.com'), null);
});

test('registration sees every spelling of the inbox, deleted accounts included', () => {
  member('o.p@gmail.com');
  assert.equal(accountOnMailbox(db, 'op+alt@gmail.com'), 'live');
  assert.equal(accountOnMailbox(db, 'o.p@gmail.com'), 'live');

  member('s.t@gmail.com', { deletedAt: AT });
  assert.equal(accountOnMailbox(db, 'st@gmail.com'), 'deleted');
  // A live account on the inbox wins over a deleted one.
  member('st+again@gmail.com');
  assert.equal(accountOnMailbox(db, 's.t@googlemail.com'), 'live');

  assert.equal(accountOnMailbox(db, 'brand.new@gmail.com'), null);
  member('y.z@example.com');
  assert.equal(accountOnMailbox(db, 'yz@example.com'), null);
  assert.equal(accountOnMailbox(db, 'Y.Z@example.com'), 'live');
});

test('deriveMailboxKeys repairs a row written without the key, and writes nothing once all are right', () => {
  // A script that knows nothing about the column, and a key gone stale.
  db.prepare(`INSERT INTO users (id, email, tier, created_at, updated_at) VALUES ('user_script', 'w.x@gmail.com', 'public', ?, ?)`).run(
    AT,
    AT,
  );
  const stale = member('q.r@gmail.com');
  db.prepare(`UPDATE users SET mailbox_key = 'wrong@gmail.com' WHERE id = ?`).run(stale);

  assert.equal(deriveMailboxKeys(db), 2);
  assert.equal(storedKey('user_script'), 'wx@gmail.com');
  assert.equal(storedKey(stale), 'qr@gmail.com');
  assert.equal(deriveMailboxKeys(db), 0);
});

// ---------------------------------------------------------------------------
// make gmail-duplicates
// ---------------------------------------------------------------------------

const script = fileURLToPath(new URL('../scripts/gmail-duplicates.mts', import.meta.url));
const sha256 = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function runReport(authDbPath: string): string {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', script], {
    // The script reads .env.local from its working directory; there is none in
    // the temp dir, so AUTH_DB_PATH is the only database it can find.
    cwd: dir,
    env: { PATH: process.env.PATH ?? '', AUTH_DB_PATH: authDbPath, NODE_ENV: 'test' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('the report lists each Gmail inbox with more than one account and changes nothing, before the migration too', () => {
  // Shaped like production today: users.mailbox_key does not exist yet.
  const reportDb = path.join(dir, 'report.db');
  const r = new DatabaseSync(reportDb);
  r.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT, tier TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      subscription_status TEXT, last_seen_at TEXT, deleted_at TEXT
    );
    CREATE TABLE user_identities (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT NOT NULL, provider_id TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
  const add = r.prepare(
    `INSERT INTO users (id, email, password_hash, tier, created_at, updated_at, subscription_status, last_seen_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  add.run('u1', 'first.last@gmail.com', PASSWORD_HASH, 'basic', '2026-10-19T14:00:00.000Z', AT, 'active', '2026-11-17T19:14:05.000Z', null);
  add.run('u2', 'firstlast@gmail.com', null, 'public', '2026-10-21T18:00:00.000Z', AT, null, '2026-10-21T18:35:00.000Z', null);
  add.run('u3', 'solo.member@gmail.com', PASSWORD_HASH, 'basic', AT, AT, 'active', AT, null);
  add.run('u4', 'p.q@example.com', PASSWORD_HASH, 'public', AT, AT, null, null, null);
  add.run('u5', 'pq@example.com', PASSWORD_HASH, 'public', AT, AT, null, null, null);
  add.run('u6', 'old.one@googlemail.com', PASSWORD_HASH, 'public', '2026-09-01T10:00:00.000Z', AT, null, null, '2026-11-01T09:00:00.000Z');
  add.run('u7', 'oldone+x@gmail.com', PASSWORD_HASH, 'public', '2026-11-02T10:00:00.000Z', AT, null, '2026-11-03T08:00:00.000Z', null);
  r.prepare(`INSERT INTO user_identities VALUES ('i1', 'u2', 'google', 'google-sub-1', ?, ?)`).run(AT, AT);
  r.close();

  const before = sha256(reportDb);
  const out = runReport(reportDb);
  assert.equal(sha256(reportDb), before, 'the database file is byte-for-byte unchanged');
  const cols = (new DatabaseSync(reportDb, { readOnly: true }).prepare('PRAGMA table_info(users)').all() as Array<{
    name: string;
  }>).map((c) => c.name);
  assert.ok(!cols.includes('mailbox_key'), 'no column was added');

  assert.match(out, /^firstlast@gmail\.com — 2 accounts, 2 live$/m);
  assert.match(out, /^ {2}first\.last@gmail\.com +basic +active +2026-11-17 19:14 +2026-10-19 +password$/m);
  assert.match(out, /^ {2}firstlast@gmail\.com +public +- +2026-10-21 18:35 +2026-10-21 +google$/m);
  assert.match(out, /^oldone@gmail\.com — 2 accounts, 1 live$/m);
  assert.match(out, /^ {2}old\.one@googlemail\.com .* deleted 2026-11-01$/m);
  // The inbox holding a paid account comes first.
  assert.ok(out.indexOf('firstlast@gmail.com —') < out.indexOf('oldone@gmail.com —'));
  // A lone Gmail account and another domain's look-alikes are not duplicates.
  assert.doesNotMatch(out, /solo\.member/);
  assert.doesNotMatch(out, /example\.com/);
  assert.match(out, /2 inboxes with more than one account, 4 accounts in all; 1 with more than one live account\./);
});

test('the report says so when there is nothing to list', () => {
  const emptyDb = path.join(dir, 'empty.db');
  const e = new DatabaseSync(emptyDb);
  e.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT, tier TEXT NOT NULL,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL);`);
  e.prepare('INSERT INTO users VALUES (?, ?, NULL, ?, ?, ?)').run('u1', 'only.one@gmail.com', 'public', AT, AT);
  e.close();
  assert.match(runReport(emptyDb), /None\. Every Gmail inbox has at most one account\./);
});
