// The pure half of the page snapshot exporter — CSS selection and naming.
//
// core/pageSnapshot.ts rasterizes a page by serializing a clone of it into an
// SVG <foreignObject>. A serialized clone leaves the document behind, and with
// it every stylesheet, so the clone arrives at the rasterizer completely
// unstyled unless the CSS travels with it. core/chartImageExport.ts solves the
// same problem for a chart's <svg> by inlining ~25 resolved paint properties
// onto every node, which works there because an SVG's appearance is carried by
// a short, known list of properties. An app page's is not: it is Tailwind
// utilities, pseudo-elements, media queries and a few hundred custom
// properties, and there is no subset of computed declarations that reproduces
// it faithfully.
//
// So the page exporter takes the other route — it ships the stylesheets rather
// than the computed results. That needs three transforms, all of them here so
// they can be tested without a browser:
//
//   1. FLATTEN. Everything the app's CSS is wrapped in — @layer (all of
//      Tailwind v4), @media, @supports — is unwrapped, and the conditional
//      groups are evaluated against the live window first. A snapshot is taken
//      at one viewport in one colour scheme, so baking in the breakpoint that
//      was actually on screen is both smaller and more faithful than shipping
//      every breakpoint and hoping the rasterizer picks the same one.
//
//   2. REWRITE THE ROOT. `:root`, `html` and `body` select the document
//      element and the body, neither of which exists inside a <foreignObject>.
//      Every such selector is repointed at the wrapper the export builds, which
//      carries the same classes <html> does — so `:root.dark`, `:root.palette-x`
//      and the variables they define keep working, and the capture comes out in
//      the theme the reader is actually looking at.
//
//   3. DROP WHAT CANNOT APPLY. Rules that need a pointer (`:hover`), focus, or
//      a selector that matches nothing in the captured subtree are left out.
//      This is what keeps the payload sane: the framework ships styling for the
//      whole app, and one page uses a small slice of it.
//
// Nothing here touches the DOM or the CSSOM — the caller adapts both into the
// plain shapes below. That keeps the interesting logic testable under node
// (tests/pageSnapshot.test.ts) instead of only in a browser.

/** A `selector { … }` rule, reduced to what the exporter needs. */
export interface SnapshotStyleRule {
  kind: 'style';
  selectorText: string;
  /** The rule's declaration block WITHOUT braces, e.g. `color:red;`. */
  declarations: string;
}

/** An @media / @supports / @layer block, whose children are re-examined. */
export interface SnapshotGroupRule {
  kind: 'group';
  /**
   * How the condition is tested. `media` goes to matchMedia, `supports` to
   * CSS.supports, `none` always holds — which is what @layer is, and what an
   * at-rule we have no way to evaluate (@container, @scope) is treated as, on
   * the grounds that keeping a block that might not apply beats dropping one
   * that does.
   */
  conditionKind: 'media' | 'supports' | 'none';
  conditionText: string;
  rules: SnapshotRule[];
}

/** A rule copied through untouched — @property, which Tailwind v4 relies on. */
export interface SnapshotVerbatimRule {
  kind: 'verbatim';
  cssText: string;
}

export type SnapshotRule = SnapshotStyleRule | SnapshotGroupRule | SnapshotVerbatimRule;

export interface FlattenOptions {
  /** Does this selector match the captured subtree (or its wrapper)? */
  matchesCapture(selector: string): boolean;
  /** Does this @media / @supports condition hold right now? */
  conditionHolds(kind: 'media' | 'supports', condition: string): boolean;
  /** The class the export's wrapper carries, e.g. `.zgx-snapshot-root`. */
  rootSelector: string;
  /** Stop after this many rules, so a pathological sheet cannot hang the export. */
  ruleBudget?: number;
}

const DEFAULT_RULE_BUDGET = 60_000;

// State that exists only while a human is pointing at or tabbing through the
// page. None of it can be true of a raster, so these rules are dead weight —
// and `:hover` in particular is a large share of a utility framework's output.
const UNREACHABLE_STATE =
  /:(hover|focus|focus-visible|focus-within|active|visited|target|autofill|-moz-focusring)\b/;

// Pseudo-elements are real in the raster (Tailwind's preflight leans on
// ::before/::after), but querySelector cannot be asked about them — so they are
// stripped for the match test only, and the rule keeps its original selector.
const PSEUDO_ELEMENT = /::[a-z-]+(\([^)]*\))?/g;

/**
 * Split a selector list on its top-level commas.
 *
 * `:is(a, b) c, d` is two selectors, not three — a naive `split(',')` breaks
 * every `:is()`/`:where()`/`:not()` list in the sheet, which in Tailwind v4 is
 * most of the interesting ones.
 */
