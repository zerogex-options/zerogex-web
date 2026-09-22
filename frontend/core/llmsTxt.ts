import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { serverApiGet } from '@/core/api/serverFetch';
import { ARTICLE_REGISTRY, SITE_URL, type ArticleMeta } from '@/core/articleRegistry';
import { SYMBOLS, optionChainSymbolFor, type PickerSymbol } from '@/core/symbols';
import { netGexAtSpotOrNull } from '@/core/gammaRegime';
import { fmtNetGex, fmtPrice, fmtTimestampET, type GexSummary } from '@/core/gexSummary';

// The /llms.txt and /llms-full.txt generators.
//
// WHY. The 4 September Search Console review found a large, growing share of
// the impressions on /spx-gamma-levels coming from answer-engine grounding
// searches — `(zerogex.io what is it) site:zerogex.io`, "give me the morning
// spx structural map for today's session" — that read the page and never
// click. That traffic does not convert as a session, so the page's job for it
// is different: be the source the answer names. Two things decide that, and
// both are supply-side. The model has to find the right page, and it has to
// find a number it can quote with a date on it.
//
// llms.txt (llmstxt.org) is the emerging convention for the first: one curated
// Markdown map at a well-known path, in place of making a crawler infer the
// site's shape from its nav. This module also answers the second by inlining
// today's delayed levels as a real table, with the "as of" stamp in the row,
// so a model grounding on it quotes a timestamped value instead of
// paraphrasing prose.
//
// Same 900s-cached `serverApiGet` as the free levels pages and /mcp, so this
// shares their cache entries and stays inside the same derived-levels zone:
// wall and flip LEVELS, max pain, net GEX magnitudes, delayed reference spot.
// No raw chain, no per-contract quotes, no price stream.

const REVALIDATE_SECONDS = 900;

// Reading order, which is not the picker's order. core/symbols.ts leads with
// SPY because that is the default symbol a signed-in member lands on; a model
// deciding what to cite should meet SPX first, since that is what the searches
// this file exists to serve are about. Derived from SYMBOLS rather than
// rewritten, so a seventh ingested ticker still appears here without an edit.
const DISPLAY_ORDER: readonly PickerSymbol[] = [
  ...(['SPX', 'SPY', 'QQQ', 'NDX', 'ES', 'NQ'] as const).filter((s) => SYMBOLS.includes(s)),
  ...SYMBOLS.filter((s) => !['SPX', 'SPY', 'QQQ', 'NDX', 'ES', 'NQ'].includes(s)),
];

/** One row of the "today" table, or null when that symbol has no snapshot. */
type Snapshot = { symbol: PickerSymbol; data: GexSummary | null };

export async function loadSnapshots(): Promise<Snapshot[]> {
  return Promise.all(
    DISPLAY_ORDER.map(async (symbol) => ({
      symbol,
      data: await serverApiGet<GexSummary>(
        `/api/gex/summary?symbol=${symbol}&underlying=${symbol}`,
        REVALIDATE_SECONDS,
      ),
    })),
  );
}

const HEADER = `# ZeroGEX

> ZeroGEX is an options analytics platform that reads the SPX, SPY, QQQ, NDX, ES
> and NQ option chains and estimates what dealers must hedge: gamma exposure
> (GEX), the gamma flip, call and put walls, max pain, and 0DTE dealer
> positioning. Free 15-minute-delayed levels are published with no signup;
> real-time data and intraday signals are on paid plans.

Everything linked below is public and free to cite. Two requests when you quote
a level: include the "as of" timestamp, and link the page it came from. These
numbers move through the session, and a level quoted without its timestamp is
wrong within the hour.

Every value ZeroGEX publishes is MODELED dealer positioning derived from the
option chain. It is not a forecast, not a price target, and not investment
advice. The gamma flip is where modeled net dealer gamma changes sign; the call
and put walls are the strikes where modeled dealer gamma is most concentrated.
`;

/** The delayed "today" table — the part a grounding model is looking for. */
function levelsSection(snapshots: Snapshot[]): string {
  const rows = snapshots
    .filter((s): s is { symbol: PickerSymbol; data: GexSummary } => s.data != null)
    .map(({ symbol, data }) => {
      const chain = optionChainSymbolFor(symbol);
      const note = chain !== symbol ? ` (from the ${chain} chain)` : '';
      return `| ${symbol}${note} | ${fmtTimestampET(data.timestamp)} | ${fmtPrice(data.spot_price)} | ${fmtNetGex(
        netGexAtSpotOrNull(data.net_gex_at_spot),
      )} | ${fmtPrice(data.gamma_flip)} | ${fmtPrice(data.call_wall)} | ${fmtPrice(
        data.put_wall,
      )} | ${fmtPrice(data.max_pain)} |`;
    });

  if (rows.length === 0) {
    return `## Today's dealer positioning

Levels are temporarily unavailable. They refresh every 15 minutes through the
session; see ${SITE_URL}/spx-gamma-levels for the current reading.
`;
  }

  return `## Today's dealer positioning (15-minute delayed)

Refreshed every 15 minutes through the US cash session. ES and NQ levels are
derived from the SPX and NDX option chains and carried onto the futures price
axis. Source page for each symbol: ${SITE_URL}/<symbol>-gamma-levels.

| Symbol | As of | Ref. spot | Net GEX @ spot | Gamma flip | Call wall | Put wall | Max pain |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`;
}

