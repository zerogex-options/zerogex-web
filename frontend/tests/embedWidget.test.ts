import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SYMBOLS } from '../core/symbols.ts';
import { isPublicRoute, requiredTierForRoute } from '../core/auth.ts';

process.env.NEXT_PUBLIC_AUTH_ENABLED = '1';

// The embeddable gamma-levels widget and the llms.txt pair.
//
// Both surfaces are read by machines on OTHER people's infrastructure: the
// widget by browsers rendering a third-party page, llms.txt by crawlers and
// answer engines. Neither has a user who will notice it quietly breaking, and
// a published embed that starts 302ing to /login or a llms.txt whose links rot
// fails silently on someone else's site. The facts below are the ones that
// span files, which is where that kind of breakage comes from.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');

const nextConfig = readFileSync(path.join(ROOT, 'next.config.ts'), 'utf8');
const sitemapConfig = readFileSync(path.join(ROOT, 'next-sitemap.config.mjs'), 'utf8');
const embedRoute = readFileSync(path.join(ROOT, 'app/embed/[symbol]/route.ts'), 'utf8');
const imageRoute = readFileSync(path.join(ROOT, 'app/embed/image/[symbol]/route.tsx'), 'utf8');
const levelsCard = readFileSync(path.join(ROOT, 'app/embed/image/[symbol]/levelsCard.tsx'), 'utf8');
const embedBuilder = readFileSync(path.join(ROOT, 'app/embed/EmbedBuilder.tsx'), 'utf8');
const llmsTxt = readFileSync(path.join(ROOT, 'core/llmsTxt.ts'), 'utf8');

// core/articleRegistry.ts cannot be imported here: it resolves '@/core/...',
// which the bundler understands and node's --experimental-strip-types loader
// does not. Read the slug/kind pairs out of the source instead — the same
// approach tests/integrations.test.ts takes to next-sitemap.config.mjs, which
// is unreachable for the mirror-image reason.
const registrySource = readFileSync(path.join(ROOT, 'core/articleRegistry.ts'), 'utf8');
const REGISTRY: { slug: string; kind: string }[] = [
  ...registrySource
    .slice(registrySource.indexOf('ARTICLE_REGISTRY'))
    .matchAll(/slug: '([^']+)',[\s\S]*?kind: '([^']+)'/g),
].map((m) => ({ slug: m[1], kind: m[2] }));

// ---------------------------------------------------------------------------
// Reachability
// ---------------------------------------------------------------------------

test('the widget frames and the builder page are anonymously reachable', () => {
  // A gated frame renders as a broken box on every site that embeds one, and
  // the failure shows up on the embedder's page rather than on ours.
  assert.equal(requiredTierForRoute('/embed'), null);
  for (const symbol of SYMBOLS) {
    assert.ok(isPublicRoute(`/embed/${symbol}`), `/embed/${symbol} is not public`);
    assert.equal(requiredTierForRoute(`/embed/${symbol}`), null);
  }
});

test('every pickable symbol has the levels page its widget links back to', () => {
  // The frame's attribution link and the builder's snippet are both built from
  // the symbol, so a ticker added to SYMBOLS without a landing would ship a
  // widget whose only outbound link 404s.
  for (const symbol of SYMBOLS) {
    const page = path.join(ROOT, 'app', `${symbol.toLowerCase()}-gamma-levels`, 'page.tsx');
    assert.ok(existsSync(page), `${symbol} has no /${symbol.toLowerCase()}-gamma-levels page`);
  }
});

// /embed also has to render without the app chrome. That is not asserted here:
// it is one instance of a rule covering every IndicatorPageShell consumer, and
// it lives with the rule in tests/pageShell.test.ts.

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------

test('the frames opt out of the site-wide X-Frame-Options, and only the frames', () => {
  // The negative lookahead carries the whole policy. Without the trailing
  // slash it also exempts the /embed builder page — an ordinary landing with
  // every reason to refuse being framed — and matches any future /embed*
  // route by accident.
  assert.match(nextConfig, /source: '\/\(\(\?!embed\/\)\.\*\)'/);
  assert.match(nextConfig, /X-Frame-Options[\s\S]*SAMEORIGIN/);
});

