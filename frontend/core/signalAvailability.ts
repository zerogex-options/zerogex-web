// Why a tier-gated signal has no value on screen — as a value, not a guess.
//
// A signal panel that shows nothing can be in five completely different
// states: the viewer isn't entitled to it, the symbol has no data, the request
// failed, the session hasn't resolved yet, or the backend genuinely returned
// no reading. Every one of those used to render the same bare "N/A", because
// useApiData collapses all of them into `data === null` and the consumer only
// had that null to look at.
//
// That cost real money and real triage time. A Basic viewer on the Dealer
// Positioning page saw "N/A — No expansion signal available" over the Pro-only
// vol-expansion signal and reasonably filed it as broken: no upgrade prompt
// was ever shown, and support burned a round-trip on a feature working exactly
// as specified. The same "N/A" is what a genuine outage looks like, so the
// reverse mistake is available too — if the signal engine stops writing rows,
// Pro users see the identical cell and nobody can tell the difference.
//
// This module is the single place that maps (entitlement, request outcome) to
// a state a UI can speak about. It is pure and import-free so it can be unit
// tested directly under `node --experimental-strip-types`, the same discipline
// core/api/apiTierGate.ts follows.

// `resolving` covers both an unresolved session and an in-flight first fetch:
// they are the same thing to a viewer (nothing to say yet) and neither should
// flash a wrong answer. `ready` means "the request path is healthy" — the
// caller still decides whether the value it got is renderable, so a backend
// that answers 200 with a null reading stays distinct from one that 404s.
export type SignalAvailability =
  | { kind: 'ready' }
  | { kind: 'resolving' }
  | { kind: 'locked'; requiredTier: string }
  | { kind: 'unsupported' }
  | { kind: 'error' };

export interface SignalAvailabilityInput {
  /** The viewer's tier meets the signal's minimum. */
  entitled: boolean;
  /** The session is still resolving, so `entitled` is not yet meaningful. */
  tierResolving: boolean;
  /** A usable value is on hand (stale or fresh). */
  hasValue: boolean;
  /** A request is in flight. */
  loading: boolean;
  /** A request failed. Separate from `errorStatus` because a transport-level
   *  failure (DNS, offline, CORS) never produces a status to read. */
  hasError: boolean;
  /** HTTP status of the last failed response; null for success, no request
   *  yet, or a transport-level failure that never produced a status. */
  errorStatus: number | null;
  /** The tier the signal requires, surfaced so the UI can name the upsell. */
  requiredTier: string;
}

/**
 * Resolve why a tier-gated signal has (or hasn't) got a value to show.
 *
 * Order matters, and each step earns its place:
 *
 * 1. A value we already hold wins over everything. A refresh that 500s must
 *    not blank a good reading — the panel keeps rendering what it has, which
 *    is both what the old code did and what a trader wants.
 * 2. An unresolved session can't distinguish entitled from not, so it reports
 *    `resolving` rather than guessing `locked`. This is the fix for the flash:
 *    useHasTierAccess is deliberately fail-closed and reads false while the
 *    session is in flight, which is right for a hard gate but wrong for a
 *    label — it made every Pro viewer see the locked state on first paint.
 * 3. Client-side entitlement comes before the status codes because a
 *    non-entitled viewer never fires the request at all (the `enabled` guard),
 *    so there is no status to read — just an absence that means "locked".
 * 4. A 403 still maps to `locked` even when the client thought it was
 *    entitled: the BFF is the authority, and a stale session that outlived a
 *    downgrade should show the upsell, not an error.
 * 5. 404 is the symbol having no row, which is a coverage fact, not a fault.
 * 6. Any other status, or a transport failure with no status at all, is a real
 *    error and should look like one — the case that used to hide behind "N/A".
 */
export function resolveSignalAvailability(
  input: SignalAvailabilityInput,
): SignalAvailability {
  const { entitled, tierResolving, hasValue, loading, hasError, errorStatus, requiredTier } = input;

  if (hasValue) return { kind: 'ready' };
  if (tierResolving) return { kind: 'resolving' };
  if (!entitled) return { kind: 'locked', requiredTier };
  if (hasError && errorStatus === 403) return { kind: 'locked', requiredTier };
  if (hasError && errorStatus === 404) return { kind: 'unsupported' };
  if (hasError) return { kind: 'error' };
  if (loading) return { kind: 'resolving' };

  // Entitled, settled, no error, no value: the request path is healthy and the
  // backend simply had no reading to give. The caller renders its own empty
  // state for this — which is the ONE case the original bare "N/A" was
  // actually right about.
  return { kind: 'ready' };
}
