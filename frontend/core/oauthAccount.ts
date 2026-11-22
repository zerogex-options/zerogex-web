// Which account a Google or Apple sign-in lands in, and the link from that
// provider identity to it.
//
// Split out of createOrLoginOAuthUser in core/serverAuth.ts so the decision can
// be tested against a real database: serverAuth imports Next and the @/ path
// alias, which the plain node test runner cannot load. serverAuth still owns
// the session, the audit trail and how a brand-new account is created; this
// owns the lookups and the identity link.
//
// The order is the whole policy:
//   1. An address that belongs to a soft-deleted account is refused, so signing
//      in again cannot revive it.
//   2. An identity already linked to a live account signs in there.
//   3. Otherwise the live account with exactly this address is adopted.
//   4. Otherwise the ONE live account on another spelling of the same Gmail
//      inbox is adopted (core/mailboxKey.ts). This is as safe as step 3: the
//      provider attested that the member controls the inbox, and for Gmail
//      every spelling is that same inbox. Apple's private-relay addresses are
//      not Gmail, so they only ever match exactly.
//   5. Otherwise a new account is created. That includes the case where
//      several live accounts share the inbox: they are existing duplicates,
//      and picking one would be a guess, so this keeps the old behavior and
//      reports them for a person to merge.
// Steps 3 to 5 link the identity to the account they settle on, so the next
// sign-in is step 2. When step 3 or 4 adopts an account whose address was never
// verified, the earlier registrant's password, sessions and linked sign-ins are
// removed first, so registering a member's address in advance is no way in.

import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { findLiveAccountsOnMailbox, type UserRow } from './mailboxKey.ts';

export type OAuthProvider = 'google' | 'apple';

export type OAuthAccountResolution =
  | { via: 'identity'; row: UserRow }
  | { via: 'email'; row: UserRow }
  | { via: 'mailbox'; row: UserRow }
  // `sameInboxAccountIds` names the live accounts on other spellings of this
  // inbox when there was more than one to choose between; empty otherwise.
  | { via: 'created'; row: UserRow; sameInboxAccountIds: string[] };

export const DELETED_ACCOUNT_MESSAGE =
  'This account has been deleted. Contact support if you want it restored.';

// Apple marks some addresses unverified (Sign in with Apple at Work & School).
// Such an address can still sign in through an identity already linked by its
// Apple subject, but it must not adopt or create an account by address: the
// adoption below trusts the provider's word that the person reads the inbox.
export const UNVERIFIED_EMAIL_MESSAGE =
  'This sign-in did not come with a verified email address. Sign in another way, or contact support.';