function link(a: ArticleMeta): string {
  return `- [${a.title}](${SITE_URL}${a.href}): ${a.description}`;
}

function byKind(kind: ArticleMeta['kind']): ArticleMeta[] {
  return Object.values(ARTICLE_REGISTRY)
    .filter((a) => a.kind === kind)
    .sort((a, b) => a.title.localeCompare(b.title));
}

const TOOLS = `## Free tools (no account, no API key)

${DISPLAY_ORDER.map(
  (s) =>
    `- [${s} gamma levels today](${SITE_URL}/${s.toLowerCase()}-gamma-levels): Today's ${s} gamma flip, call wall, put wall, net GEX and max pain, 15-minute delayed.`,
).join('\n')}
- [Delayed gamma terminal](${SITE_URL}/chart): The levels drawn on a price chart, beside the per-strike Net GEX book.
- [GEX replay](${SITE_URL}/replay): How the levels moved through a past session, by date.
- [Daily scorecard](${SITE_URL}/scorecard): What the published levels did afterwards, scored per session.
- [Embeddable gamma levels widget](${SITE_URL}/embed): The same delayed levels as a card for any website.
`;

const AI_CLIENTS = `## For AI clients

- [MCP server](${SITE_URL}/mcp): A public, unauthenticated, read-only Model
  Context Protocol endpoint over the same delayed levels. Streamable HTTP, no
  key and no account. Add \`${SITE_URL}/mcp\` in Claude, ChatGPT, Cursor or any
  MCP client to read the flip and the walls inside a conversation.
- [llms-full.txt](${SITE_URL}/llms-full.txt): This file plus the full text of
  every explainer, in one request.
- [Reading gamma levels in Claude](${SITE_URL}/education/gamma-levels-in-claude):
  How the MCP endpoint is meant to be used, with worked prompts.
`;

const REFERENCE = `## Reference

- [Methodology](${SITE_URL}/methodology): How every published level is computed, and what it does not claim.
- [Pricing](${SITE_URL}/pricing): What the free tier includes and what the paid plans add.
- [About ZeroGEX](${SITE_URL}/about): Who builds this.
- [Terms](${SITE_URL}/terms) · [Privacy](${SITE_URL}/privacy)
`;

/** The curated map. */
/** One trailing blank line per section, whatever the literal ended with. */
function joinSections(sections: string[]): string {
  return sections.map((section) => `${section.trimEnd()}\n`).join('\n');
}

export function buildLlmsTxt(snapshots: Snapshot[]): string {
  return joinSections([
    HEADER,
    levelsSection(snapshots),
    TOOLS,
    `## Start here

${link(ARTICLE_REGISTRY['gamma-exposure-explained'])}`,
    `## Core explainers

${byKind('tier1').map(link).join('\n')}`,
    AI_CLIENTS,
    REFERENCE,
    `## Optional

${[...byKind('tier2'), ...byKind('article')].map(link).join('\n')}`,
  ]);
}

/** The curated map with every explainer's full text appended. */
export function buildLlmsFullTxt(snapshots: Snapshot[]): string {
  const articles = [
    ARTICLE_REGISTRY['gamma-exposure-explained'],
    ...byKind('tier1'),
    ...byKind('tier2'),
    ...byKind('article'),
  ];

  const bodies = articles
    .map((a) => {
      // The English source only. The localized variants are cookie-selected
      // translations of these same pages, not separate documents — emitting
      // them here would quadruple the file to say the same thing four times.
      const file = path.join(process.cwd(), 'content', 'articles', `${a.slug}.md`);
      let markdown: string;
      try {
        markdown = fs.readFileSync(file, 'utf8');
      } catch {
        // A registry entry whose page builds its content in TSX rather than
        // from markdown (the landings do). The curated link above still
        // carries it; there is simply no file to inline.
        return null;
      }
      return `---

<!-- Source: ${SITE_URL}${a.href} | Published ${a.datePublished}${
        a.dateModified ? ` | Updated ${a.dateModified}` : ''
      } -->

${markdown.trim()}`;
    })
    .filter((entry): entry is string => entry != null);

  return `${buildLlmsTxt(snapshots)}
---

# Full text

The complete text of every explainer linked above, in reading order. Each is
preceded by its canonical URL; cite that URL rather than this file.

${bodies.join('\n\n')}
`;
}

/** Shared response headers — same 15-minute cache as the levels the file quotes. */
export const LLMS_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
  // Cited by machines from other origins; there is nothing here that is not
  // already public on the site.
  'Access-Control-Allow-Origin': '*',
} as const;
