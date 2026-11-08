// Pure selection logic for the "what's new since you left" bullets.
//
// The list in content/winback-highlights.json was flat and undated, so every
// churned member received the identical four items no matter when they left. A
// member who left in June and one who left last week got the same "a lot has
// changed" email, and for the second of them it was simply untrue — which is the
// fastest way to teach someone that your mail is not worth opening.
//
// Dating each item fixes that at the data layer rather than in copy: the same
// template, filtered against the reader's own churn date, produces a different
// email for every cohort automatically and can never repeat itself for a given
// reader. That is also why this is worth doing for the RETURN-INTENT sweep,
// which can reach the same member more than once over a year.
//
// Kept PURE (no imports at all) so it's unit-tested without a DB or the mailer —
// same discipline as core/cancelRetention.ts. Locked down in
// tests/winbackHighlights.test.ts.

export type HighlightText = { title: string; body: string };

export type DatedHighlight = {
  title: string;
  body: string;
  // ISO date (YYYY-MM-DD or a full timestamp) this shipped. OPTIONAL: an item
  // with no `since` is evergreen and shown to everyone, which is what keeps a
  // half-dated file working and makes dating an item opt-in rather than a
  // migration. Unparseable values are treated as absent, never as epoch 0 —
  // guessing a date here would silently mis-file an item into every cohort.
  since?: string | null;
  // The same bullet in the site's other languages, by locale code ("de"), for
  // the returning-member wall (app/unauthorized), which shows the member's
  // language. The emails are English-only and never read it. Optional per item
  // and per language: a missing translation shows the English.
  translations?: Readonly<Record<string, HighlightText>>;
};

// The bullet in the reader's language, or in English when it has none.
export function localizeHighlight(item: DatedHighlight, locale: string): HighlightText {
  const translations = item.translations;
  if (locale !== 'en' && translations && Object.prototype.hasOwnProperty.call(translations, locale)) {
    return translations[locale];
  }
  return { title: item.title, body: item.body };
}

export type HighlightSelection = {
  // What to render, most recent first, undated items last.
  items: DatedHighlight[];
  // How many of `items` are genuinely NEW to this reader — i.e. dated after
  // they left. The caller uses this to pick its framing: leading with "a lot
  // has changed" when this is 0 is a claim the bullets underneath disprove.
  freshCount: number;
};

function parseMs(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Pick the highlights worth showing a member who left at `sinceIso`.
 *
 * Ordering is newest-dated first, then undated items — so the lead bullet is
 * always the strongest "this is new to you" claim available.
 *
 * `minItems` is a floor, not a filter override: when fewer than that many items
 * are genuinely new, the newest already-seen ones are appended to keep the list
 * substantive. They are NOT counted in `freshCount`, so the caller still knows
 * the difference between "four new things" and "one new thing plus context".
 *
 * An absent or unparseable `sinceIso` returns everything, newest first, with
 * `freshCount` 0: we cannot honestly call anything new to a reader whose
 * departure date we don't know, and silently treating them as a fresh churner
 * would put the strongest novelty claim in front of exactly the people most
 * likely to know better.
 */
export function selectHighlightsSince(
  all: readonly DatedHighlight[],
  sinceIso: string | null | undefined,
  opts?: { minItems?: number },
): HighlightSelection {
  const minItems = opts?.minItems ?? 3;

  // Stable newest-first ordering, undated last. Sort a copy — callers pass the
  // module-level default list, and sorting it in place would mutate shared state.
  const ordered = [...all].sort((a, b) => {
    const aMs = parseMs(a.since);
    const bMs = parseMs(b.since);
    if (aMs == null && bMs == null) return 0;
    if (aMs == null) return 1;
    if (bMs == null) return -1;
    return bMs - aMs;
  });

  const sinceMs = parseMs(sinceIso);
  if (sinceMs == null) {
    return { items: ordered, freshCount: 0 };
  }

  const fresh: DatedHighlight[] = [];
  const evergreen: DatedHighlight[] = [];
  const alreadySeen: DatedHighlight[] = [];
  for (const item of ordered) {
    const itemMs = parseMs(item.since);
    if (itemMs == null) evergreen.push(item);
    else if (itemMs > sinceMs) fresh.push(item);
    else alreadySeen.push(item);
  }

  // Evergreen items ship to everyone and are never counted as new. That is the
  // whole point of leaving an item undated: the operator could not verify when
  // it landed, so it must not be filtered out of any cohort — but it also must
  // not be claimed as new to one.
  const items = [...fresh, ...evergreen];
  // Only then top up from what they've already seen, so a recent leaver still
  // gets a substantive list. These are not new to them and are not counted.
  if (items.length < minItems) {
    items.push(...alreadySeen.slice(0, minItems - items.length));
  }
  return { items, freshCount: fresh.length };
}

/**
 * Validate the parsed contents of content/winback-highlights.json.
 *
 * The fs read stays in the callers (they are scripts with their own cwd); only
 * the shape-checking lives here, so both senders agree on what a valid item is
 * and `since` survives the trip. Returns null for anything unusable — a missing
 * file, bad JSON, or a list with no valid rows — and every caller falls back to
 * the mailer's built-in defaults rather than failing a send over editable
 * content.
 *
 * An item is valid on title + body alone. `since` is optional by design (see
 * DatedHighlight) and a malformed one is dropped to null rather than rejecting
 * the item: losing a date costs a bullet its cohort targeting, while rejecting
 * the row costs the reader the bullet entirely.
 */
export function parseHighlightsJson(raw: unknown): DatedHighlight[] | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const list = (raw as { highlights?: unknown }).highlights;
  if (!Array.isArray(list)) return null;

  const items: DatedHighlight[] = [];
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { title, body, since, translations } = entry as {
      title?: unknown;
      body?: unknown;
      since?: unknown;
      translations?: unknown;
    };
    if (typeof title !== 'string' || title.trim() === '') continue;
    if (typeof body !== 'string' || body.trim() === '') continue;
    const parsedTranslations = parseTranslations(translations);
    items.push({
      title: title.trim(),
      body: body.trim(),
      since: typeof since === 'string' && parseMs(since) != null ? since.trim() : null,
      ...(parsedTranslations ? { translations: parsedTranslations } : {}),
    });
  }
  return items.length > 0 ? items : null;
}

// An item's `translations`: each two-letter language with both a title and a
// body is kept, anything else is dropped, and so is the field when nothing is
// left. Like a bad date, a bad translation never costs the reader the bullet;
// that language just shows it in English.
function parseTranslations(raw: unknown): Record<string, HighlightText> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const out: Record<string, HighlightText> = {};
  for (const [locale, value] of Object.entries(raw)) {
    if (!/^[a-z]{2}$/.test(locale) || typeof value !== 'object' || value === null) continue;
    const { title, body } = value as { title?: unknown; body?: unknown };
    if (typeof title !== 'string' || title.trim() === '') continue;
    if (typeof body !== 'string' || body.trim() === '') continue;
    out[locale] = { title: title.trim(), body: body.trim() };
  }
  return Object.keys(out).length > 0 ? out : null;
}
