// Pure path <-> route-template logic for first-party page analytics. No
// `server-only`, no `fs`, no DB imports at module scope — everything here is a
// pure function so it can be unit-tested directly with `node --test`
// (mirrors the deliberate split in core/pricing.ts vs core/monitoring.ts).
//
// Why normalize at all: usePathname() on the client reports the *concrete*
// URL (e.g. /scorecard/SPX/2026-07-14). Recording those verbatim explodes the
// cardinality of the per-page table — every symbol/date permalink becomes its
// own "page". Collapsing a concrete path back to its Next.js route template
// (/scorecard/[symbol]/[date]) is what makes "individual pages" a bounded,
// aggregatable set. The server module (core/pageAnalytics.ts) discovers the
// real templates off the filesystem and hands them here; this module does the
// matching and provides a heuristic fallback for anything unmatched.

/** Hard cap on a stored path string. Longer inputs are truncated. */
export const MAX_PATH_LENGTH = 512;

/**
 * Clean a raw pathname into a canonical form suitable for matching/storage:
 * strips query + hash, collapses duplicate slashes, removes a trailing slash
 * (except root), drops control characters, and caps the length. Returns null
 * for anything that isn't a usable absolute path.
 */
export function sanitizeRawPath(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  // Drop query string and fragment — analytics is per-page, not per-query.
  let p = input.split('#')[0].split('?')[0].trim();
  if (!p) return null;
  // Remove ASCII control chars that have no business in a URL path.
  p = p.replace(/[\x00-\x1f\x7f]/g, '');
  if (!p.startsWith('/')) return null;
  // Collapse runs of slashes (//foo///bar -> /foo/bar).
  p = p.replace(/\/{2,}/g, '/');
  // Strip trailing slash but keep the root as "/".
  if (p.length > 1) p = p.replace(/\/+$/, '');
  if (p === '') p = '/';
  if (p.length > MAX_PATH_LENGTH) p = p.slice(0, MAX_PATH_LENGTH);
  return p;
}

/**
 * Convert an app-router directory path (relative to app/, POSIX separators)
 * into its URL route template. Route groups `(marketing)` contribute nothing
 * to the URL and are dropped; dynamic segments are preserved verbatim
 * (`[id]`, `[...rest]`, `[[...rest]]`). Returns "/" for the root.
 */
export function dirToRouteTemplate(relDir: string): string {
  const segments = relDir
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    // Route groups and parallel-route slots never appear in the URL.
    .filter((s) => !(s.startsWith('(') && s.endsWith(')')))
    .filter((s) => !s.startsWith('@'));
  if (segments.length === 0) return '/';
  return '/' + segments.join('/');
}

function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type RouteMatcher = {
  template: string;
  regex: RegExp;
  /** Static (literal) segment count — higher wins when several templates match. */
  staticSegments: number;
  /** True if the template ends in a catch-all; these match last. */
  catchAll: boolean;
};

/**
 * Compile a single route template into a matcher. Single dynamic segments
 * (`[x]`) match exactly one path segment; catch-alls (`[...x]`) match one or
 * more; optional catch-alls (`[[...x]]`) match zero or more.
 */
export function templateToMatcher(template: string): RouteMatcher {
  const segments = template.split('/').filter((s) => s.length > 0);
  let staticSegments = 0;
  let catchAll = false;
  let pattern = '';
  for (const seg of segments) {
    const optionalCatchAll = /^\[\[\.\.\..+\]\]$/.test(seg);
    const requiredCatchAll = /^\[\.\.\..+\]$/.test(seg);
    const dynamic = /^\[.+\]$/.test(seg);
    if (optionalCatchAll) {
      // Zero or more segments: the leading slash is part of the optional group.
      pattern += '(?:/[^/]+)*';
      catchAll = true;
    } else if (requiredCatchAll) {
      pattern += '/[^/]+(?:/[^/]+)*';
      catchAll = true;
    } else if (dynamic) {
      pattern += '/[^/]+';
    } else {
      pattern += '/' + escapeRegexLiteral(seg);
      staticSegments += 1;
    }
  }
  if (pattern === '') pattern = '/';
  return {
    template,
    regex: new RegExp(`^${pattern}$`),
    staticSegments,
    catchAll,
  };
}

