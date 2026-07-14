import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeRawPath,
  dirToRouteTemplate,
  buildRouteMatchers,
  matchRouteTemplate,
  heuristicNormalizePath,
  normalizePagePath,
  MAX_PATH_LENGTH,
} from '../core/pageAnalyticsPaths.ts';

// The real ZeroGEX dynamic page routes (see `find app -type d -name '[*]'`),
// alongside a representative sample of static ones.
const ZEROGEX_TEMPLATES = [
  '/',
  '/dashboard',
  '/gamma-exposure',
  '/education/gamma-exposure-explained',
  '/help/platform/[slug]',
  '/cards/[id]',
  '/forecast/[symbol]',
  '/forecast/[symbol]/[date]',
  '/replay/[symbol]',
  '/replay/[symbol]/[date]',
  '/replay/[symbol]/[date]/snapshot/[time]',
  '/scorecard/[symbol]',
  '/scorecard/[symbol]/[date]',
];

test('sanitizeRawPath strips query strings and fragments', () => {
  assert.equal(sanitizeRawPath('/dashboard?tab=flow'), '/dashboard');
  assert.equal(sanitizeRawPath('/dashboard#section'), '/dashboard');
  assert.equal(sanitizeRawPath('/scorecard/SPX?x=1#y'), '/scorecard/SPX');
});

test('sanitizeRawPath normalizes slashes and trailing slash', () => {
  assert.equal(sanitizeRawPath('/foo//bar///baz'), '/foo/bar/baz');
  assert.equal(sanitizeRawPath('/dashboard/'), '/dashboard');
  assert.equal(sanitizeRawPath('/'), '/');
  assert.equal(sanitizeRawPath('///'), '/');
});

test('sanitizeRawPath rejects non-absolute or empty input', () => {
  assert.equal(sanitizeRawPath('dashboard'), null);
  assert.equal(sanitizeRawPath(''), null);
  assert.equal(sanitizeRawPath('   '), null);
  assert.equal(sanitizeRawPath(undefined), null);
  assert.equal(sanitizeRawPath(42), null);
  assert.equal(sanitizeRawPath('https://evil.com/x'), null);
});

test('sanitizeRawPath strips control characters and caps length', () => {
  // Explicit control-byte escapes (NUL + DEL) so this source file stays clean text.
  assert.equal(sanitizeRawPath('/foo\x00bar\x7f'), '/foobar');
  const long = '/' + 'a'.repeat(MAX_PATH_LENGTH + 100);
  const cleaned = sanitizeRawPath(long);
  assert.ok(cleaned && cleaned.length === MAX_PATH_LENGTH);
});

test('dirToRouteTemplate drops route groups and parallel slots', () => {
  assert.equal(dirToRouteTemplate('scorecard/[symbol]/[date]'), '/scorecard/[symbol]/[date]');
  assert.equal(dirToRouteTemplate('(marketing)/pricing'), '/pricing');
  assert.equal(dirToRouteTemplate('dashboard/@modal/settings'), '/dashboard/settings');
  assert.equal(dirToRouteTemplate(''), '/');
});

test('concrete dynamic paths collapse to their route template', () => {
  const matchers = buildRouteMatchers(ZEROGEX_TEMPLATES);
  const cases: Array<[string, string]> = [
    ['/cards/abc123XYZ', '/cards/[id]'],
    ['/scorecard/SPX', '/scorecard/[symbol]'],
    ['/scorecard/SPX/2026-07-14', '/scorecard/[symbol]/[date]'],
    ['/forecast/SPX/2026-07-14', '/forecast/[symbol]/[date]'],
    ['/replay/SPX/2026-07-14/snapshot/09-31-00', '/replay/[symbol]/[date]/snapshot/[time]'],
    ['/help/platform/getting-started', '/help/platform/[slug]'],
  ];
  for (const [concrete, template] of cases) {
    assert.equal(normalizePagePath(concrete, matchers), template, `${concrete} -> ${template}`);
  }
});

test('static routes pass through untouched', () => {
  const matchers = buildRouteMatchers(ZEROGEX_TEMPLATES);
  assert.equal(normalizePagePath('/dashboard', matchers), '/dashboard');
  assert.equal(normalizePagePath('/gamma-exposure', matchers), '/gamma-exposure');
  assert.equal(
    normalizePagePath('/education/gamma-exposure-explained', matchers),
    '/education/gamma-exposure-explained',
  );
  assert.equal(normalizePagePath('/', matchers), '/');
});

test('a distinct id per visit does not create distinct pages', () => {
  const matchers = buildRouteMatchers(ZEROGEX_TEMPLATES);
  const templates = new Set<string>();
  for (let i = 0; i < 50; i += 1) {
    const t = normalizePagePath(`/cards/card_${i}_${i * 7}`, matchers);
    if (t) templates.add(t);
  }
  assert.deepEqual([...templates], ['/cards/[id]']);
});

test('more specific templates win over catch-alls', () => {
  const matchers = buildRouteMatchers(['/blog/[...rest]', '/blog/[slug]', '/blog/featured']);
  assert.equal(matchRouteTemplate('/blog/featured', matchers), '/blog/featured');
  assert.equal(matchRouteTemplate('/blog/my-post', matchers), '/blog/[slug]');
  assert.equal(matchRouteTemplate('/blog/2026/07/roundup', matchers), '/blog/[...rest]');
});

test('optional catch-all matches its own base path', () => {
  const matchers = buildRouteMatchers(['/docs/[[...slug]]']);
  assert.equal(matchRouteTemplate('/docs', matchers), '/docs/[[...slug]]');
  assert.equal(matchRouteTemplate('/docs/a/b/c', matchers), '/docs/[[...slug]]');
});

test('heuristic fallback collapses id-like segments but keeps slugs', () => {
  assert.equal(heuristicNormalizePath('/unknown/2026-07-14'), '/unknown/[date]');
  assert.equal(heuristicNormalizePath('/unknown/12345'), '/unknown/[id]');
  assert.equal(heuristicNormalizePath('/unknown/a1b2c3d4e5f6a1b2'), '/unknown/[id]');
  assert.equal(heuristicNormalizePath('/unknown/order-42abcdef'), '/unknown/[id]');
  // Human-readable slugs must survive untouched.
  assert.equal(
    heuristicNormalizePath('/education/gamma-exposure-explained'),
    '/education/gamma-exposure-explained',
  );
});

test('normalizePagePath returns null for unusable input', () => {
  const matchers = buildRouteMatchers(ZEROGEX_TEMPLATES);
  assert.equal(normalizePagePath('not-a-path', matchers), null);
  assert.equal(normalizePagePath(null, matchers), null);
});
