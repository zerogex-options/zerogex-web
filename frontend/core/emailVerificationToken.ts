// Pure decision for an email-verification link: given the token's row (joined
// to its user), what should opening it do? Kept free of DB, Next and crypto
// imports so it can be unit tested on its own (tests/emailVerificationToken.test.ts);
// consumeEmailVerification in core/serverAuth.ts does the lookup and the writes.
//
// The rule that matters: a link for an account that is ALREADY verified never
// shows an error. Two real cases hit that error even though the account was
// fine. Outlook's Safe Links scanner opens the link a fraction of a second
// before the member does and uses it up (a signup on 2026-09-27). A double click
// or a reload does the same (2026-09-30). Both members landed on "That
// verification link is no longer valid" with a verified account. Opening a
// link mints no session, so saying "verified" for a used or expired link of a
// verified account changes nothing and gives nothing away.

export type VerificationTokenRow = {
  expires_at: string;
  consumed_at: string | null;
  // The user's, not the token's: set once the account is verified by any link.
  email_verified_at: string | null;
};

export type VerificationTokenOutcome =
  // Unused and in date: stamp the account verified and use the token up.
  | 'verify'
  // Used or expired, but the account is verified: show the verified banner.
  | 'already_verified_used'
  | 'already_verified_expired'
  // The account is not verified: the member needs a fresh link.
  | 'expired'
  | 'invalid';

export function classifyVerificationToken(
  row: VerificationTokenRow | null | undefined,
  nowMs: number,
): VerificationTokenOutcome {
  if (!row) return 'invalid';
  const expired = new Date(row.expires_at).getTime() <= nowMs;
  if (row.email_verified_at) {
    if (row.consumed_at) return 'already_verified_used';
    if (expired) return 'already_verified_expired';
  }
  if (row.consumed_at) return 'invalid';
  if (expired) return 'expired';
  return 'verify';
}