/**
 * Build an ordered matcher list from route templates. Ordering matters: a
 * concrete path can satisfy multiple templates (e.g. a hypothetical
 * /forecast/[symbol] vs /forecast/[...rest]), so match the most specific
 * first — most static segments, then non-catch-all before catch-all.
 */
export function buildRouteMatchers(templates: string[]): RouteMatcher[] {
  const seen = new Set<string>();
  const matchers: RouteMatcher[] = [];
  for (const t of templates) {
    if (seen.has(t)) continue;
    seen.add(t);
    matchers.push(templateToMatcher(t));
  }
  matchers.sort((a, b) => {
    if (a.catchAll !== b.catchAll) return a.catchAll ? 1 : -1;
    if (b.staticSegments !== a.staticSegments) return b.staticSegments - a.staticSegments;
    // Longer (more segments) templates are more specific; break ties stably.
    return b.template.length - a.template.length;
  });
  return matchers;
}

/** Return the template of the first matcher that matches, or null. */
export function matchRouteTemplate(pathname: string, matchers: RouteMatcher[]): string | null {
  for (const m of matchers) {
    if (m.regex.test(pathname)) return m.template;
  }
  return null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}[:-]?\d{2}(?:[:-]?\d{2})?$/;
// An id-ish segment: pure digits, a long hex/alnum token, or a
// digit+letter mix (uuids, nanoids, hashes, numeric ids).
const NUMERIC_RE = /^\d+$/;
// A long *continuous* token (no hyphen word-separators) — opaque ids/hashes.
// Hyphens are deliberately excluded so readable slugs like
// "gamma-exposure-explained" are NOT mistaken for ids; genuinely id-shaped
// hyphenated values (uuids, "order-42ab") contain digits and are caught by
// MIXED_ID_RE instead.
const LONG_TOKEN_RE = /^[A-Za-z0-9_]{16,}$/;
const MIXED_ID_RE = /^(?=.*\d)(?=.*[A-Za-z])[A-Za-z0-9_-]{8,}$/;

/**
 * Best-effort normalization for paths that matched no known template — junk
 * URLs, attacker-supplied paths, or routes added after the template cache was
 * built. Collapses obviously-variable segments to placeholders so a flood of
 * distinct ids can't blow up the table, while leaving human-readable slugs
 * (e.g. /education/gamma-exposure-explained) intact.
 */
export function heuristicNormalizePath(pathname: string): string {
  const segments = pathname.split('/').filter((s) => s.length > 0);
  const mapped = segments.map((seg) => {
    if (DATE_RE.test(seg)) return '[date]';
    if (NUMERIC_RE.test(seg)) return '[id]';
    if (TIME_RE.test(seg) && /\d{3,}/.test(seg)) return '[time]';
    if (MIXED_ID_RE.test(seg)) return '[id]';
    if (LONG_TOKEN_RE.test(seg)) return '[id]';
    return seg;
  });
  if (mapped.length === 0) return '/';
  return '/' + mapped.join('/');
}

/**
 * The full pipeline: sanitize a raw pathname, collapse it to a known route
 * template when possible, else fall back to the heuristic. Returns null only
 * when the input isn't a usable absolute path.
 */
export function normalizePagePath(rawPath: unknown, matchers: RouteMatcher[]): string | null {
  const clean = sanitizeRawPath(rawPath);
  if (clean === null) return null;
  const matched = matchRouteTemplate(clean, matchers);
  if (matched) return matched;
  return heuristicNormalizePath(clean);
}