test('the frame route serves frame-ancestors and sets no X-Frame-Options', () => {
  // X-Frame-Options is the stricter of the two when both are present, so one
  // sent from here would silently break every published embed.
  assert.match(embedRoute, /'Content-Security-Policy': "frame-ancestors \*"/);
  assert.ok(!embedRoute.includes('X-Frame-Options'), 'the frame route must not set X-Frame-Options');
});

// ---------------------------------------------------------------------------
// Indexation
// ---------------------------------------------------------------------------

test('the frames are noindex and out of the sitemap; the builder page is in it', () => {
  // The frames repeat verbatim across every host that embeds one. Indexed,
  // they would compete with the /<ticker>-gamma-levels page each advertises.
  assert.match(embedRoute, /'X-Robots-Tag': 'noindex, follow'/);
  assert.match(sitemapConfig, /^\s*'\/embed\/\*',$/m);
  assert.match(sitemapConfig, /^\s*'\/embed',$/m);
});

// ---------------------------------------------------------------------------
// The snippet is the entire SEO mechanism
// ---------------------------------------------------------------------------

test('the snippet puts a real anchor in the host page, not only an iframe', () => {
  // A link inside the frame points from our origin to our origin and is worth
  // nothing. The <a> the snippet writes into the HOST's markup is the link.
  // If this assertion is ever deleted, so is the reason the widget exists.
  const snippet = embedBuilder.slice(
    embedBuilder.indexOf('function buildSnippet'),
    embedBuilder.indexOf('async function copy'),
  );
  assert.ok(snippet.includes('<iframe'), 'snippet lost its iframe');
  assert.match(snippet, /<a href="\$\{SITE\}\/\$\{slug\}">/, 'snippet lost the host-page anchor');
  assert.ok(snippet.includes('data-zerogex-embed'), 'embed.js matches frames by this attribute');
});

test('the resizer only accepts messages from our own origin', () => {
  // It runs on third-party pages. Dropping the origin check would let any
  // frame on the host's page resize our box — or, with a looser selector,
  // theirs.
  const resizer = readFileSync(path.join(ROOT, 'public/embed.js'), 'utf8');
  assert.match(resizer, /event\.origin !== ORIGIN/);
  assert.match(resizer, /contentWindow === event\.source/);
});

// ---------------------------------------------------------------------------
// The PNG card — for every surface that refuses an iframe
// ---------------------------------------------------------------------------

test('the image route is anonymously reachable for every symbol', () => {
  // Hotlinked from Substack, Discord and mail clients. A tier gate here is a
  // broken image on someone else's post.
  for (const symbol of SYMBOLS) {
    assert.ok(isPublicRoute(`/embed/image/${symbol}`), `/embed/image/${symbol} is not public`);
    assert.equal(requiredTierForRoute(`/embed/image/${symbol}`), null);
  }
});

test('the image route accepts the .png suffix the builder hands out', () => {
  // Several target platforms decide whether a pasted URL is an image from the
  // extension before they look at Content-Type, so the builder always emits
  // `.png`. If the route stops stripping it, every published card 404s.
  assert.match(imageRoute, /replace\(\/\\\.png\$\/i, ''\)/);
  assert.match(embedBuilder, /\/embed\/image\/\$\{symbol\}\.png/);
});

test('the card states its own age, and says it is a snapshot', () => {
  // The whole risk of shipping an image: Substack re-hosts it, Gmail proxies
  // it, Discord serves its own copy — none of them honor our Cache-Control,
  // so a card outlives its 15 minutes and cannot be recalled. A cached card
  // that cannot date itself will eventually present a stale level as current.
  assert.match(levelsCard, /fmtTimestampET\(data\.timestamp\)/);
  assert.ok(levelsCard.includes('snapshot, not live'), 'the card must say it is a snapshot');
});

