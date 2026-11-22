import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { requiredTierForRoute } from '../core/auth.ts';

// Links into a login wall from the pages that pass the most link value. For
// anyone without a plan, Googlebot included, a gated route answers with a 307
// carrying X-Robots-Tag: noindex (proxy.ts), so a link to one hands its share
// of the page's link value to a URL marked noindex.
//
// The footer is on every page, so each of its links is the strongest internal
// link its target gets. The 2026-11-22 crawl found its "Platform" link to
// /dashboard on 125 of 127 pages. A gated link may stay in the footer only
// marked membersOnly, which the component renders for Basic+ members alone.
// The homepage and /about route their tool links through toolHrefFor
// (core/publicToolHref.ts) for the same reason. The components use JSX, so
// they are read as text.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const read = (rel: string) => readFileSync(path.join(HERE, '..', rel), 'utf8');
const footer = read('components/Footer.tsx');

function footerLinks(): Array<{ href: string; body: string }> {
  const start = footer.indexOf('const FOOTER_COLUMNS');
  const end = footer.indexOf('const VETERANS_BADGE_TEXT');
  assert.ok(start > 0 && end > start, 'FOOTER_COLUMNS block not found');
  const block = footer.slice(start, end).replace(/\/\/.*$/gm, '');
  return [...block.matchAll(/\{ href: ([^,}]+)([^}]*)\}/g)].map((m) => ({ href: m[1].trim(), body: m[2] }));
}

test('the footer link list parses', () => {
  const hrefs = footerLinks().map((l) => l.href);
  assert.ok(hrefs.includes("'/spx-gamma-levels'"), 'levels links not parsed');
  assert.ok(hrefs.includes("'/dashboard'"), 'the dashboard link not parsed');
});

test('every footer link to a gated route is members-only', () => {
  for (const { href, body } of footerLinks()) {
    const literal = /^'(\/[^']*)'$/.exec(href);
    if (!literal) continue; // external links and registry constants
    if (requiredTierForRoute(literal[1]) === null) continue;
    assert.match(body, /membersOnly: true/, `${literal[1]} is gated but renders for signed-out visitors and crawlers`);
  }
});

test('the footer filters members-only links for everyone else', () => {
  assert.match(footer, /\.filter\(\(link\) => canOpenTools \|\| !link\.membersOnly\)/);
});

test('the homepage and /about never hard-code a /dashboard link', () => {
  // Before 2026-11-22 the /about hero and closing buttons did, after the
  // module grid on the same page had already been fixed.
  for (const rel of ['app/LandingClient.tsx', 'app/about/Client.tsx']) {
    assert.doesNotMatch(read(rel), /href=["']\/dashboard["']/, `${rel} links /dashboard for signed-out visitors`);
  }
  assert.match(read('app/about/Client.tsx'), /toolHrefFor\('\/dashboard', canOpenTools\)/);
});
