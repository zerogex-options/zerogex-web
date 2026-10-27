// Goodwill free months (core/giftMonth.ts, used by scripts/gift-month.mts). The
// credit must be NEGATIVE: Stripe adds a positive balance transaction to the
// member's next invoice, which would charge them more instead of less.
import test from "node:test";
import assert from "node:assert/strict";

import { GIFT_REF_METADATA_KEY, MAX_GIFT_MONTHS, giftBalanceTransaction, giftRef, oneMonthOf } from "../core/giftMonth.ts";

test("a monthly plan's month is its price", () => {
  assert.deepEqual(oneMonthOf({ unit_amount: 5900, currency: "usd", recurring: { interval: "month" } }), {
    amount: 5900,
    currency: "usd",
  });
});

test("an annual plan's month is a twelfth of it", () => {
  assert.deepEqual(oneMonthOf({ unit_amount: 59000, currency: "usd", recurring: { interval: "year" } }), {
    amount: 4917,
    currency: "usd",
  });
});

test("a price billed every N months counts one of them", () => {
  assert.equal(oneMonthOf({ unit_amount: 15000, currency: "usd", recurring: { interval: "month", interval_count: 3 } })?.amount, 5000);
});

test("an unreadable price gives nothing to credit", () => {
  assert.equal(oneMonthOf(null), null);
  assert.equal(oneMonthOf({ unit_amount: null, currency: "usd" }), null);
  assert.equal(oneMonthOf({ unit_amount: 5900, currency: null }), null);
});

test("the gift is a credit: a negative amount worth the months given", () => {
  const one = giftBalanceTransaction({ months: 1, monthAmount: 5900, currency: "usd", ref: "goodwill-2026-10-27", userId: "user_1" });
  assert.equal(one.amount, -5900);
  assert.equal(one.currency, "usd");
  assert.equal(one.description, "Goodwill: 1 free month");
  assert.deepEqual(one.metadata, { [GIFT_REF_METADATA_KEY]: "goodwill-2026-10-27", user_id: "user_1", months: "1" });

  const two = giftBalanceTransaction({ months: 2, monthAmount: 5900, currency: "usd", ref: "r", userId: "u", note: "chart lag" });
  assert.equal(two.amount, -11800);
  assert.equal(two.description, "Goodwill: 2 free months (chart lag)");
});

test("months and amounts outside the sensible range are refused", () => {
  const base = { monthAmount: 5900, currency: "usd", ref: "r", userId: "u" };
  assert.throws(() => giftBalanceTransaction({ ...base, months: 0 }));
  assert.throws(() => giftBalanceTransaction({ ...base, months: MAX_GIFT_MONTHS + 1 }));
  assert.throws(() => giftBalanceTransaction({ ...base, months: 1.5 }));
  assert.throws(() => giftBalanceTransaction({ ...base, months: 1, monthAmount: 0 }));
  assert.throws(() => giftBalanceTransaction({ ...base, months: 1, monthAmount: -5900 }));
});

test("one gift tag per New York day, whatever the UTC date", () => {
  // 8 PM ET on Oct 27 is already Oct 28 in UTC.
  assert.equal(giftRef(new Date("2026-10-28T00:30:00Z")), "goodwill-2026-10-27");
  assert.equal(giftRef(new Date("2026-10-27T13:00:00Z")), "goodwill-2026-10-27");
  assert.equal(giftRef(new Date("2026-10-28T04:30:00Z")), "goodwill-2026-10-28");
});