test('the card can render with no data at all', () => {
  // serverApiGet returns null on any upstream failure. An image route that
  // throws serves a broken-image icon on every page that embeds it, which is
  // far worse than a card that says the levels are unavailable.
  assert.match(levelsCard, /data: GexSummary \| null/);
  assert.match(levelsCard, /levels are not available right now/);
});

test('the image is noindex and carries no utm parameters', () => {
  // It repeats across every host that posts it, and the pasted URL is visible
  // clutter in a chat box. Attribution is printed on the card instead.
  assert.match(imageRoute, /'X-Robots-Tag': 'noindex, follow'/);
  const builder = embedBuilder.slice(
    embedBuilder.indexOf('function buildImageUrl'),
    embedBuilder.indexOf('async function copy'),
  );
  assert.ok(!builder.includes('utm_'), 'the image URL must stay bare');
  assert.match(levelsCard, /zerogex\.io\/\{symbol\.toLowerCase\(\)\}-gamma-levels/);
});

// ---------------------------------------------------------------------------
// llms.txt
// ---------------------------------------------------------------------------

test('llms.txt covers every registered article exactly once', () => {
  // The file is assembled from four `kind` buckets. A fifth kind added to the
  // registry would be silently dropped from the map rather than appearing in
  // some default section.
  assert.ok(REGISTRY.length > 20, 'failed to parse the article registry');
  const kinds = new Set(REGISTRY.map((a) => a.kind));
  const covered = new Set(['pillar', 'tier1', 'tier2', 'article', 'landing']);
  for (const kind of kinds) {
    assert.ok(covered.has(kind), `article kind '${kind}' is not placed in llms.txt`);
  }
  // 'landing' is the one deliberate omission: it has no markdown body and is
  // already linked from the free-tools section by its own URL.
  for (const kind of ['pillar', 'tier1', 'tier2', 'article']) {
    assert.ok(llmsTxt.includes(`byKind('${kind}')`) || llmsTxt.includes(`ARTICLE_REGISTRY['gamma-exposure-explained']`),
      `${kind} is never read when building llms.txt`);
  }
});

test('llms.txt names the pillar explicitly and that slug exists', () => {
  // The "Start here" section reads one slug by hand; a rename would throw at
  // request time on a route with no error boundary.
  assert.ok(llmsTxt.includes("ARTICLE_REGISTRY['gamma-exposure-explained']"));
  assert.ok(
    REGISTRY.some((a) => a.slug === 'gamma-exposure-explained'),
    'the pillar slug llms.txt hardcodes is gone from the registry',
  );
});

test('llms.txt leads with SPX rather than the picker default', () => {
  // core/symbols.ts leads with SPY because that is where a signed-in member
  // lands. This file is read by something deciding what to cite.
  assert.match(llmsTxt, /const DISPLAY_ORDER/);
  const order = llmsTxt.slice(llmsTxt.indexOf('DISPLAY_ORDER'), llmsTxt.indexOf('export async function loadSnapshots'));
  assert.ok(order.indexOf("'SPX'") < order.indexOf("'SPY'"), 'SPX must come before SPY');
  for (const symbol of SYMBOLS) {
    assert.ok(order.includes(`'${symbol}'`), `${symbol} is missing from DISPLAY_ORDER`);
  }
});

test('llms-full.txt inlines a body for every markdown-backed article', () => {
  // The builder skips a registry entry with no .md file (the landings build
  // their content in TSX). Anything else missing a file is a broken link in
  // the curated map above it.
  const missing = REGISTRY
    .filter((a) => a.kind !== 'landing')
    .filter((a) => !existsSync(path.join(ROOT, 'content', 'articles', `${a.slug}.md`)))
    .map((a) => a.slug);
  assert.deepEqual(missing, [], `registry entries with no markdown source: ${missing.join(', ')}`);
});
