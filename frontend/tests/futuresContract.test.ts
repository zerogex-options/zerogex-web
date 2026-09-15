// Naming the CME contract behind an ES / NQ price.
//
// The reports this answers all read the same way: "your futures number is off
// versus TradingView". It never was. ES and NQ trade as separate contracts
// expiring in March, June, September and December, and when our feed has rolled
// to the next one and another provider has not, two charts both labelled "NQ"
// sit a quarter of cost-of-carry apart — about 300 NQ points, 70 on ES. The
// prices were right; the label was missing.
//
// Four properties matter more than the wording, and each is one the fix could
// regress into being the bug it was meant to remove:
//
//  * the contract is never DERIVED here. The roll offset is measured from
//    production feed behaviour and lives in one place in the backend; this
//    module formats `data_contract` / `data_contract_expiry` and nothing else.
//    A second implementation would drift, and the drift would look exactly like
//    the original complaint;
//  * both fields are OPTIONAL. They are absent on every cash symbol, on an
//    older backend, and on a cached response, and every one of those must
//    render as the page renders today rather than as "undefined";
//  * a historical series holds MORE THAN ONE contract. The value is per-bar,
//    so a range spanning a roll genuinely contains two, and nothing may assume
//    one contract per series or key anything on the value;
//  * the copy never says "front month". During roll week that strictly means
//    the EXPIRING contract — the opposite of what we quote — and removing that
//    ambiguity is the entire point of the feature.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  FUTURES_CONTRACT_ARTICLE_TITLE,
  FUTURES_CONTRACT_EXPLAINER,
  FUTURES_CONTRACT_HELP_HREF,
  FUTURES_CONTRACT_HELP_LABEL,
  futuresContractDescription,
  resolveFuturesContract,
  seriesRollNote,
  summarizeSeriesContracts,
} from '../core/futuresContract.ts';
import { HELP_ARTICLES, getHelpArticleBySlug } from '../core/helpRegistry.ts';
import { projectedIndexSpot } from '../app/live-bulletin/bulletinHelpers.ts';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('a futures quote names its contract, its product and its expiry', () => {
  const contract = resolveFuturesContract('NQZ26', '2026-12-18');
  assert.ok(contract);
  assert.equal(contract.code, 'NQZ26');
  assert.equal(contract.productName, 'CME E-mini Nasdaq-100');
  assert.equal(contract.monthLabel, 'December 2026');
  assert.equal(contract.headline, 'NQZ26 — CME E-mini Nasdaq-100, December 2026');
  assert.equal(contract.expiryLine, 'Expires 18 Dec 2026');

  const es = resolveFuturesContract('ESZ26', '2026-12-18');
  assert.equal(es?.productName, 'CME E-mini S&P 500');
});

// The bug this guards: `new Date('2026-12-18')` is midnight UTC, rendered in
// the reader's own zone. Every reader west of Greenwich — which is every US
// customer — would have been told the contract expires on the 17th. An expiry
// has no time of day, so it is read as three numbers and never becomes an
// instant.
test('an expiry date is not moved by the reader timezone', () => {
  const contract = resolveFuturesContract('ESZ26', '2026-12-18');
  assert.equal(contract?.expiryLabel, '18 Dec 2026');
  // A date that would roll backwards across the year boundary under a UTC
  // parse is the sharpest version of the same failure.
  assert.equal(resolveFuturesContract('ESH27', '2027-01-01')?.expiryLabel, '1 Jan 2027');
  assert.equal(resolveFuturesContract('ESH27', '2027-01-01')?.monthLabel, 'January 2027');
});

// A SPX or SPY response carries neither field. The caller must be able to tell
// "not a future" from "a future we failed to describe", because the first one
// renders today's markup and the second would render a hole.
test('a non-futures quote resolves to nothing at all', () => {
  assert.equal(resolveFuturesContract(undefined, undefined), null);
  assert.equal(resolveFuturesContract(null, null), null);
  assert.equal(resolveFuturesContract('', '2026-12-18'), null);
  assert.equal(resolveFuturesContract('   ', null), null);
});

test('a contract without an expiry still names itself', () => {
  // An older backend, or a cached response, can carry the contract and not the
  // date. The month comes off the code's own month letter in that case — a
  // spelling table for a value the backend already chose, not a second opinion
  // about which contract is live.
  const contract = resolveFuturesContract('NQU26');
  assert.equal(contract?.headline, 'NQU26 — CME E-mini Nasdaq-100, September 2026');
  assert.equal(contract?.expiryLine, null);
  assert.equal(contract?.expiryLabel, null);
});

