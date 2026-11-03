import test from 'node:test';
import assert from 'node:assert/strict';
import robots from '../app/robots.ts';
import { KEEP_OUT_CRAWLERS, WELCOMED_AI_CRAWLERS } from '../core/crawlerPolicy.ts';

// robots.txt is the one file where a typo costs the whole site its search
// traffic, so the policy is checked as rendered, not as written.

type Rule = { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] };
const asList = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

const rendered = robots();
const rules = asList(rendered.rules as unknown as string[]) as unknown as Rule[];

/** The rules a crawler obeys: its own named group if it has one, otherwise `*` (RFC 9309). */
function rulesFor(agent: string): Rule[] {
  const named = rules.filter((r) => asList(r.userAgent).some((ua) => ua.toLowerCase() === agent.toLowerCase()));
  return named.length > 0 ? named : rules.filter((r) => asList(r.userAgent).includes('*'));
}

/** Longest-match wins, Allow wins a tie (RFC 9309, section 2.2.2). */
function allowed(agent: string, urlPath: string): boolean {
  let best: { len: number; allow: boolean } | null = null;
  for (const r of rulesFor(agent)) {
    for (const [paths, allow] of [[asList(r.allow), true], [asList(r.disallow), false]] as const) {
      for (const p of paths) {
        if (!p || !urlPath.startsWith(p)) continue;
        if (!best || p.length > best.len || (p.length === best.len && allow)) best = { len: p.length, allow };
      }
    }
  }
  return best ? best.allow : true;
}

// Search engines and the crawlers that fetch a page when a person asks an
// assistant about it. None of them may ever be shut out.
const MUST_REACH = [
  'Googlebot',
  'Bingbot',
  'Applebot',
  'DuckDuckBot',
  'YandexBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'DuckAssistBot',
  'MistralAI-User',
  ...WELCOMED_AI_CRAWLERS,
];

const PAGES = ['/', '/spx-gamma-levels', '/gex-levels', '/education/gamma-exposure-explained', '/llms.txt', '/feed.xml', '/pricing'];

test('search engines, assistant fetchers and the welcomed AI crawlers can read every public page', () => {
  for (const agent of MUST_REACH) {
    for (const page of PAGES) assert.ok(allowed(agent, page), `${agent} is blocked from ${page}`);
    // ...and the internals stay out of reach for them like for everyone.
    assert.equal(allowed(agent, '/api/gex/summary'), false, `${agent} may crawl /api`);
  }
});

test('the keep-out crawlers are disallowed everywhere', () => {
  for (const agent of KEEP_OUT_CRAWLERS) {
    for (const page of PAGES) assert.equal(allowed(agent, page), false, `${agent} may crawl ${page}`);
  }
});

test('no crawler is both welcomed and kept out, and no search engine is on the keep-out list', () => {
  const out = new Set(KEEP_OUT_CRAWLERS.map((a) => a.toLowerCase()));
  for (const agent of MUST_REACH) assert.ok(!out.has(agent.toLowerCase()), `${agent} is on the keep-out list`);
  assert.equal(new Set(KEEP_OUT_CRAWLERS).size, KEEP_OUT_CRAWLERS.length, 'a crawler is listed twice');
});

test('the all-crawler group is unchanged: allow /, keep out /api, /_next/data and /checkout', () => {
  const star = rules.filter((r) => asList(r.userAgent).includes('*'));
  assert.equal(star.length, 1);
  assert.deepEqual(asList(star[0].allow), ['/']);
  assert.deepEqual(asList(star[0].disallow), ['/api', '/_next/data', '/checkout']);
  assert.deepEqual(rendered.sitemap, ['https://zerogex.io/sitemap.xml', 'https://zerogex.io/sitemap-dated.xml']);
});