export function resolveOAuthAccount(
  db: DatabaseSync,
  // emailVerified: false only when the provider says it did not verify the
  // address (Apple can); Google tokens without a verified address are refused
  // before this runs (core/oauth.ts).
  input: { provider: OAuthProvider; providerId: string; email: string; emailVerified?: boolean },
  // Inserts the new account and returns its id. Called inside this function's
  // transaction, so a failure anywhere after it leaves no half-made account.
  createAccount: (normalizedEmail: string) => string,
): OAuthAccountResolution {
  const normalizedEmail = input.email.trim().toLowerCase();

  // A soft-deleted account must not be revived by signing in with the provider
  // again. Refuse up front (before identity/email resolution) with a clear
  // message rather than letting the flow fall through to a fresh-signup INSERT
  // that would collide on the still-present email row.
  const deletedRow = db
    .prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NOT NULL')
    .get(normalizedEmail) as { id: string } | undefined;
  if (deletedRow) {
    throw new Error(DELETED_ACCOUNT_MESSAGE);
  }

  const identityRow = db
    .prepare(
      `SELECT u.* FROM users u
       JOIN user_identities i ON i.user_id = u.id
       WHERE i.provider = ? AND i.provider_id = ? AND u.deleted_at IS NULL`,
    )
    .get(input.provider, input.providerId) as UserRow | undefined;
  if (identityRow) return { via: 'identity', row: identityRow };
  if (input.emailVerified === false) {
    throw new Error(UNVERIFIED_EMAIL_MESSAGE);
  }

  db.exec('BEGIN');
  try {
    // Drop any orphaned identity row whose owning user no longer exists. This
    // can happen if a previous delete ran with foreign_keys disabled and the
    // ON DELETE CASCADE never fired, which would otherwise collide with the
    // UNIQUE(provider, provider_id) constraint when we insert below.
    db.prepare(
      `DELETE FROM user_identities
       WHERE provider = ? AND provider_id = ?
         AND user_id NOT IN (SELECT id FROM users)`,
    ).run(input.provider, input.providerId);

    let resolution: OAuthAccountResolution;
    const emailRow = db
      .prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL')
      .get(normalizedEmail) as UserRow | undefined;
    if (emailRow) {
      resolution = { via: 'email', row: emailRow };
    } else {
      const sameInbox = findLiveAccountsOnMailbox(db, normalizedEmail);
      if (sameInbox.length === 1) {
        resolution = { via: 'mailbox', row: sameInbox[0] };
      } else {
        const newId = createAccount(normalizedEmail);
        const created = db.prepare('SELECT * FROM users WHERE id = ?').get(newId) as UserRow | undefined;
        if (!created) throw new Error('OAuth signup succeeded but user lookup failed');
        resolution = {
          via: 'created',
          row: created,
          sameInboxAccountIds: sameInbox.map((row) => String(row.id)),
        };
      }
    }

    const now = new Date().toISOString();
    if (resolution.via !== 'created' && !resolution.row.email_verified_at) {
      // Nobody ever proved they own this address: registration logs in before
      // verification. The provider has just proved the person signing in reads
      // the inbox, so whatever the earlier registrant set up goes before the
      // account is adopted: their password, their sessions and any sign-in they
      // linked. Otherwise anyone could register a member's address first and
      // keep a way in after the member signs in with Google or Apple and
      // subscribes (a pre-hijack). The plan, billing and data stay with the
      // account, and the address is now verified.
      const id = String(resolution.row.id);
      db.prepare('UPDATE users SET password_hash = NULL, email_verified_at = ?, updated_at = ? WHERE id = ?').run(
        now,
        now,
        id,
      );
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM user_identities WHERE user_id = ?').run(id);
      const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
      if (fresh) resolution = { ...resolution, row: fresh };
    }
    db.prepare(
      `INSERT INTO user_identities (id, user_id, provider, provider_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, provider) DO UPDATE SET provider_id = excluded.provider_id, updated_at = excluded.updated_at`,
    ).run(
      `ident_${randomBytes(12).toString('hex')}`,
      String(resolution.row.id),
      input.provider,
      input.providerId,
      now,
      now,
    );
    db.exec('COMMIT');
    return resolution;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * True when the OAuth callback is about to sign a returning member in rather
 * than mint a new account; the callbacks skip the per-IP signup limit for
 * those (see isOAuthReturningUser in core/serverAuth.ts). Mirrors the order in
 * resolveOAuthAccount: a linked identity, an account with exactly this address,
 * or the one live account on another spelling of the same Gmail inbox.
 */
export function isReturningOAuthSignIn(
  db: DatabaseSync,
  provider: OAuthProvider,
  providerId: string,
  email: string,
): boolean {
  const identityRow = db
    .prepare(`SELECT 1 FROM user_identities WHERE provider = ? AND provider_id = ?`)
    .get(provider, providerId);
  if (identityRow) return true;
  const normalizedEmail = email.trim().toLowerCase();
  const emailRow = db.prepare('SELECT 1 FROM users WHERE email = ?').get(normalizedEmail);
  if (emailRow) return true;
  return findLiveAccountsOnMailbox(db, normalizedEmail).length === 1;
}
