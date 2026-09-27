// A member's first two weeks: the window in which onboarding help is shown by
// default (the first-run welcome for Basic, Today's Read opened on the
// dashboard) and after which the product gets out of the way.
//
// Counted from users.paid_welcome_email_sent_at, which the Stripe webhook
// claims exactly once per account on the first trialing/active sync
// (maybeSendPaidWelcomeEmail). That makes it "first subscribed at", not "signed
// up at": someone who registered weeks ago and only now starts a trial (the
// reactivation email's extended trial, say) is new to the product, while a
// returning member keeps the stamp from their first subscription and is not.
//
// Pure, no imports, so it runs under node --test and in the browser alike.

export const NEW_MEMBER_WINDOW_DAYS = 14;

const DAY_MS = 86_400_000;

export function isNewMember(
  memberSince: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!memberSince) return false;
  const since = Date.parse(memberSince);
  if (!Number.isFinite(since)) return false;
  // A stamp a little in the future (browser clock behind the server's) is a
  // member who joined moments ago, so only the upper bound is enforced.
  return nowMs - since < NEW_MEMBER_WINDOW_DAYS * DAY_MS;
}
