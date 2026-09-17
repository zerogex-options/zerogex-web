// ONE encoding, used everywhere on this panel: a declined invoice is colored by
// WHAT HAPPENED TO THE MONEY, never by what caused the decline and never by
// which kind of charge it was.
//
// That is a deliberate reduction. The obvious design gives every decline reason
// its own hue and every charge kind another, which is eight or nine categorical
// colors on one screen — past the point where anyone can hold the key in their
// head, and past what any palette can keep separable under colorblindness. So
// cause and kind are FACETS instead: they become rows, each row drawn in the
// same three colors. "Of the trial conversions that declined, how many came
// back" then reads as a shape comparison down a column rather than as a
// color-matching exercise.
//
// This is a STATUS palette, not a categorical one — good / warning / critical —
// so every use ships with its label beside it and never encodes by color alone.
//
// VALIDATION (dataviz six-checks, run against both real surfaces — dark #001A26
// and light #EEF1F6):
//
//   #4CAF93 ↔ #FFA600 ↔ #FF6361
//     adjacent CVD  worst ΔE 11.8 (deutan) · tritan 13.6   PASS
//     all pairs CVD worst ΔE  9.1 (deutan)                 PASS
//     normal vision worst ΔE 17.4                          PASS
//     contrast      dark all ≥ 3:1                         PASS
//                   light 1.7–2.6:1                        WARN → relief below
//
// Two checks are knowingly not met, both matching the choices already recorded
// in ../growth/palette.ts rather than re-litigating them here:
//
//   * Lightness band. All three sit above the dark band's ceiling. They are the
//     product's own tokens (--color-warning IS #FFA600 in dark mode, --accent-4
//     IS #FF6361) and are what every other chart in the admin area uses; re-
//     stepping them on this panel alone would make the Stripe tab disagree with
//     the five next to it for no legibility gain. All three clear 3:1 against
//     the dark surface.
//   * Contrast on the LIGHT surface warns for all three, which obligates relief
//     rather than forbidding them. Every figure on this panel is directly
//     labeled and every chart has the same numbers in a table beside or beneath
//     it, which is that relief.

/** The money came back. Any route: an automatic retry, a new card, a manual pay. */
export const RECOVERED_COLOR = '#4CAF93';
/** Still unpaid and still recoverable — Stripe has retries left. Not a loss yet. */
export const AT_RISK_COLOR = '#FFA600';
/** Unpaid, and nothing is going to change that. This is the number that hurts. */
export const LOST_COLOR = '#FF6361';

/**
 * Successful charges, for the rate charts where declines are drawn against the
 * volume they came out of. Deliberately recessive: it is the backdrop the
 * declines are read against, not a fourth category competing with them.
 */
export const PAID_COLOR = '#8A93A8';

/**
 * Ranked cause tables are ONE population sorted by size, not N categories being
 * compared, so they are drawn in a single hue and the bar length carries the
 * magnitude — the same rule ../growth/palette.ts applies to its funnel.
 */
export const CAUSE_RANK_COLOR = '#BC5090';
