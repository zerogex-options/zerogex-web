// The Growth page's categorical parameters, in fixed order, plus the record of
// what was checked. Series colors live here rather than inline so the funnel,
// the loss split and the day charts cannot drift apart into three palettes.
//
// VALIDATION (dataviz six-checks, against both real surfaces — dark #001A26 and
// light #EEF1F6) — only the pairs that actually appear together were scored,
// because no chart on this page draws more than three series at once:
//
//   arrivals   #BC5090 ↔ #FFA600   CVD ΔE 28.7 · normal ΔE 30.1   PASS
//   losses     #FFA600 ↔ #FF6361 ↔ #8A93A8   worst CVD ΔE 10.3    PASS
//   reach      #8C83D6 ↔ #4CAF93   CVD ΔE 13.2 · normal ΔE 19.3   PASS
//
// Two checks are knowingly not met, and both are choices rather than oversights:
//
//   * Lightness band. #FFA600, #FF6361 and #4CAF93 sit just above the dark
//     band's ceiling. They are the product's own tokens (--color-warning IS
//     #FFA600 in dark mode) and are used by every other chart in the admin area;
//     re-stepping them here alone would make this one tab disagree with the five
//     next to it for no legibility gain — all three clear 3:1 against the dark
//     surface.
//   * Chroma floor. LOSS_UNKNOWN reads gray on purpose: it is the "we cannot
//     attribute this" bucket, and a saturated hue would give an absence of
//     evidence the same visual weight as a known cause.
//
// Contrast against the LIGHT surface warns for the saturated fills, which
// obligates relief rather than forbidding them: every figure on this page is
// directly labeled and every chart has a table beside or beneath it.
//
// #58508D — the X series' old color — was replaced by #8C83D6 outright. It
// measured 2.51:1 against the dark surface and read as gray there, which is a
// legibility bug rather than a preference.

/** New accounts arriving. Matches the registrations series in the day charts. */
export const REGISTRATION_COLOR = '#BC5090';
/** Anything in flight: a trial running, a member who chose to leave. */
export const TRIAL_COLOR = '#FFA600';
/** Money that stopped without anyone deciding it should. */
export const FAILURE_COLOR = '#FF6361';
/** Off-platform reach. */
export const X_COLOR = '#8C83D6';
export const GOOGLE_COLOR = '#4CAF93';

/** The three causes a paying customer can be lost for, in reporting order. */
export const LOSS_VOLUNTARY = TRIAL_COLOR;
export const LOSS_NONPAYMENT = FAILURE_COLOR;
export const LOSS_UNKNOWN = '#8A93A8';

/**
 * The funnel is ONE population narrowing, not four categories, so it is drawn in
 * a single hue and the bar length carries the magnitude. Coloring the four
 * stages differently would imply they are different things being compared.
 */
export const FUNNEL_COLOR = TRIAL_COLOR;
/** What fell out between two stages. */
export const DROP_COLOR = FAILURE_COLOR;

/** Line over bars, for a trailing mean drawn on top of raw counts. */
export const SMOOTH_COLOR = '#FFFFFF';
