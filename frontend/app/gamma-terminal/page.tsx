import type { Metadata } from 'next';

import GammaTerminalClient from './GammaTerminalClient';

// Gamma Terminal (beta) — members only (see ROUTE_ACCESS_RULES in core/auth.ts;
// the proxy sends anonymous visitors to /login), so unlike /chart there is no
// delayed public snapshot to build here: the client renders the live chart.
export const metadata: Metadata = {
  title: 'Gamma Terminal — Gamma Chart with Strike Ladders (Beta) | ZeroGEX',
  description:
    'The live ZeroGEX Gamma Chart with two strike-aligned Net GEX ladders beside it. The chart and the first ladder follow your underlying; the second ladder compares any other of SPY, QQQ, SPX, NDX, ES and NQ.',
};

export default function GammaTerminalPage() {
  return <GammaTerminalClient />;
}
