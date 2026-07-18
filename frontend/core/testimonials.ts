// ── User testimonials ─────────────────────────────────────────────────────────
// A single source of truth for customer quotes, consumed by every marketing
// surface (landing page, pricing, about) and mirrored into shareable assets in
// docs/. Add an entry here and it is instantly available everywhere a
// testimonial component reads from this list — no per-page copy to keep in sync.
//
// Editorial policy: quotes are reproduced faithfully, with only light
// copy-editing for grammar/typos so the author's voice and meaning are
// preserved. Only publish attributed, consented quotes — never fabricate a
// name, a rating, or a review.

export interface Testimonial {
  /** Stable id — React key and a handle for referencing one specific quote. */
  id: string;
  /**
   * The full testimonial. Paragraphs are separated by a blank line (`\n\n`);
   * components split on that so the copy renders as real paragraphs.
   */
  quote: string;
  /**
   * One high-signal line pulled from the quote, for constrained surfaces
   * (pricing strip, share card) where the full testimonial is too long.
   */
  pullQuote: string;
  /** Attribution name, exactly as it should appear publicly. */
  author: string;
  /** What the author does — the credibility line under their name. */
  role: string;
  /** Optional extra context tag, e.g. how they use ZeroGEX. */
  context?: string;
  /** Optional outbound link for the author (X / site). Rendered if present. */
  href?: string;
  /** Monogram shown in the avatar chip when there is no photo. */
  initials: string;
  /** Verified customer — renders the "Verified" marker. Never set unverified. */
  verified?: boolean;
  /** Surfaced first, and used on single-quote surfaces. */
  featured?: boolean;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 'johnny-d-market-sentinel',
    quote:
      'ZeroGEX has been a genuine turning point in the development of my Market Sentinel system. ' +
      'Its structured, integration-friendly API and broad range of options-market data — including ' +
      'GEX profiles, flip range, call and put walls, vanna and charm, volatility, flow, and snapshot — ' +
      'have given me a powerful way to add market structure and confirmation-or-divergence context to ' +
      'my decision-support workflow. It turns a large amount of complex information into clear, ' +
      'practical context that my system can use.' +
      '\n\n' +
      'The website is equally impressive. It delivers substantial functionality and a dense range of ' +
      'market information through a clean, intuitive design that is easy on the eyes and easy to ' +
      'navigate. Compared with other services I have used, ZeroGEX does an exceptional job of making ' +
      'sophisticated data feel clear and actionable rather than overwhelming. Michael has built ' +
      'something genuinely valuable, and I strongly recommend ZeroGEX to traders who want serious ' +
      'options-market insight presented in a thoughtful, usable way.',
    pullQuote:
      'ZeroGEX does an exceptional job of making sophisticated data feel clear and actionable rather than overwhelming.',
    author: 'Johnny D.',
    role: 'Builder of Market Sentinel',
    context: 'Verified ZeroGEX API user',
    initials: 'JD',
    verified: true,
    featured: true,
  },
];

/**
 * The single highest-signal testimonial, for surfaces that show exactly one
 * (the pricing strip, the share card). Falls back to the first entry so this
 * never returns undefined as long as the list is non-empty.
 */
export const FEATURED_TESTIMONIAL: Testimonial =
  TESTIMONIALS.find((t) => t.featured) ?? TESTIMONIALS[0];
