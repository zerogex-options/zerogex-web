import type { Metadata } from "next";

import PairComparisonClient from "./PairComparisonClient";

export const metadata: Metadata = {
  title: "Pair Comparison — SPY/SPX & QQQ/NDX Net GEX | ZeroGEX",
  description:
    "Compare the like pairs SPY↔SPX and QQQ↔NDX side by side: candles for each ticker plus strike-aligned Net GEX heatmaps with Spot, Gamma Flip, Call/Put Walls and Max Pain marked.",
};

export default function PairComparisonPage() {
  return <PairComparisonClient />;
}