test('an unrecognized contract is shown, never guessed at', () => {
  // The code alone is enough to set another platform to the same contract,
  // which is the one thing the reader needs — so an unknown root keeps the
  // code and drops the name rather than inventing one.
  const unknownRoot = resolveFuturesContract('RTYZ26', '2026-12-18');
  assert.equal(unknownRoot?.productName, null);
  assert.equal(unknownRoot?.headline, 'RTYZ26 — December 2026');

  // Something that is not a contract code at all produces no month, rather
  // than a confidently wrong one.
  const notACode = resolveFuturesContract('continuous', null);
  assert.equal(notACode?.headline, 'CONTINUOUS');
  assert.equal(notACode?.monthLabel, null);
  assert.equal(notACode?.descriptor, null);
});

test('the spoken description carries the explanation, not just the code', () => {
  // This string is a screen reader's whole experience of the feature, so it has
  // to hold the part that actually deflects the support email rather than
  // stopping at the contract code.
  const spoken = futuresContractDescription(resolveFuturesContract('ESZ26', '2026-12-18')!);
  assert.match(spoken, /ESZ26/);
  assert.match(spoken, /Expires 18 Dec 2026/);
  assert.match(spoken, /contract carrying the volume/);
  assert.match(spoken, /cost of carry/);
  assert.match(spoken, new RegExp(FUTURES_CONTRACT_ARTICLE_TITLE));
  assert.doesNotMatch(spoken, /undefined|null|NaN/);
});

// ── A series is not one contract ──────────────────────────────────────────
// /api/market/historical derives the contract from each bar's own timestamp, so
// a range spanning a roll returns the old contract before it and the new one
// after. That is deliberate and honest: the series really does contain two
// instruments, and the price step between them is carry, not a market move.

test('a series spanning a roll reports both contracts and where it crossed', () => {
  const rows = [
    { data_contract: 'NQU26', data_contract_expiry: '2026-09-18' },
    { data_contract: 'NQU26', data_contract_expiry: '2026-09-18' },
    { data_contract: 'NQZ26', data_contract_expiry: '2026-12-18' },
    { data_contract: 'NQZ26', data_contract_expiry: '2026-12-18' },
  ];
  const span = summarizeSeriesContracts(rows);
  assert.deepEqual(span.contracts, ['NQU26', 'NQZ26']);
  assert.equal(span.latest, 'NQZ26');
  assert.equal(span.latestExpiry, '2026-12-18');
  assert.deepEqual(span.rolls, [{ index: 2, from: 'NQU26', to: 'NQZ26' }]);

  const note = seriesRollNote(span);
  assert.match(note!, /NQU26 → NQZ26/);
  assert.match(note!, /cost of carry, not a market move/);
});

test('a series on one contract reports no roll', () => {
  const span = summarizeSeriesContracts([
    { data_contract: 'ESZ26' },
    { data_contract: 'ESZ26' },
  ]);
  assert.deepEqual(span.contracts, ['ESZ26']);
  assert.deepEqual(span.rolls, []);
  assert.equal(seriesRollNote(span), null);
});

test('an unlabelled bar is a gap in the labelling, not a roll', () => {
  // One row that lost its contract must not manufacture two boundaries out of
  // a series that never left the contract it started on.
  const span = summarizeSeriesContracts([
    { data_contract: 'ESU26' },
    { data_contract: null },
    { data_contract: 'ESU26' },
  ]);
  assert.deepEqual(span.rolls, []);
  assert.equal(span.latest, 'ESU26');
});

test('a cash series carries no contract and reports none', () => {
  const span = summarizeSeriesContracts([{}, { data_contract: null }, {}]);
  assert.deepEqual(span.contracts, []);
  assert.equal(span.latest, null);
  assert.equal(span.latestExpiry, null);
  assert.equal(seriesRollNote(span), null);
  assert.deepEqual(summarizeSeriesContracts([]).contracts, []);
});

// ── The copy ─────────────────────────────────────────────────────────────

const ARTICLE_SLUG = 'futures-contract-months';
const ARTICLE = read(`../content/help/platform/${ARTICLE_SLUG}.md`);