export function splitSelectorList(selectorText: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (const ch of selectorText) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Repoint document-level selectors at the export's wrapper.
 *
 * `:root`, `html` and `body` only ever appear as the leftmost compound of a
 * selector, so the rewrite is anchored there: `:root.dark` becomes
 * `.zgx-snapshot-root.dark`, `body .card` becomes `.zgx-snapshot-root .card`,
 * and `html body` collapses to the wrapper alone (the wrapper stands in for
 * both). A `.card :root` — which is meaningless CSS — is left untouched.
 */
export function rewriteRootSelector(selector: string, rootSelector: string): string {
  let out = selector.trim();
  // `html body …` and `html > body …`: the wrapper is both, so the second one
  // would otherwise become a descendant of itself and match nothing.
  out = out.replace(/^html\s*>?\s*body\b/, rootSelector);
  out = out.replace(/^:root\b/, rootSelector);
  out = out.replace(/^html\b/, rootSelector);
  out = out.replace(/^body\b/, rootSelector);
  return out;
}

/**
 * Resolve a nested rule's selector against the rule it is nested in.
 *
 * CSS nesting is how a utility framework expresses a variant — `.sm:flex` is a
 * bare selector wrapping an @media block whose child selector is just `&` — so
 * a flattener that ignored the parent would emit rules selecting nothing. `&`
 * becomes `:is(parent)` rather than the parent verbatim because the parent may
 * be a selector LIST, and `.a, .b:hover` spliced in unparenthesised changes
 * which rule the declarations belong to. A nested selector with no `&` is a
 * descendant of the parent, which is what the nesting spec says it means.
 */
export function resolveNestedSelector(selectorText: string, parentSelector: string): string {
  if (!parentSelector) return selectorText;
  const parent = `:is(${parentSelector})`;
  return splitSelectorList(selectorText)
    .map((part) => (part.includes('&') ? part.replace(/&/g, parent) : `${parent} ${part}`))
    .join(',');
}

/** True when the rewritten selector is aimed at the wrapper itself. */
function targetsRoot(selector: string, rootSelector: string): boolean {
  return selector.startsWith(rootSelector);
}

/**
 * Should this rule travel with the capture?
 *
 * Exported for the tests, which is also the honest description of it: the whole
 * question of what a snapshot's CSS payload contains comes down to this one
 * predicate, and it is much easier to check here than by eyeballing a PNG.
 */
export function keepStyleRule(
  selectorText: string,
  { matchesCapture, rootSelector }: Pick<FlattenOptions, 'matchesCapture' | 'rootSelector'>,
): { keep: boolean; selectorText: string } {
  const kept: string[] = [];
  for (const raw of splitSelectorList(selectorText)) {
    if (UNREACHABLE_STATE.test(raw)) continue;
    const rewritten = rewriteRootSelector(raw, rootSelector);
    // Anything aimed at the wrapper is kept without a match test. This is the
    // rule that carries every custom property — `:root { --bg-card: … }` and
    // its `.dark` twin — so a match test that went wrong here would cost the
    // capture its entire palette rather than one style.
    if (targetsRoot(rewritten, rootSelector)) {
      kept.push(rewritten);
      continue;
    }
    const probe = rewritten.replace(PSEUDO_ELEMENT, '').trim();
    if (!probe) continue;
    if (matchesCapture(probe)) kept.push(rewritten);
  }
  return kept.length > 0
    ? { keep: true, selectorText: kept.join(',') }
    : { keep: false, selectorText: '' };
}

/**
 * Flatten a stylesheet tree into the CSS text a capture should carry.
 *
 * Conditional groups are resolved rather than preserved (see the file header),
 * so the output is a flat list of `selector{…}` rules plus any @property
 * declarations, in source order — which keeps the cascade's tie-breaks in the
 * order the live page resolved them.
 */
export function flattenSnapshotCss(rules: SnapshotRule[], options: FlattenOptions): string {
  const budget = options.ruleBudget ?? DEFAULT_RULE_BUDGET;
  const out: string[] = [];
  let seen = 0;

  const walk = (list: SnapshotRule[]) => {
    for (const rule of list) {
      if (seen >= budget) return;
      seen += 1;
      if (rule.kind === 'verbatim') {
        out.push(rule.cssText);
        continue;
      }
      if (rule.kind === 'group') {
        if (
          rule.conditionKind !== 'none' &&
          !options.conditionHolds(rule.conditionKind, rule.conditionText)
        ) {
          continue;
        }
        walk(rule.rules);
        continue;
      }
      if (!rule.declarations) continue;
      const verdict = keepStyleRule(rule.selectorText, options);
      if (!verdict.keep) continue;
      out.push(`${verdict.selectorText}{${rule.declarations}}`);
    }
  };

  walk(rules);
  return out.join('');
}

/**
 * The page name to print on the snapshot's header band.
 *
 * Three sources in falling order of trust:
 *
 *   1. the label the nav files the route under — curated, and already the
 *      string the page's own header is supposed to match
 *   2. the page's first heading, for the routes the menu does not list (a dated
 *      replay, a scorecard permalink, a guide)
 *   3. the document title, last, because it is written for a browser tab and a
 *      search result: it carries the " — ZeroGEX" suffix and sometimes a whole
 *      standfirst, so it is trimmed at its first separator
 *
 * The nav label leads rather than the heading because a heading is markup, not
 * text: `<h2>Hedging Flow<BetaBadge/></h2>` reads out of the DOM as "Hedging
 * FlowBeta", and a frame that prints that looks broken rather than beta.
 */
export function resolveSnapshotTitle(sources: {
  headingText?: string | null;
  navLabel?: string | null;
  documentTitle?: string | null;
}): string {
  const nav = sources.navLabel?.trim();
  if (nav) return nav;
  const heading = sources.headingText?.replace(/\s+/g, ' ').trim();
  if (heading) return heading;
  const title = sources.documentTitle?.split(/\s+[—·|]\s+/)[0]?.trim();
  if (title) return title;
  return 'ZeroGEX';
}

/**
 * `zerogex-spy-hedging-flow-2026-09-17.png`.
 *
 * Built from the route rather than the page title so the same page always
 * files under the same name, whatever a heading happens to say that day, and
 * so two symbols never overwrite each other in a downloads folder.
 */
export function snapshotFileName(
  pathname: string | null | undefined,
  symbol: string | null | undefined,
  dateKey: string,
): string {
  const slug = (pathname ?? '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9/-]+/g, '-')
    .replace(/\//g, '-')
    .toLowerCase();
  const ticker = (symbol ?? '').replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
  const parts = ['zerogex', ticker, slug || 'home', dateKey].filter(Boolean);
  return `${parts.join('-')}.png`;
}
