// The active-key cap, in a client-safe module of its own.
//
// core/apiKeys.ts is `server-only`, so the account UI can't import from it —
// and this number has to be identical in four places (the server key client,
// the BFF route that enforces it, the component that renders "2 of 3 used",
// and the tests). One home for it keeps those from drifting apart.

/**
 * How many API keys one account may hold active at the same time.
 *
 * Sized for the case this exists to serve: a couple of machines plus a
 * charting platform (desktop + laptop + NinjaTrader). Revoked keys don't
 * count against it.
 *
 * This is a mirror, not the authority. The key service enforces the same cap
 * itself (`kp.MAX_ACTIVE_KEYS_PER_USER`) and answers a request over it with a
 * 409, so a caller that bypasses this UI still can't exceed it. Keep the two
 * in step; if they ever disagree, the service wins and the BFF surfaces its
 * refusal.
 */
export const MAX_ACTIVE_API_KEYS = 3;
