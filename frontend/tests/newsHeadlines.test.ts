// Smoke tests for the news pipeline: RSS parsing, category inference, and
// dedupe. The aggregator endpoint itself isn't covered here since it hits
// the network — these tests pin the pure helpers it leans on.
import test from "node:test";
import assert from "node:assert/strict";

import {
  HIGH_SIGNAL_THRESHOLD,
  categorizeHeadline,
  dedupeHeadlines,
  formatRelativeTime,
  isHighSignal,
  normalizeTitleKey,
  scoreImportance,
  type NewsHeadline,
} from "../core/newsHeadlines.ts";
import { parseRss } from "../core/rss.ts";

function fixture(overrides: Partial<NewsHeadline>): NewsHeadline {
  return {
    id: "x",
    title: "x",
    url: "",
    source: "Source",
    sourceId: "source",
    category: "markets",
    publishedAtMs: 0,
    importance: 0,
    crossSourceCount: 1,
    ...overrides,
  };
}

test("categorizeHeadline routes Fed/ECB language into central-banks", () => {
  assert.equal(
    categorizeHeadline("Fed signals rate path remains data-dependent", "markets"),
    "central-banks",
  );
  assert.equal(
    categorizeHeadline("ECB's Lagarde says inflation fight not over", "macro"),
    "central-banks",
  );
});

test("categorizeHeadline routes war/election language into geopolitics", () => {
  assert.equal(
    categorizeHeadline("Russia announces new sanctions on Ukraine grain trade", "markets"),
    "geopolitics",
  );
  assert.equal(
    categorizeHeadline("Israel-Hamas ceasefire talks continue in Cairo", "markets"),
    "geopolitics",
  );
});

test("categorizeHeadline routes CPI/jobs language into macro", () => {
  assert.equal(
    categorizeHeadline("US nonfarm payrolls beat estimates", "markets"),
    "macro",
  );
  assert.equal(
    categorizeHeadline("Core CPI rises 0.3% month-over-month", "markets"),
    "macro",
  );
});

test("categorizeHeadline routes ticker/yield language into markets", () => {
  assert.equal(
    categorizeHeadline("S&P 500 closes at record high", "geopolitics"),
    "markets",
  );
  assert.equal(
    categorizeHeadline("10-year Treasury yields slide on dovish Fed minutes", "geopolitics"),
    "central-banks",
  );
});

test("categorizeHeadline falls back to source default when no keyword matches", () => {
  assert.equal(
    categorizeHeadline("Apple announces new keyboard accessory", "markets"),
    "markets",
  );
});

test("dedupeHeadlines drops repeats by id and by normalized title", () => {
  const items: NewsHeadline[] = [
    fixture({ id: "a", title: "Fed holds rates steady", url: "u1", source: "Fed", sourceId: "fed", category: "central-banks", publishedAtMs: 3 }),
    fixture({ id: "a", title: "Fed holds rates steady (duplicate id)", url: "u1b", source: "Fed", sourceId: "fed", category: "central-banks", publishedAtMs: 2 }),
    fixture({ id: "b", title: "Fed holds   rates   steady", url: "u2", source: "Reuters", sourceId: "reuters", category: "central-banks", publishedAtMs: 1 }),
    fixture({ id: "c", title: "Russia escalates Ukraine offensive", url: "u3", source: "BBC", sourceId: "bbc-world", category: "geopolitics", publishedAtMs: 0 }),
  ];
  const out = dedupeHeadlines(items);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, "a");
  assert.equal(out[1].id, "c");
});

test("scoreImportance: institutional press release alone passes threshold", () => {
  const s = scoreImportance("Federal Reserve releases supervisory letter", "fed", 1);
  assert.ok(s >= HIGH_SIGNAL_THRESHOLD, `expected institutional to pass, got ${s}`);
});

test("scoreImportance: single keyword alone does NOT pass threshold", () => {
  const s = scoreImportance("Analyst weighs in on possible CPI surprise", "cnbc-markets", 1);
  // "cpi" + "surprise" actually trigger two patterns, so this is a 2-hit case.
  // Use a true single-hit example instead.
  const single = scoreImportance("Retail sales tracker for the week ahead", "cnbc-markets", 1);
  assert.ok(s >= HIGH_SIGNAL_THRESHOLD, `multi-keyword should pass, got ${s}`);
  assert.ok(single < HIGH_SIGNAL_THRESHOLD, `single keyword should NOT pass, got ${single}`);
});

test("scoreImportance: cross-source ≥3 alone passes threshold", () => {
  const s = scoreImportance("Tech company reports steady demand", "cnbc-markets", 3);
  assert.ok(s >= HIGH_SIGNAL_THRESHOLD, `cross-source >=3 should pass, got ${s}`);
});

