// Effective date of the currently published Terms of Service and Privacy
// Policy (both carry the same date), in two forms: an ISO string used as the
// version recorded against a user's acceptance, and the human label rendered
// on /terms and /privacy.
//
// The ISO form is what lands in users.terms_version_accepted at registration.
// Versioning the acceptance by effective date — rather than an opaque 'v1' —
// is what makes the stored row usable as evidence: it identifies exactly WHICH
// text the member agreed to, which is the question a card issuer asks when a
// chargeback turns on what the customer was told at signup.
//
// When the terms are materially revised, bump BOTH constants in the same
// commit. Existing rows keep the older date, which is correct — they accepted
// the older text.
export const TERMS_VERSION = '2026-04-25';
export const TERMS_EFFECTIVE_DATE_LABEL = 'April 25, 2026';

// The acceptance gate, in one place so the route and registerUser can't drift
// into disagreeing about what counts. Takes `unknown` deliberately: the value
// arrives from a JSON request body, where a TypeScript annotation is a claim
// about the shape rather than a guarantee of it, so the type is checked at
// runtime rather than assumed.
//
// Exact match, not "some version was sent". A member who accepted superseded
// terms in a tab left open across a revision has not agreed to the current
// ones, and recording that they did is the specific failure this whole
// mechanism exists to prevent.
export function isAcceptedTermsVersionCurrent(version: unknown): boolean {
  return typeof version === 'string' && version === TERMS_VERSION;
}

// Minimal shape the acceptance gate needs. Kept loose so the client session
// user (hooks/useAuthSession) can be passed straight through.
export type TermsAcceptanceUser = {
  termsVersionAccepted?: string | null;
};

/**
 * Whether this member still owes an acceptance of the currently published
 * Terms of Service and Privacy Policy — the gate behind the acceptance modal in
 * components/ClientLayout.
 *
 * Keyed on the recorded VERSION rather than on whether anything is recorded at
 * all, which lets one rule answer two different questions:
 *   - NULL: no acceptance was ever recorded. That is every account created
 *     before the signup checkbox shipped, and every Google/Apple signup, whose
 *     callback mints an account with no checkbox to read. Such a row is absent,
 *     not false — so the gate asks the member rather than assuming either way.
 *   - a superseded date: the member agreed to text that is no longer the
 *     published text, so a revision re-asks instead of landing silently on
 *     people who never saw it.
 *
 * A signed-out visitor is never asked; ClientLayout gates on authentication
 * before this is consulted, and the null-guard keeps that true independently.
 */
export function needsTermsAcceptance(user: TermsAcceptanceUser | null | undefined): boolean {
  if (!user) return false;
  return !isAcceptedTermsVersionCurrent(user.termsVersionAccepted);
}
