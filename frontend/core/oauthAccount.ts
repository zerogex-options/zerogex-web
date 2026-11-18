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
//   1. An identity already linked to a live account signs in there.
//   2. Otherwise an address that belongs to a soft-deleted account is refused,
//      so signing in again cannot revive it.
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
// sign-in is step 1.

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

export function resolveOAuthAccount(
  db: DatabaseSync,
  input: { provider: OAuthProvider; providerId: string; email: string },
  // Inserts the new account and returns its id. Called inside this function's
  // transaction, so a failure anywhere after it leaves no half-made account.
  createAccount: (normalizedEmail: string) => string,
): OAuthAccountResolution {
  const normalizedEmail = input.email.trim().toLowerCase();

  const identityRow = db
    .prepare(
      `SELECT u.* FROM users u
       JOIN user_identities i ON i.user_id = u.id
       WHERE i.provider = ? AND i.provider_id = ? AND u.deleted_at IS NULL`,
    )
    .get(input.provider, input.providerId) as UserRow | undefined;
  if (identityRow) return { via: 'identity', row: identityRow };

  // A soft-deleted account must not be revived by signing in with the provider
  // again. Refuse before anything resolves by address, with a clear message,
  // rather than letting the flow fall through to a fresh-signup INSERT that
  // would collide on the still-present email row.
  //
  // Checked AFTER the linked identity above, which only ever finds a live
  // account and so cannot revive this one. Merging a duplicate by hand means
  // moving its Google link onto the account it merges into and soft-deleting
  // it, while Google keeps reporting the duplicate's spelling. Checking the
  // address first refused that member's every Google sign-in.
  const deletedRow = db
    .prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NOT NULL')
    .get(normalizedEmail) as { id: string } | undefined;
  if (deletedRow) {
    throw new Error(DELETED_ACCOUNT_MESSAGE);
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
