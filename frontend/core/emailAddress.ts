// The one answer to "could this ever be an email address?", shared by:
//   - the signup form (core/serverAuth.ts registerUser), so a typo is caught
//     while the person is still on the page, before it becomes an account
//     that can never be verified;
//   - the free levels-email form (core/levelsSubscribers.ts, through the
//     re-export in core/levelsEmail.ts);
//   - the verify-reminder job (scripts/send-verify-reminders.mts), which skips
//     an address that fails it instead of failing the run.
//
// Deliberately permissive. The confirmation email is what actually proves an
// address works, so the only job here is to reject what can never be an
// address and to canonicalize what can, before it reaches a UNIQUE index.
// Being stricter than this is how you end up refusing real addresses at
// unusual TLDs for no benefit.
//
// Rules: one @, non-empty local part, a dot-bearing domain, no whitespace, no
// angle brackets or commas (a pasted "Name <a@b.com>" or a comma-separated
// list is a mistake, not an address), dots only between other characters, and
// a 254-character ceiling (RFC 5321's practical limit).
//
// Kept PURE (no imports): tests run it under node --experimental-strip-types,
// and core/serverAuth.ts, which the request proxy loads, pulls in nothing
// else with it. Locked down in tests/emailAddress.test.ts.

const MAX_EMAIL_LENGTH = 254;
const EMAIL_SHAPE = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;

// A dot at the start or end of either half, or two in a row: "name.@gmail.com",
// ".name@x.com", "first..last@x.com", "name@.x.com", "name@gmail..com",
// "name@gmail.com.". RFC 5322 allows that only inside a quoted local part,
// which nobody types into a form. EMAIL_SHAPE alone let these through, and
// Resend refuses them before sending ("Invalid `to` field"): on 2026-11-24 a
// signup with a dot right before the @ failed the verify-reminder job, and
// paged the operator, every 2 hours.
const MISPLACED_DOT = /^\.|\.\.|\.@|@\.|\.$/;

/**
 * Canonical storage form of an address, or null when it cannot be one.
 *
 * Lowercased because a UNIQUE index must treat Foo@x.com and foo@x.com as one
 * address; otherwise the same human subscribes twice and gets two copies of
 * every send. Note this lowercases the LOCAL part too, which is technically
 * case-sensitive per RFC 5321; in practice no mail provider in use treats it
 * that way, and the alternative (two rows, two emails, one annoyed reader) is
 * the worse failure.
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > MAX_EMAIL_LENGTH) return null;
  if (!EMAIL_SHAPE.test(trimmed)) return null;
  if (MISPLACED_DOT.test(trimmed)) return null;
  return trimmed;
}
