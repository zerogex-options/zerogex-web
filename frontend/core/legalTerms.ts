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
