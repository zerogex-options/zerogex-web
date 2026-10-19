// Guards the overnight display swap against the WebSocket merge. A WS tick is
// the cash index's own bar and carries none of the swap fields; rebuilding the
// cached row from it alone made the header flip between the ES price (HTTP
// poll) and the SPX last close (WS tick) on every tick, overnight and
// pre-market, once ThetaData began writing index bars around the clock.
import test from "node:test";
import assert from "node:assert/strict";

import { httpOnlyQuoteFields } from "../core/liveQuoteMerge.ts";
import type { MarketQuoteRow } from "../hooks/useApiData.ts";

const swapRow: MarketQuoteRow = {
  symbol: "SPX",
  timestamp: "2026-10-16T20:00:00Z",
  open: 6650,
  high: 6650,
  low: 6650,
  close: 6650,
  session: "pre-market",
  display_source: "futures",
  data_symbol: "ES",
  futures_close: 6702.25,
  futures_reference_close: 6688.5,
  data_contract: "ESZ26",
  data_contract_expiry: "2026-12-18",
};

test("the overnight swap fields survive a WS tick", () => {
  assert.deepEqual(httpOnlyQuoteFields(swapRow), {
    display_source: "futures",
    data_symbol: "ES",
    futures_close: 6702.25,
    futures_reference_close: 6688.5,
    data_contract: "ESZ26",
    data_contract_expiry: "2026-12-18",
  });
});

test("the cash index's own fields are not carried (the WS tick owns them)", () => {
  const carried = httpOnlyQuoteFields(swapRow) as Record<string, unknown>;
  for (const key of ["symbol", "timestamp", "open", "high", "low", "close", "session"]) {
    assert.equal(key in carried, false, key);
  }
});

test("a row without the swap carries nothing, so a poll that clears it stays cleared", () => {
  const cashRow: MarketQuoteRow = {
    symbol: "SPX",
    timestamp: "2026-10-19T13:30:05Z",
    open: 6660,
    high: 6662,
    low: 6659,
    close: 6661,
    session: "open",
  };
  assert.deepEqual(httpOnlyQuoteFields(cashRow), {});
});

test("no previous row carries nothing", () => {
  assert.deepEqual(httpOnlyQuoteFields(null), {});
  assert.deepEqual(httpOnlyQuoteFields(undefined), {});
});

test("a null the server sent is carried as null, not dropped", () => {
  const row: MarketQuoteRow = { ...swapRow, futures_reference_close: null };
  assert.equal(httpOnlyQuoteFields(row).futures_reference_close, null);
});