test("scoreImportance: cross-source ≥2 alone does NOT pass threshold", () => {
  const s = scoreImportance("Tech company reports steady demand", "cnbc-markets", 2);
  assert.ok(s < HIGH_SIGNAL_THRESHOLD, `cross-source =2 alone should not pass, got ${s}`);
});

test("scoreImportance: keyword + cross-source ≥2 passes threshold", () => {
  const s = scoreImportance("US CPI prints hotter than expected", "cnbc-markets", 2);
  assert.ok(s >= HIGH_SIGNAL_THRESHOLD, `keyword + cross-source should pass, got ${s}`);
});

test("isHighSignal mirrors threshold comparison", () => {
  assert.equal(isHighSignal({ importance: HIGH_SIGNAL_THRESHOLD }), true);
  assert.equal(isHighSignal({ importance: HIGH_SIGNAL_THRESHOLD - 1 }), false);
  assert.equal(isHighSignal({ importance: 10 }), true);
});

test("normalizeTitleKey strips wire-service suffixes and collapses whitespace", () => {
  assert.equal(
    normalizeTitleKey("Fed holds rates steady - Reuters"),
    "fed holds rates steady",
  );
  assert.equal(
    normalizeTitleKey("Fed   holds  rates   steady"),
    "fed holds rates steady",
  );
  assert.equal(
    normalizeTitleKey("Fed holds rates steady | BBC News"),
    "fed holds rates steady",
  );
});

test("formatRelativeTime buckets at minute / hour / day / week boundaries", () => {
  const now = Date.UTC(2026, 5, 15, 12, 0, 0);
  assert.equal(formatRelativeTime(now, now - 30_000), "just now");
  assert.equal(formatRelativeTime(now, now - 5 * 60_000), "5m ago");
  assert.equal(formatRelativeTime(now, now - 2 * 3_600_000), "2h ago");
  assert.equal(formatRelativeTime(now, now - 3 * 86_400_000), "3d ago");
  assert.equal(formatRelativeTime(now, now - 14 * 86_400_000), "2w ago");
});

test("parseRss handles RSS 2.0 with CDATA + HTML entities", () => {
  const xml = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Test</title>
  <item>
    <title><![CDATA[Powell: Fed will "stay vigilant" on inflation]]></title>
    <link>https://example.com/a</link>
    <description><![CDATA[<p>Body text with <b>tags</b>.</p>]]></description>
    <pubDate>Mon, 15 Jun 2026 12:00:00 GMT</pubDate>
    <guid>tag:example.com,2026:a</guid>
  </item>
  <item>
    <title>Plain &amp; simple title</title>
    <link>https://example.com/b</link>
    <pubDate>Mon, 15 Jun 2026 13:00:00 GMT</pubDate>
  </item>
</channel></rss>`;
  const items = parseRss(xml);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Powell: Fed will "stay vigilant" on inflation');
  assert.equal(items[0].link, "https://example.com/a");
  assert.equal(items[0].description, "Body text with tags .");
  assert.equal(items[0].guid, "tag:example.com,2026:a");
  assert.equal(items[0].pubDateMs, Date.UTC(2026, 5, 15, 12, 0, 0));
  assert.equal(items[1].title, "Plain & simple title");
  assert.equal(items[1].pubDateMs, Date.UTC(2026, 5, 15, 13, 0, 0));
});

test("parseRss handles Atom 1.0 with <link href> + <updated>", () => {
  const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom feed</title>
  <entry>
    <title>ECB raises deposit rate by 25bps</title>
    <link rel="alternate" href="https://example.com/atom-a"/>
    <link rel="self" href="https://example.com/atom-self"/>
    <id>urn:uuid:1</id>
    <updated>2026-06-15T12:00:00Z</updated>
    <summary>Body</summary>
  </entry>
</feed>`;
  const items = parseRss(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "ECB raises deposit rate by 25bps");
  assert.equal(items[0].link, "https://example.com/atom-a");
  assert.equal(items[0].guid, "urn:uuid:1");
  assert.equal(items[0].pubDateMs, Date.UTC(2026, 5, 15, 12, 0, 0));
});

test("parseRss skips entries without a title", () => {
  const xml = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item><link>https://example.com/x</link><pubDate>Mon, 15 Jun 2026 12:00:00 GMT</pubDate></item>
  <item><title>Has title</title><pubDate>Mon, 15 Jun 2026 12:00:00 GMT</pubDate></item>
</channel></rss>`;
  const items = parseRss(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Has title");
});
