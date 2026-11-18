// One inbox, one account.
//
// Gmail ignores dots in the part of an address before the @, and everything
// from a "+" on, so first.last@gmail.com, firstlast@gmail.com and
// firstlast+zgx@gmail.com all land in the same inbox; googlemail.com is the
// same service under its older name. Sign-in used to compare addresses
// exactly. A member who registered with one spelling and later chose "Sign in
// with Google" while Google reported another got a brand-new free account, and
// every Google sign-in after that landed there, behind the paywall (a Basic
// member, 2026-10-21; docs/outreach/2026-11-17-yordan-spx-0dte-oi-heatmap.md).
//
// mailboxKey() is the form that two spellings of one inbox share. It is used
// ONLY to match an address to an account. users.email keeps the address as the
// member entered it, and that is still where every email goes.
//
// Deliberately strict: the only rules applied are ones that are true of the
// mailbox. Dots and +tags fold for gmail.com and googlemail.com and nowhere
// else. Google Workspace domains and other providers can treat a dot as part
// of the name, and some deliver a "+" literally, so for every other domain the
// key is the lower-cased address and nothing more. Two addresses with the same
// key are always one inbox. Two with different keys may still be one (an
// Outlook +tag, say); those stay separate accounts, exactly as before.
//
// Not core/moneyBackGuarantee.canonicalEmail. That one also drops +tags on
// every domain, which suits "one refund per customer", where a false match
// costs one refund. Here a false match would sign somebody into another
// person's account.
//
// Stored as users.mailbox_key (core/db.ts), indexed, and NOT unique: accounts
// that already share an inbox exist (`make gmail-duplicates` lists them), and
// nothing here merges them.

import type { DatabaseSync } from 'node:sqlite';

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

export function mailboxKey(raw: string): string {
  const email = raw.trim().toLowerCase();
  const at = email.indexOf('@');
  // Exactly one "@" with something before it. Anything else is not an address
  // whose inbox rules are known, so it is left as it is.
  if (at < 1 || at !== email.lastIndexOf('@')) return email;
  if (!GMAIL_DOMAINS.has(email.slice(at + 1))) return email;
  const local = email.slice(0, at);
  const plus = local.indexOf('+');
  const name = (plus === -1 ? local : local.slice(0, plus)).replaceAll('.', '');
  // "+tag@gmail.com" or ".@gmail.com" names no inbox. Folding it would give
  // every address like it the same key.
  return name ? `${name}@gmail.com` : email;
}

export function isGmailAddress(raw: string): boolean {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  return at > 0 && GMAIL_DOMAINS.has(email.slice(at + 1));
}

/**
 * Bring users.mailbox_key into line with users.email on every row. core/db.ts
 * calls this on every boot: the boot that adds the column, it fills it in, and
 * after that it repairs any row written by something that did not set it (a
 * script, a hand-run INSERT) or under an older version of the rule. Writes
 * nothing when every key is already right, which is the normal case. Returns
 * the number of rows it changed.
 *
 * Unlike the one-shot backfills in core/db.ts, this one is safe to re-run: the
 * column is derived from users.email and from nothing else, so re-deriving it
 * can only ever correct it.
 */
export function deriveMailboxKeys(db: DatabaseSync): number {
  const rows = db.prepare('SELECT id, email, mailbox_key FROM users').all() as Array<{
    id: string;
    email: string;
    mailbox_key: string | null;
  }>;
  const stale = rows.filter((row) => row.mailbox_key !== mailboxKey(row.email));
  if (stale.length === 0) return 0;
  const update = db.prepare('UPDATE users SET mailbox_key = ? WHERE id = ?');
  db.exec('BEGIN');
  try {
    for (const row of stale) update.run(mailboxKey(row.email), row.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return stale.length;
}

export type UserRow = Record<string, unknown>;

/**
 * Live (not soft-deleted) accounts on the same inbox as `email`, oldest first.
 * Includes the account with exactly this address, if there is one. Bounded,
 * because callers only need to tell none, one and several apart.
 */
export function findLiveAccountsOnMailbox(db: DatabaseSync, email: string): UserRow[] {
  return db
    .prepare(
      `SELECT * FROM users
        WHERE mailbox_key = ? AND deleted_at IS NULL
        ORDER BY created_at, id
        LIMIT 10`,
    )
    .all(mailboxKey(email)) as UserRow[];
}

export type SignInAccount = {
  row: UserRow;
  // 'email': the account has exactly this address. 'mailbox': it is the one
  // live account on another spelling of the same Gmail inbox.
  via: 'email' | 'mailbox';
};

/**
 * The live account a typed address belongs to, for password sign-in and
 * password reset: the account with exactly this address, else the ONE live
 * account on another spelling of the same Gmail inbox. Several such accounts
 * are duplicates this will not choose between, and like no match at all they
 * return null, which is what an unknown address returned before.
 *
 * Neither caller grants anything on the match alone. Sign-in still needs that
 * account's password, and a reset link goes to the address on the account,
 * which for a Gmail spelling is the same inbox that asked.
 */
export function findAccountForSignIn(db: DatabaseSync, email: string): SignInAccount | null {
  const normalized = email.trim().toLowerCase();
  const exact = db
    .prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL')
    .get(normalized) as UserRow | undefined;
  if (exact) return { row: exact, via: 'email' };
  const sameInbox = findLiveAccountsOnMailbox(db, normalized);
  return sameInbox.length === 1 ? { row: sameInbox[0], via: 'mailbox' } : null;
}

/**
 * Whether any account, deleted or not, already holds this inbox under any
 * spelling: 'live' if a live one does (it wins when both exist), 'deleted' if
 * only soft-deleted ones do, else null. Registration refuses both, so one inbox
 * cannot be opened as a second account, nor as a fresh one after a deletion.
 */
export function accountOnMailbox(db: DatabaseSync, email: string): 'live' | 'deleted' | null {
  const row = db
    .prepare(
      `SELECT deleted_at FROM users
        WHERE mailbox_key = ?
        ORDER BY deleted_at IS NOT NULL
        LIMIT 1`,
    )
    .get(mailboxKey(email)) as { deleted_at: string | null } | undefined;
  if (!row) return null;
  return row.deleted_at == null ? 'live' : 'deleted';
}