test('the tooltip link resolves to a registered help article that exists', () => {
  assert.equal(FUTURES_CONTRACT_HELP_HREF, `/help/platform/${ARTICLE_SLUG}`);
  const registered = getHelpArticleBySlug(ARTICLE_SLUG);
  assert.ok(registered, 'the article must be in HELP_ARTICLES or the route 404s');
  assert.equal(
    registered.title.toLowerCase(),
    FUTURES_CONTRACT_ARTICLE_TITLE.toLowerCase(),
    'the title the tooltip speaks and the title the page shows must agree',
  );
  // generateStaticParams and the sitemap both walk the registry / the content
  // directory, so the two have to stay in step.
  assert.ok(HELP_ARTICLES.some((a) => a.slug === ARTICLE_SLUG));
  assert.match(ARTICLE, /^# Why our futures price can differ from another platform/);

  // Navigation: the Platform Guide index is hand-listed, so an article can be
  // registered and still be unreachable by clicking.
  assert.match(read('../app/help/platform/page.tsx'), new RegExp(`/help/platform/${ARTICLE_SLUG}`));
});

test('the copy never says "front month"', () => {
  // During roll week "front month" strictly means the EXPIRING contract, which
  // is the opposite of the one we quote. This copy exists to remove exactly
  // that ambiguity, so the phrase cannot appear in any of it.
  //
  // Every user-facing string this feature produces, rather than the source
  // files that hold them — the modules explain in comments why the phrase is
  // banned, and a scan of the source would fail on its own reasoning.
  const surfaces: Array<[string, string]> = [
    ['the help article', ARTICLE],
    ['the tooltip explainer', FUTURES_CONTRACT_EXPLAINER],
    ['the link label', FUTURES_CONTRACT_HELP_LABEL],
    ['the article title', FUTURES_CONTRACT_ARTICLE_TITLE],
    ['the spoken description', futuresContractDescription(resolveFuturesContract('NQU26', '2026-09-18')!)],
    [
      'the roll note',
      seriesRollNote(summarizeSeriesContracts([{ data_contract: 'NQU26' }, { data_contract: 'NQZ26' }]))!,
    ],
  ];
  for (const [name, text] of surfaces) {
    assert.doesNotMatch(text, /front[-\s]month/i, `${name} must not say "front month"`);
  }
});

test('the article says providers roll on their own schedules', () => {
  // Naming one industry-wide roll date would explain away the very thing the
  // reader noticed: providers disagreeing is the cause of the mismatch.
  assert.match(ARTICLE, /not all on the same day/i);
  assert.match(ARTICLE, /there isn't one/i);
  assert.match(ARTICLE, /contract carrying the volume/);
  // Written to stay correct across quarters — a hardcoded cycle date would
  // need editing every three months and would be wrong in between.
  assert.doesNotMatch(ARTICLE, /\b(20\d\d-\d\d-\d\d|\d{1,2} (September|December|March|June) 20\d\d)\b/);
});

test('the article does not concede the prices are wrong', () => {
  // Nothing about the numbers is wrong; only the label was missing. Copy that
  // apologises for the data invites a support ticket instead of closing one.
  assert.match(ARTICLE, /Both numbers are correct/i);
  assert.doesNotMatch(ARTICLE, /our (price|feed|data) is (wrong|incorrect|off)/i);
});

// ── The Live Bulletin card ───────────────────────────────────────────────
// The card is screenshotted into tweets and support replies, so its label is
// read far from any tooltip. "futures-implied via ES" carries the same
// ambiguity that started the reports — it does not say WHICH ES — so the
// projection names the contract wherever the quote gives one.

test('the bulletin card names the contract the spot was projected from', () => {
  const projection = projectedIndexSpot(
    {
      display_source: 'futures',
      data_symbol: 'ES',
      data_contract: 'ESZ26',
      futures_close: 6120,
      futures_reference_close: 6100,
    },
    5990,
  );
  assert.equal(projection?.sourceLabel, 'ESZ26');
  // The projection itself is untouched: the future's overnight move applied to
  // the cash close. Only the label changed.
  assert.equal(projection?.spot, 6010);
});

test('the bulletin card falls back to the ticker when no contract is served', () => {
  // An older backend or a cached response. The card reads exactly as it did.
  const projection = projectedIndexSpot(
    {
      display_source: 'futures',
      data_symbol: 'ES',
      futures_close: 6120,
      futures_reference_close: 6100,
    },
    5990,
  );
  assert.equal(projection?.sourceLabel, 'ES');

  // And with neither, the generic word rather than an empty label.
  assert.equal(
    projectedIndexSpot(
      { display_source: 'futures', futures_close: 6120, futures_reference_close: 6100 },
      5990,
    )?.sourceLabel,
    'futures',
  );
});

test('an in-session cash quote is never projected or labelled', () => {
  assert.equal(projectedIndexSpot({ display_source: null, data_contract: 'ESZ26' }, 5990), null);
  assert.equal(projectedIndexSpot(null, 5990), null);
});
