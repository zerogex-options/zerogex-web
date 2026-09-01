import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Guard on the trust boundary between what ZeroGEX OBSERVES (option chain,
// tape, underlying quotes) and what it MODELS (dealer positioning, GEX).
//
// Public option data does not disclose which side a dealer holds at any strike,
// so every dealer-positioning number on the site is a convention applied to
// open interest, not a measurement. Marketing copy drifts back toward certainty
// language on its own — "know exactly where market makers want price", "true
// dealer GEX", "the edge institutions keep secret" — and each of those is a
// claim the methodology cannot support. This test fails the build rather than
// letting one ship.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

// The surfaces a prospective customer reads before they ever see a disclosure.
const MARKETING_SURFACES: Array<[string, string]> = [
  ['landing copy', '../app/LandingClient.i18n.ts'],
  ['landing shell', '../app/LandingClient.tsx'],
  ['about copy', '../app/about/Client.i18n.ts'],
  ['chart page', '../app/chart/ChartClient.tsx'],
  ['faqs', '../app/help/faqs/Client.tsx'],
  ['0dte landing', '../app/real-time-gex-0dte/Client.tsx'],
  ['methodology page', '../content/methodology.md'],
];

// Each pattern is an AFFIRMATIVE overclaim. Written narrowly on purpose: the
// disclosures themselves legitimately say "actual dealer inventory is not
// observable", so a blanket ban on those words would forbid the honest
// sentences along with the dishonest ones.
const BANNED: Array<[string, RegExp]> = [
  ['"true dealer" positioning', /\btrue\s+dealer\s+(gex|gamma|positioning|inventory|book)/i],
  ['"exact dealer inventory"', /\bexact\s+dealer\s+(inventory|positioning|book)/i],
  ['claims to know the dealer book', /\b(know|see|shows?)\s+exactly\s+(where|what|how)[^.!?]{0,60}(dealer|market\s?maker)/i],
  ['claims market makers "want" a price', /market\s?makers?\s+want\s+(the\s+)?price/i],
  ['"secret" institutional edge', /(institutions?|market\s?makers?|bank)[^.!?]{0,20}\bkeeps?\s+secret/i],
  ['promises precision timing', /\b(time|timing)\s+your\s+entries\s+with\s+precision/i],
  ['guarantees an outcome', /\bguarantee[sd]?\s+(profit|outcome|return|result|win)/i],
];

for (const [label, rel] of MARKETING_SURFACES) {
  test(`${label}: no unqualified dealer-certainty claims`, () => {
    const source = read(rel);
    for (const [description, pattern] of BANNED) {
      const hit = source.match(pattern);
      assert.equal(
        hit,
        null,
        `${label} (${rel}) ${description}: ${JSON.stringify(hit?.[0] ?? '')}`,
      );
    }
  });
}

// ── The disclosure has to actually exist, in the product and in the footer ────

test('the methodology page states the modeled-not-observed limitation verbatim', () => {
  const page = read('../content/methodology.md');
  assert.match(page, /Dealer positioning is modeled, not directly observed\./);
  assert.match(page, /does not identify the dealer side of every outstanding contract/i);
});

test('the methodology page does not claim the MM-attribution research has concluded', () => {
  const page = read('../content/methodology.md');
  // The research framework is built so the production model CAN lose. Until it
  // has run, any "validated / proved / confirmed" phrasing about it is a lie.
  assert.match(page, /this research has not yet produced findings/i);
  assert.doesNotMatch(page, /\b(proved|proven|validated|confirmed)\s+(that\s+)?(our|the)\s+(model|methodology)/i);
});

test('the in-product disclosure names the limitation and links to /methodology', () => {
  const note = read('../components/ModeledPositioningNote.tsx');
  assert.match(note, /Dealer positioning is modeled, not directly observed\./);
  assert.match(note, /href="\/methodology"/);
});

test('the in-product disclosure is rendered on the dealer-positioning surfaces', () => {
  // A disclosure that only lives on education pages does not reach the people
  // reading the numbers, which is the failure mode this component exists for.
  for (const rel of [
    '../app/dashboard/page.tsx',
    '../app/my-dashboard/page.tsx',
    '../app/gamma-exposure/page.tsx',
  ]) {
    assert.match(read(rel), /<ModeledPositioningNote/, `${rel} is missing the disclosure`);
  }
});

test('the footer carries a permanent Methodology & Validation link', () => {
  assert.match(read('../components/Footer.tsx'), /href: '\/methodology'/);
  assert.match(read('../core/i18n/dictionaries/en.ts'), /'footer\.methodology': 'Methodology & Validation'/);
});

test('every locale translates the footer methodology link and the landing disclosure', () => {
  for (const locale of ['en', 'de', 'es', 'fr', 'it']) {
    assert.match(
      read(`../core/i18n/dictionaries/${locale}.ts`),
      /'footer\.methodology':/,
      `${locale} dictionary is missing footer.methodology`,
    );
  }
  // usePageT falls back to English on a missing key, so an untranslated locale
  // would silently ship English prose next to translated copy.
  const landing = read('../app/LandingClient.i18n.ts');
  assert.equal(
    (landing.match(/whatIsModeledNote:/g) ?? []).length,
    5,
    'the landing modeled-positioning note is not translated into all five locales',
  );
});

// ── The data-source claim has to stay narrower than the entitlements ──────────

test('the FAQ does not make one blanket feed claim across every data class', () => {
  // ES / NQ prices come from a CME futures feed and official open interest comes
  // from clearing after the session — neither is the options tape. A single
  // "ZeroGEX uses <one feed>" sentence is therefore wrong for the inputs that
  // matter most to GEX.
  const faqs = read('../app/help/faqs/Client.tsx');
  assert.doesNotMatch(faqs, /uses OPRA-feed options data/i);
  assert.match(faqs, /open interest published by the clearinghouse/i);
});
