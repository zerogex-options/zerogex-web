// Which AI crawlers zerogex.io welcomes, and which it asks to stay out.
// Decided 2026-11-03; the reasoning is in docs/seo/2026-11-03-traffic-levers.md.
//
// UNTIL THEN, CLOUDFLARE DECIDED. The zone's "AI Crawler and Agent access
// policies" had Training set to block, so Cloudflare prepended its own block
// to robots.txt (Disallow for ~30 crawlers) and answered GPTBot, ClaudeBot,
// CCBot, Amazonbot and Bytespider with 403 at the edge, /llms.txt included.
// That kept the brand out of what ChatGPT, Claude and Apple Intelligence learn,
// and kept the pages out of the Gemini app's answers, while the site was
// publishing llms.txt, llms-full.txt and an MCP server for exactly those
// assistants. Search and in-chat agents (Googlebot, bingbot, OAI-SearchBot,
// ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot) were never
// blocked and are not touched here.
//
// NOW THE REPO DECIDES. With Training set to Allow in Cloudflare, the managed
// block disappears and this list is the whole policy, served by app/robots.ts:
//   - WELCOMED_AI_CRAWLERS are named here only so the tests can prove nothing
//     shuts them out. They follow the `*` group like any other crawler.
//     Google-Extended and Applebot-Extended are permission tokens, not
//     crawlers: allowing them adds no crawling at all, only the right to use
//     what Googlebot and Applebot already fetch.
//   - KEEP_OUT_CRAWLERS is Cloudflare's former list minus the welcomed ones
//     and Anthropic's retired tokens: data resellers, single-purpose scrapers
//     and search engines for markets ZeroGEX does not serve. Each of them was
//     disallowed on 2026-11-02, so this changes nothing for them. Bytespider
//     ignores robots.txt, so it also stays blocked at the edge (Cloudflare AI
//     Crawl Control, per crawler).
//
// Pure module, no '@/' imports, so app/robots.ts can be loaded by node --test.

export const WELCOMED_AI_CRAWLERS = [
  'GPTBot', // OpenAI: what ChatGPT knows without searching
  'ClaudeBot', // Anthropic: the same, for Claude
  'CCBot', // Common Crawl: the open corpus many other models learn from
  'Google-Extended', // token: Gemini training and Gemini app grounding
  'Applebot-Extended', // token: Apple Intelligence
] as const;

export const KEEP_OUT_CRAWLERS = [
  'Amazonbot',
  'Bytespider',
  'Diffbot',
  'omgili',
  'cohere-ai',
  'MistralAI-Training',
  'meta-externalagent',
  'GoogleOther',
  'Google-CloudVertexBot',
  'Baiduspider',
  'PetalBot',
  'AwarioSmartBot',
  'AwarioRssBot',
  'QualifiedBot',
  'Cotoyogi',
  'ICC-Crawler',
  'atlassian-bot',
  'FishBot',
  'BorderxBot',
  'NavuBot',
  'SemrushBot-SWA',
  'WARDBot',
  'magpie-crawler',
  'KimiBot',
  'CitibotSiteCrawler',
] as const;
