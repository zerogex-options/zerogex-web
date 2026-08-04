import type { Metadata } from "next";

import PairComparisonClient from "./PairComparisonClient";

export const metadata: Metadata = {
  title: "Pair Comparison — Side-by-side Net GEX | ZeroGEX",
  description:
    "Compare the dealer-gamma structure of any two of SPY, QQQ, SPX and NDX side by side: strike-aligned Net GEX ladders centered on spot with Gamma Flip, Call/Put Walls and Max Pain marked — plus a replay scrubber to watch the levels migrate through the most-recent session.",
};

export default function PairComparisonPage() {
  return <PairComparisonClient />;
}
