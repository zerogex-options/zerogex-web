// Where a tool link sends a visitor who cannot open the tool.
//
// The homepage's "Eight Modules" grid and the /about module grid link eight
// tier-gated routes. For anyone without a Basic+ plan, and for Googlebot, each
// of those answers with a 307 to /login carrying X-Robots-Tag: noindex (see
// proxy.ts), so the two strongest pages on the site sent their module links
// into a login wall that passes nothing on. A signed-out visitor now lands on
// the public page that shows or explains the same tool: the free delayed
// version where one exists, otherwise its Platform Guide page. Members keep
// the tool itself.
//
// Pure and relative-import-free so node --test can load it.

export const PUBLIC_TOOL_HREF: Readonly<Record<string, string>> = {
  '/dashboard': '/chart',
  '/trading-signals': '/guides/signals-explained',
  '/flow-analysis': '/help/platform/flow-analysis',
  '/gamma-exposure': '/spx-gamma-levels',
  '/intraday-tools': '/help/platform/technicals',
  '/max-pain': '/help/platform/max-pain',
  '/options-calculator': '/help/platform/options-calculator',
  '/greeks-gex': '/help/platform/gex-summary',
};

/** The tool itself for a member, its public counterpart for everyone else. */
export function toolHrefFor(href: string, canOpenTools: boolean): string {
  return canOpenTools ? href : (PUBLIC_TOOL_HREF[href] ?? href);
}
