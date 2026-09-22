// Rate-limit policy for the public levels-email signup endpoint.
//
// The limiter itself is generic and lives in core/rateLimit.ts; this module
// is only the numbers and the reasoning behind them.

import { createFixedWindowLimiter } from './rateLimit.ts';

/**
 * Policy for POST /api/levels-email.
 *
 * Five per hour per IP mirrors SIGNUP_MAX_ATTEMPTS / SIGNUP_WINDOW_MS in
 * core/serverAuth.ts, which is the closest existing public write endpoint.
 * Generous for a person who mistypes their address twice and retries; tight
 * enough that a scripted spray stops after the fifth row.
 *
 * It is NOT the primary abuse defence and does not need to be. Double opt-in
 * means a submission mails at most one confirmation to an address that has not
 * confirmed, and the per-address cooldown in core/levelsEmail.ts bounds that
 * independently of how many IPs the submissions come from. This limit exists to
 * stop one host filling the table with rows, not to stop mail going out.
 */
export const LEVELS_SIGNUP_WINDOW_MS = 60 * 60 * 1000;
export const LEVELS_SIGNUP_MAX_ATTEMPTS = 5;

export const levelsSignupLimiter = createFixedWindowLimiter({
  windowMs: LEVELS_SIGNUP_WINDOW_MS,
  max: LEVELS_SIGNUP_MAX_ATTEMPTS,
});
